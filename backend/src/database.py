"""Explicit SQLite initialization, owned reads and upload/Speech workflow writes."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATABASE_PATH = BACKEND_DIR / "data" / "databases" / "app.db"
SCHEMA_PATH = Path(__file__).with_name("schema.sql")

# Explicit columns keep storage keys, provider IDs and transcript bodies out of lists.
PUBLIC_RUN_COLUMNS = """
    run_id, filename, size_bytes, language, requested_speakers,
    include_speaker_labels, include_timestamps, upload_stage, transcription_stage,
    error_message, created_at, updated_at
"""


def configured_database_path() -> Path:
    """An optional override isolates tests and alternate local workspaces."""
    return Path(os.environ.get("SSSCRIBE_DATABASE_PATH", str(DATABASE_PATH))).resolve()


@contextmanager
def connect(path: Path):
    """Use a short, task-local connection and always close it, including on errors."""
    connection = sqlite3.connect(f"{path.resolve().as_uri()}?mode=rw", uri=True, timeout=5)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_database(path: Path = DATABASE_PATH) -> None:
    """Create missing directories/table; preserve existing runs on repeat calls."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch(exist_ok=True)
    with connect(path) as connection:
        connection.execute(SCHEMA_PATH.read_text(encoding="utf-8"))


def list_runs(path: Path, owner_id: str) -> list[dict]:
    with connect(path) as connection:
        rows = connection.execute(
            f"SELECT {PUBLIC_RUN_COLUMNS} FROM runs WHERE owner_id = ? "
            "ORDER BY created_at DESC, run_id DESC",
            (owner_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_transcript(path: Path, owner_id: str, run_id: int) -> dict | None:
    with connect(path) as connection:
        row = connection.execute(
            "SELECT run_id, transcription_stage, transcript_text FROM runs WHERE owner_id = ? AND run_id = ?",
            (owner_id, run_id),
        ).fetchone()
        return dict(row) if row is not None else None


def create_upload(path: Path, owner_id: str, metadata: dict) -> dict:
    with connect(path) as connection:
        cursor = connection.execute(
            """INSERT INTO runs (owner_id, storage_key, filename, size_bytes, language,
                requested_speakers, include_speaker_labels, include_timestamps)
                VALUES (:owner_id, :storage_key, :filename, :size_bytes, :language,
                    :requested_speakers, :include_speaker_labels, :include_timestamps)""",
            {**metadata, 'owner_id': owner_id, 'storage_key': metadata['filename']},
        )
        return dict(connection.execute('SELECT * FROM runs WHERE run_id = ?', (cursor.lastrowid,)).fetchone())


def upload_record(path: Path, owner_id: str, run_id: int) -> dict:
    with connect(path) as connection:
        row = connection.execute('SELECT * FROM runs WHERE owner_id = ? AND run_id = ?',
                                 (owner_id, run_id)).fetchone()
        if row is None:
            raise HTTPException(404, 'Run not found.')
        return dict(row)


def update_upload(path: Path, owner_id: str, run_id: int, stage: str) -> dict:
    with connect(path) as connection:
        connection.execute(
            """UPDATE runs SET upload_stage = ?, error_message = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE owner_id = ? AND run_id = ? AND upload_stage IN ('uploading', 'failed')""",
            (stage,
             'Upload did not finish. Select the file again to start a new upload.' if stage == 'failed' else None,
             owner_id, run_id),
        )
    return upload_record(path, owner_id, run_id)


def processing_runs(path: Path, phase: str) -> list[dict]:
    predicates = {
        'submit': "upload_stage = 'completed' AND transcription_stage = 'not_started' AND speech_job_id IS NULL",
        'poll': "speech_job_id IS NOT NULL AND (speech_status IS NULL OR speech_status IN ('NotStarted', 'Running')) AND transcription_stage != 'failed'",
        'import': "speech_status = 'Succeeded' AND transcription_stage = 'importing'",
    }
    with connect(path) as connection:
        return [dict(row) for row in connection.execute(
            f"SELECT * FROM runs WHERE {predicates[phase]} ORDER BY run_id",
        ).fetchall()]


def claim_submission(path: Path, run_id: int) -> bool:
    with connect(path) as connection:
        return connection.execute(
            """UPDATE runs SET transcription_stage = 'submission_uncertain', error_message = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE run_id = ? AND upload_stage = 'completed'
                AND transcription_stage = 'not_started' AND speech_job_id IS NULL""", (run_id,),
        ).rowcount == 1


def save_speech_status(path: Path, run_id: int, job_id: str, raw: str, stage: str, error: str | None) -> None:
    with connect(path) as connection:
        connection.execute(
            """UPDATE runs SET speech_job_id = ?, speech_status = ?, transcription_stage = ?,
                error_message = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE run_id = ?""", (job_id, raw, stage, error, run_id),
        )


def save_transcript(path: Path, run_id: int, text: str) -> None:
    with connect(path) as connection:
        connection.execute(
            """UPDATE runs SET transcript_text = ?, transcription_stage = 'completed',
                error_message = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE run_id = ? AND speech_status = 'Succeeded' AND transcription_stage = 'importing'""",
            (text, run_id),
        )


def save_processing_error(path: Path, run_id: int, message: str, stage: str | None = None) -> None:
    with connect(path) as connection:
        connection.execute(
            """UPDATE runs SET error_message = ?, transcription_stage = COALESCE(?, transcription_stage),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE run_id = ?""",
            (message, stage, run_id),
        )


if __name__ == "__main__":
    path = configured_database_path()
    initialize_database(path)
    print(f"Initialized SQLite database: {path}")
