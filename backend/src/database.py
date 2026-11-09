"""SQLite initialization and owner-scoped reads for the application API."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATABASE_PATH = BACKEND_DIR / "data" / "databases" / "app.db"
SCHEMA_PATH = Path(__file__).with_name("schema.sql")

# Explicit columns keep storage keys, provider IDs and transcript bodies out of lists.
PUBLIC_RUN_COLUMNS = """
    run_id, filename, size_bytes, language, requested_speakers,
    include_speaker_labels, include_timestamps, status, error_message,
    created_at, updated_at
"""


def configured_database_path() -> Path:
    """An optional override isolates tests and alternate local workspaces."""
    return Path(os.environ.get("SSSCRIBE_DATABASE_PATH", str(DATABASE_PATH))).resolve()


@contextmanager
def connect(path: Path):
    """Use a short, task-local connection and always close it, including on errors."""
    connection = sqlite3.connect(path, timeout=5)
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
    with connect(path) as connection:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def list_runs(path: Path, owner_id: str, limit: int, offset: int) -> list[dict]:
    with connect(path) as connection:
        rows = connection.execute(
            f"SELECT {PUBLIC_RUN_COLUMNS} FROM runs WHERE owner_id = ? "
            "ORDER BY created_at DESC, run_id DESC LIMIT ? OFFSET ?",
            (owner_id, limit, offset),
        ).fetchall()
        return [dict(row) for row in rows]


def get_transcript(path: Path, owner_id: str, run_id: int) -> dict | None:
    with connect(path) as connection:
        row = connection.execute(
            "SELECT run_id, status, transcript_text FROM runs WHERE owner_id = ? AND run_id = ?",
            (owner_id, run_id),
        ).fetchone()
        return dict(row) if row is not None else None


if __name__ == "__main__":
    path = configured_database_path()
    initialize_database(path)
    print(f"Initialized SQLite database: {path}")
