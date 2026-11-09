"""Real-HTTP checks for the small Azure-style storage interface."""

import http.client
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class StorageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.root = Path(cls.directory.name)
        cls.logs = tempfile.TemporaryFile()
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            cls.port = listener.getsockname()[1]
        cls.base = f'http://127.0.0.1:{cls.port}'
        cls.start_server()

    @classmethod
    def start_server(cls):
        cls.server = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'services.storage_mock:app', '--host', '127.0.0.1',
             '--port', str(cls.port), '--log-level', 'warning', '--no-access-log'],
            cwd=Path(__file__).resolve().parents[2], stdout=cls.logs, stderr=cls.logs,
            env={**os.environ, 'SSSCRIBE_STORAGE_DIR': str(cls.root), 'SSSCRIBE_STORAGE_MAX_BYTES': '16'},
        )
        for _ in range(100):
            try:
                if cls.call('/openapi.json')[0] == 200:
                    return
            except URLError:
                time.sleep(.05)
        cls.server.terminate()
        cls.server.wait(timeout=5)
        cls.logs.seek(0)
        raise RuntimeError(cls.logs.read().decode())

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        cls.server.wait(timeout=5)
        cls.logs.close()
        cls.directory.cleanup()

    @classmethod
    def call(cls, path, method='GET', body=None, headers=None):
        request = Request(cls.base + path, data=body, method=method, headers=headers or {})
        try:
            response = urlopen(request, timeout=2)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.read(), response.headers

    def put(self, name, body):
        return self.call('/blobs/' + name, 'PUT', body,
                         {'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'text/plain'})

    def test_put_head_overwrite_and_delete(self):
        payload = b'example text\n'
        status, body, headers = self.put('example.txt', payload)
        self.assertEqual((status, body), (201, b''))
        self.assertEqual((self.root / 'example.txt').read_bytes(), payload)
        status, body, head = self.call('/blobs/example.txt', 'HEAD')
        self.assertEqual((status, body), (200, b''))
        self.assertEqual(head['Content-Length'], str(len(payload)))
        self.assertEqual(head['ETag'], headers['ETag'])
        self.assertEqual(head['Last-Modified'], headers['Last-Modified'])
        self.assertEqual(head['x-ms-blob-type'], 'BlockBlob')
        self.assertEqual(self.put('example.txt', b'replacement')[0], 201)
        self.assertEqual((self.root / 'example.txt').read_bytes(), b'replacement')
        self.assertEqual(self.call('/blobs/example.txt', 'DELETE')[:2], (202, b''))
        for method in ['HEAD', 'DELETE']:
            status, body, headers = self.call('/blobs/example.txt', method)
            self.assertEqual(status, 404)
            self.assertEqual(headers['x-ms-error-code'], 'BlobNotFound')
            if method == 'HEAD':
                self.assertEqual(body, b'')

    def test_size_limit_and_failed_overwrite_preserve_existing_bytes(self):
        self.assertEqual(self.put('limit.txt', b'x' * 16)[0], 201)
        status, body, headers = self.put('limit.txt', b'x' * 17)
        self.assertEqual(status, 413)
        self.assertEqual(headers['x-ms-error-code'], 'RequestBodyTooLarge')
        self.assertIn(b'<Code>RequestBodyTooLarge</Code>', body)
        self.assertEqual((self.root / 'limit.txt').read_bytes(), b'x' * 16)
        self.assertEqual(list(self.root.glob('.*.partial')), [])
        self.assertEqual(self.put('empty.txt', b'')[0], 201)

    def test_required_headers_safe_names_and_no_get_route(self):
        self.assertEqual(self.call('/blobs/header.txt', 'PUT', b'text')[0], 400)
        self.assertEqual(self.put('..hidden', b'text')[0], 400)
        self.assertEqual(self.call('/blobs/../outside.txt', 'HEAD')[0], 404)
        self.assertFalse((self.root.parent / 'outside.txt').exists())
        self.assertEqual(self.call('/blobs/header.txt')[0], 405)
        self.assertEqual(self.call('/internal/uploads', 'POST', b'{}')[0], 404)
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=2)
        try:
            connection.request('PUT', '/blobs/chunked.txt', body=iter([b'text']),
                               headers={'x-ms-blob-type': 'BlockBlob'}, encode_chunked=True)
            response = connection.getresponse()
            self.assertEqual(response.status, 411, response.read())
        finally:
            connection.close()

    def test_disconnect_cleans_partial_and_restart_preserves_blobs(self):
        self.put('persistent.txt', b'kept')
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=2)
        connection.putrequest('PUT', '/blobs/interrupted.txt')
        connection.putheader('Content-Length', '8')
        connection.putheader('x-ms-blob-type', 'BlockBlob')
        connection.endheaders()
        connection.send(b'half')
        for _ in range(50):
            if list(self.root.glob('.*.partial')):
                break
            time.sleep(.02)
        else:
            self.fail('Upload never started')
        connection.close()
        for _ in range(50):
            if not list(self.root.glob('.*.partial')):
                break
            time.sleep(.02)
        self.assertEqual(list(self.root.glob('.*.partial')), [])
        self.assertFalse((self.root / 'interrupted.txt').exists())
        self.server.terminate()
        self.server.wait(timeout=5)
        (self.root / '.abandoned.partial').write_bytes(b'partial')
        type(self).start_server()
        self.assertEqual(self.call('/blobs/persistent.txt', 'HEAD')[0], 200)
        self.assertEqual((self.root / 'persistent.txt').read_bytes(), b'kept')
        self.assertFalse((self.root / '.abandoned.partial').exists())

    def test_browser_cors(self):
        status, _, headers = self.call('/blobs/example.txt', 'OPTIONS', headers={
            'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'PUT',
            'Access-Control-Request-Headers': 'Content-Type,x-ms-blob-type',
        })
        self.assertEqual(status, 200)
        self.assertEqual(headers['Access-Control-Allow-Origin'], 'http://localhost:5173')
