"""Application/SQLite and standalone storage tested together over real HTTP."""

import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, urlopen
from urllib.parse import unquote

from test_auth import ApiTestCase


class UploadTests(ApiTestCase):
    @classmethod
    def setUpClass(cls):
        cls.storage_dir = tempfile.TemporaryDirectory()
        cls.storage_logs = tempfile.TemporaryFile()
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            storage_port = listener.getsockname()[1]
        cls.storage_base = f'http://127.0.0.1:{storage_port}'
        cls.storage_server = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'services.storage_mock:app', '--host', '127.0.0.1',
             '--port', str(storage_port), '--log-level', 'warning', '--no-access-log'],
            cwd=Path(__file__).resolve().parents[2], stdout=cls.storage_logs, stderr=cls.storage_logs,
            env={**os.environ, 'SSSCRIBE_STORAGE_DIR': cls.storage_dir.name, 'SSSCRIBE_STORAGE_MAX_BYTES': '1000000'},
        )
        for _ in range(100):
            try:
                with urlopen(cls.storage_base + '/openapi.json', timeout=2):
                    break
            except URLError:
                time.sleep(.05)
        else:
            raise RuntimeError('Storage did not start')
        cls.api_env = {'SSSCRIBE_STORAGE_URL': cls.storage_base, 'SSSCRIBE_STORAGE_PUBLIC_URL': cls.storage_base}
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        try:
            super().tearDownClass()
        finally:
            cls.storage_server.terminate()
            cls.storage_server.wait(timeout=5)
            cls.storage_logs.close()
            cls.storage_dir.cleanup()

    def setUp(self):
        for file in Path(self.storage_dir.name).iterdir():
            file.unlink()

    def sign_in(self, owner='austin'):
        client, _ = self.client()
        self.assertEqual(self.call(client, '/api/auth/sign-in', {'access_key': owner})[0], 200)
        return client

    def authorize(self, client, **changes):
        body = {'filename': 'fixture.txt', 'size_bytes': 5,
                'requested_speakers': 2, 'include_speaker_labels': False, **changes}
        status, grant, _ = self.call(client, '/api/uploads/authorize', body)
        self.assertEqual(status, 200, grant)
        return body, grant

    def put(self, grant, body=b'hello'):
        with urlopen(Request(grant['upload_url'], data=body, method='PUT', headers=grant['headers']), timeout=2) as response:
            self.assertEqual(response.status, 201)

    def complete(self, client, grant):
        return self.call(client, '/api/uploads/complete', {'run_id': grant['run']['run_id']})

    def test_each_submission_creates_a_new_owned_run(self):
        client = self.sign_in()
        body, grant = self.authorize(client)
        second = self.call(client, '/api/uploads/authorize', body)[1]
        self.assertNotEqual(second['run']['run_id'], grant['run']['run_id'])
        self.assertEqual(second['upload_url'], grant['upload_url'])
        self.assertEqual(grant['run']['upload_stage'], 'uploading')
        self.assertNotIn('storage_key', grant['run'])
        john = self.sign_in('john')
        self.assertNotIn(grant['run']['run_id'], [run['run_id'] for run in self.call(john, '/api/runs')[1]])
        for route, request in [('/api/uploads/complete', {'run_id': grant['run']['run_id']}),
                               (f'/api/runs/{grant["run"]["run_id"]}/cancel', {}),
                               (f'/api/runs/{grant["run"]["run_id"]}/upload-failed', {})]:
            self.assertEqual(self.call(john, route, request)[0], 404)
        self.assertEqual(self.call(john, '/api/uploads/authorize', body)[0], 200)

    def test_real_put_head_completion_and_duplicate_completion(self):
        client = self.sign_in()
        _, grant = self.authorize(client, filename='Meeting notes café #1.txt')
        self.put(grant)
        status, run, _ = self.complete(client, grant)
        self.assertEqual(status, 200)
        self.assertEqual(run['upload_stage'], 'completed')
        self.assertEqual(run['transcription_stage'], 'not_started')
        self.assertEqual(run['requested_speakers'], 2)
        self.assertFalse(run['include_speaker_labels'])
        self.assertEqual(self.complete(client, grant)[1], run)
        self.assertEqual(self.call(client, f'/api/runs/{run["run_id"]}/upload-failed', {})[1]['transcription_stage'], 'not_started')
        self.assertEqual(self.call(client, f'/api/runs/{run["run_id"]}/cancel', {})[0], 409)
        key = unquote(grant['upload_url'].rsplit('/', 1)[1])
        self.assertEqual(key, 'Meeting notes café #1.txt')
        self.assertEqual((Path(self.storage_dir.name) / key).read_bytes(), b'hello')

    def test_missing_wrong_size_and_failed_upload_reconciliation(self):
        client = self.sign_in()
        _, grant = self.authorize(client)
        self.assertEqual(self.complete(client, grant)[0], 409)
        self.put(grant, b'no')
        self.assertEqual(self.complete(client, grant)[0], 409)
        run_id = grant['run']['run_id']
        failed = self.call(client, f'/api/runs/{run_id}/upload-failed', {})[1]
        self.assertEqual((failed['upload_stage'], failed['transcription_stage']), ('failed', 'not_started'))
        self.put(grant)
        self.assertEqual(self.complete(client, grant)[1]['transcription_stage'], 'not_started')

    def test_cancel_is_persisted_repeated_and_cannot_complete(self):
        client = self.sign_in()
        _, grant = self.authorize(client)
        self.put(grant)
        route = f'/api/runs/{grant["run"]["run_id"]}/cancel'
        for _ in range(2):
            self.assertEqual(self.call(client, route, {})[1]['upload_stage'], 'cancelled')
        self.assertEqual(self.complete(client, grant)[0], 409)
        with self.assertRaises(HTTPError) as error:
            urlopen(Request(grant['upload_url'], method='HEAD'), timeout=2)
        self.assertEqual(error.exception.code, 404)
        error.exception.close()
        # Even a late PUT cannot resurrect a cancelled SQL run.
        self.put(grant)
        self.assertEqual(self.complete(client, grant)[0], 409)
        self.call(client, route, {})

    def test_restart_after_put_recovers_lost_completion(self):
        client = self.sign_in()
        body, grant = self.authorize(client)
        self.put(grant)
        self.server.terminate()
        self.server.wait(timeout=5)
        type(self).start_server()
        self.assertEqual(self.complete(client, grant)[0], 401)
        client = self.sign_in()
        rows = self.call(client, '/api/runs')[1]
        self.assertIn(grant['run']['run_id'], [run['run_id'] for run in rows])
        self.assertEqual(self.complete(client, grant)[1]['transcription_stage'], 'not_started')

    def test_authentication_and_txt_policy(self):
        unsigned = build_opener()
        self.assertEqual(self.call(unsigned, '/api/uploads/authorize', {})[0], 401)
        self.assertEqual(self.call(unsigned, '/api/uploads/complete', {'run_id': 1})[0], 401)
        for suffix in ['cancel', 'upload-failed']:
            self.assertEqual(self.call(unsigned, f'/api/runs/1/{suffix}', {})[0], 401)
        client = self.sign_in()
        for changes in [{'size_bytes': 0}, {'size_bytes': 1000001}, {'filename': 'audio.wav'},
                        {'filename': '../outside.txt'}, {'filename': 'folder\\file.txt'},
                        {'requested_speakers': 11}, {'language': 'fr-FR'}]:
            body = {'filename': 'fixture.txt', 'size_bytes': 5, **changes}
            self.assertEqual(self.call(client, '/api/uploads/authorize', body)[0], 422)
        self.authorize(client, size_bytes=1000000)


    def test_storage_outage_retains_run_for_later_completion(self):
        client = self.sign_in()
        _, grant = self.authorize(client)
        self.put(grant)
        self.storage_server.terminate()
        self.storage_server.wait(timeout=5)
        try:
            status, body, _ = self.complete(client, grant)
            self.assertEqual(status, 503)
            self.assertIn('Start the storage mock', body['error']['message'])
            rows = self.call(client, '/api/runs')[1]
            self.assertEqual(next(run for run in rows if run['run_id'] == grant['run']['run_id'])['upload_stage'], 'uploading')
        finally:
            type(self).storage_server = subprocess.Popen(
                self.storage_server.args, cwd=Path(__file__).resolve().parents[2],
                stdout=self.storage_logs, stderr=self.storage_logs,
                env={**os.environ, 'SSSCRIBE_STORAGE_DIR': self.storage_dir.name, 'SSSCRIBE_STORAGE_MAX_BYTES': '1000000'},
            )
            for _ in range(100):
                try:
                    with urlopen(self.storage_base + '/openapi.json', timeout=2):
                        break
                except URLError:
                    time.sleep(.05)
            else:
                raise RuntimeError('Storage did not restart')
        self.assertEqual(self.complete(client, grant)[1]['transcription_stage'], 'not_started')
