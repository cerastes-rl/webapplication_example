"""Real upload/API/SQLite/Speech journey with isolated files and faster mock timing."""

import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from test_auth import ApiTestCase

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class SpeechFlowTests(ApiTestCase):
    processing_enabled = True

    @classmethod
    def setUpClass(cls):
        cls.files = tempfile.TemporaryDirectory()
        cls.service_logs = tempfile.TemporaryFile()
        cls.services = []
        root = Path(cls.files.name)
        cls.audio_dir = root / 'data/blobs/audio'
        for service in ['storage', 'speech']:
            with socket.socket() as listener:
                listener.bind(('127.0.0.1', 0))
                port = listener.getsockname()[1]
            setattr(cls, f'{service}_base', f'http://127.0.0.1:{port}')
            script = 'import uvicorn; '
            if service == 'speech':
                script += (f'from pathlib import Path; from services import speech_mock as mock; '
                           f'mock.BACKEND_DIR = Path({str(root)!r}); '
                           'mock.BLOB_DIR = mock.BACKEND_DIR / "data/blobs"; '
                           'from starlette.staticfiles import StaticFiles; '
                           'next(route for route in mock.app.routes if route.name == "blobs").app = '
                           'StaticFiles(directory=mock.BLOB_DIR, check_dir=False); '
                           'mock.QUEUED_SECONDS = .5; mock.PROCESSING_SECONDS = 1.5; '
                           f'uvicorn.run(mock.app, host="127.0.0.1", port={port}, log_level="warning")')
            else:
                script += f'uvicorn.run("services.storage_mock:app", host="127.0.0.1", port={port}, log_level="warning")'
            process = subprocess.Popen([sys.executable, '-c', script],
                cwd=Path(__file__).resolve().parents[2], stdout=cls.service_logs, stderr=cls.service_logs,
                env={**os.environ, 'SSSCRIBE_STORAGE_DIR': str(cls.audio_dir)})
            cls.services.append(process)
            cls.addClassCleanup(cls.stop_service, process)
            for _ in range(100):
                try:
                    with urlopen(getattr(cls, f'{service}_base') + '/openapi.json', timeout=2):
                        break
                except URLError:
                    time.sleep(.05)
            else:
                raise RuntimeError(f'{service} did not start')
        cls.api_env = {'SSSCRIBE_STORAGE_URL': cls.storage_base,
                       'SSSCRIBE_SPEECH_URL': cls.speech_base}
        super().setUpClass()

    @staticmethod
    def stop_service(process):
        process.terminate()
        process.wait(timeout=8)

    @classmethod
    def tearDownClass(cls):
        try:
            super().tearDownClass()
        finally:
            for process in cls.services:
                cls.stop_service(process)
            cls.service_logs.close()
            cls.files.cleanup()

    def test_upload_poll_restart_and_import(self):
        client, _ = self.client()
        self.call(client, '/api/auth/sign-in', {'access_key': 'austin'})
        source = 'Original café text.\n'
        payload = source.encode()
        grants = []
        for filename in ['Meeting café #1.txt', 'Second.txt']:
            status, grant, _ = self.call(client, '/api/uploads/authorize',
                                         {'filename': filename, 'size_bytes': len(payload)})
            self.assertEqual(status, 200)
            with urlopen(Request(grant['upload_url'], method='PUT', data=payload, headers=grant['headers'])) as response:
                self.assertEqual(response.status, 201)
            self.assertEqual((self.audio_dir / filename).read_bytes(), payload)
            self.assertEqual(self.call(client, '/api/uploads/complete', {'run_id': grant['run']['run_id']})[0], 200)
            grants.append(grant)
        from src import database
        ids = [grant['run']['run_id'] for grant in grants]
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            rows = [database.upload_record(self.database_path, 'austin', run_id) for run_id in ids]
            if all(row['transcription_stage'] == 'queued' for row in rows):
                break
            time.sleep(.02)
        else:
            self.fail(f'Jobs were not queued: {rows}')
        job_ids = [row['speech_job_id'] for row in rows]
        self.assertEqual(len(set(job_ids)), 2)
        self.server.terminate()
        self.server.wait(timeout=8)
        type(self).start_server()
        self.call(client, '/api/auth/sign-in', {'access_key': 'austin'})
        seen = set()
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            status, runs, _ = self.call(client, '/api/runs')
            self.assertEqual(status, 200)
            seen.update(run['transcription_stage'] for run in runs)
            if all(run['transcription_stage'] == 'completed' for run in runs):
                break
            time.sleep(.02)
        else:
            self.fail(f'Jobs did not complete: {runs}')
        self.assertIn('running', seen)
        for run_id, job_id in zip(ids, job_ids):
            row = database.upload_record(self.database_path, 'austin', run_id)
            self.assertEqual(row['speech_job_id'], job_id)
            self.assertEqual(row['speech_status'], 'Succeeded')
            self.assertEqual(row['transcript_text'], source + '\nThis sentence was appended by the mock Speech service.')
            status, result, _ = self.call(client, f'/api/runs/{run_id}/transcript')
            self.assertEqual(status, 200)
            self.assertEqual(result['transcript_text'], row['transcript_text'])
