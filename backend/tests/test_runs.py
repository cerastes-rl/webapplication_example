"""Owner isolation, persisted reads and transcript contracts over real HTTP."""

import sqlite3
from contextlib import closing
from urllib.request import build_opener

from test_auth import ApiTestCase


class RunTests(ApiTestCase):
    def setUp(self):
        with closing(sqlite3.connect(self.database_path)) as connection, connection:
            connection.execute("DELETE FROM runs")
            # Identical timestamps deliberately exercise the stable ID tie-breaker.
            for run_id, owner, status, transcript in [
                (1, "austin", "completed", "Sample transcript\nExact whitespace.\n"),
                (2, "john", "completed", "John's private transcript"),
                (3, "austin", "uploading", None),
                (4, "austin", "completed", None),
                (5, "austin", "running", "Unfinished text"),
            ]:
                connection.execute(
                    """INSERT INTO runs (
                        run_id, owner_id, filename, storage_key, upload_stage, transcription_stage, transcript_text,
                        speech_job_id, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (run_id, owner, f"sample-{run_id}.wav", "private/object-key",
                     "uploading" if status == "uploading" else "completed",
                     "not_started" if status == "uploading" else status, transcript, "private-speech-id", "2026-11-09T12:00:00.000Z",
                     "2026-11-09T12:00:00.000Z"),
                )

    def signed_in(self, key="austin"):
        client, _ = self.client()
        self.assertEqual(self.call(client, "/api/auth/sign-in", {"access_key": key})[0], 200)
        return client

    def test_transcription_stage_constraint(self):
        with closing(sqlite3.connect(self.database_path)) as connection, connection:
            for stage in ['not_started', 'queued', 'running', 'importing', 'completed', 'failed', 'submission_uncertain']:
                connection.execute("UPDATE runs SET transcription_stage = ? WHERE run_id = 1", (stage,))
            for stage in ['submitting', 'processing', 'succeeded', 'Succeeded']:
                with self.assertRaises(sqlite3.IntegrityError):
                    connection.execute("UPDATE runs SET transcription_stage = ? WHERE run_id = 1", (stage,))

    def test_all_reads_require_authentication(self):
        for route in ["/api/runs", "/api/runs/1/transcript"]:
            status, body, headers = self.call(build_opener(), route)
            self.assertEqual(status, 401)
            self.assertEqual(body["error"]["code"], "unauthorized")
            self.assertEqual(headers["Cache-Control"], "no-store")

    def test_list_returns_all_owned_rows_in_stable_order(self):
        austin = self.signed_in()
        status, runs, headers = self.call(austin, "/api/runs")
        self.assertEqual(status, 200)
        self.assertEqual([run["run_id"] for run in runs], [5, 4, 3, 1])
        self.assertEqual(headers["Cache-Control"], "no-store")
        with closing(sqlite3.connect(self.database_path)) as connection, connection:
            connection.executemany(
                "INSERT INTO runs(owner_id, filename, storage_key) VALUES ('austin', ?, ?)",
                [(f'file-{i}.txt', f'key-{i}') for i in range(100)],
            )
        self.assertEqual(len(self.call(austin, '/api/runs')[1]), 104)
        john = self.signed_in("john")
        self.assertEqual([run["run_id"] for run in self.call(john, "/api/runs")[1]], [2])
        with closing(sqlite3.connect(self.database_path)) as connection, connection:
            connection.execute("DELETE FROM runs WHERE owner_id = 'john'")
        self.assertEqual(self.call(john, "/api/runs")[:2], (200, []))

    def test_list_contract_hides_internal_data(self):
        client = self.signed_in()
        status, runs, headers = self.call(client, "/api/runs")
        self.assertEqual(status, 200)
        run = next(run for run in runs if run["run_id"] == 1)
        self.assertEqual(set(run), {
            "run_id", "filename", "size_bytes", "language", "requested_speakers",
            "include_speaker_labels", "include_timestamps", "upload_stage", "transcription_stage", "error_message",
            "created_at", "updated_at",
        })
        self.assertIsNone(run["size_bytes"])
        self.assertIsNone(run["requested_speakers"])
        self.assertIs(run["include_speaker_labels"], True)
        self.assertIs(run["include_timestamps"], True)
        self.assertTrue(run["created_at"].endswith("Z"))
        self.assertEqual(headers["Cache-Control"], "no-store")
        for listed in runs:
            self.assertEqual(set(listed), set(run))

    def test_unknown_and_other_owner_are_indistinguishable(self):
        for client, hidden_id in [(self.signed_in(), 2), (self.signed_in("john"), 1)]:
            hidden = self.call(client, f"/api/runs/{hidden_id}/transcript")
            missing = self.call(client, "/api/runs/9999/transcript")
            self.assertEqual(hidden[:2], missing[:2])
            self.assertEqual(hidden[:2], (404, {"error": {
                "code": "not_found", "message": "Run not found.",
            }}))

    def test_transcript_is_verbatim_and_only_available_when_complete(self):
        client = self.signed_in()
        status, body, headers = self.call(client, "/api/runs/1/transcript")
        self.assertEqual((status, body), (200, {
            "run_id": 1, "transcript_text": "Sample transcript\nExact whitespace.\n",
        }))
        self.assertEqual(headers["Cache-Control"], "no-store")
        for run_id in [3, 4, 5]:
            status, body, _ = self.call(client, f"/api/runs/{run_id}/transcript")
            self.assertEqual(status, 409)
            self.assertEqual(body["error"]["code"], "conflict")

    def test_invalid_parameters_have_predictable_errors(self):
        client = self.signed_in()
        for route in [
            "/api/runs/0/transcript", "/api/runs/-1/transcript",
            "/api/runs/not-an-id/transcript", "/api/runs/9223372036854775808/transcript",
            "/api/runs/1%20OR%201=1/transcript",
        ]:
            status, body, headers = self.call(client, route)
            self.assertEqual(status, 422, route)
            self.assertEqual(body["error"]["code"], "validation_error")
            self.assertEqual(headers["Cache-Control"], "no-store")

    def test_restart_preserves_rows_but_requires_new_session(self):
        client = self.signed_in()
        before = self.call(client, "/api/runs")[1]
        self.server.terminate()
        self.server.wait(timeout=5)
        type(self).start_server()
        self.assertEqual(self.call(client, "/api/runs")[0], 401)
        client = self.signed_in()
        self.assertEqual(self.call(client, "/api/runs")[1], before)
        self.assertEqual(self.call(client, "/api/runs/1/transcript")[1]["transcript_text"],
                         "Sample transcript\nExact whitespace.\n")
