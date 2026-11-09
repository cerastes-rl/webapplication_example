"""Real-HTTP checks using only the standard library and existing runtime dependencies."""

import json
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener


class AuthTests(unittest.TestCase):
    @classmethod
    def start_server(cls):
        cls.server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1",
             "--port", str(cls.port), "--log-level", "warning"],
            cwd=Path(__file__).resolve().parents[1], stdout=cls.logs, stderr=cls.logs,
        )
        for _ in range(100):
            try:
                cls.call(build_opener(), "/api/health")
                return
            except URLError:
                time.sleep(.05)
        cls.server.terminate()
        cls.server.wait(timeout=5)
        raise RuntimeError("Auth API did not start")

    @classmethod
    def setUpClass(cls):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            cls.port = listener.getsockname()[1]
        cls.base = f"http://127.0.0.1:{cls.port}"
        cls.logs = tempfile.TemporaryFile()
        cls.start_server()

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        cls.server.wait(timeout=5)
        cls.logs.close()

    @classmethod
    def call(cls, client, path, body=None, method=None, headers=None):
        request = Request(
            cls.base + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json", **(headers or {})},
        )
        try:
            response = client.open(request, timeout=2)
        except HTTPError as error:
            response = error
        with response:
            data = response.read()
            return response.status, json.loads(data) if data else None, response.headers

    def client(self):
        jar = CookieJar()
        return build_opener(HTTPCookieProcessor(jar)), jar

    def test_health_and_signed_out_user(self):
        client, _ = self.client()
        self.assertEqual(self.call(client, "/api/health")[:2], (200, {"status": "OK!"}))
        status, body, _ = self.call(client, "/api/auth/me")
        self.assertEqual(status, 401)
        self.assertEqual(body["error"]["code"], "unauthorized")

    def test_both_users_have_independent_restorable_sessions(self):
        clients = []
        for key, name in [("austin", "Austin"), ("john", "John")]:
            client, jar = self.client()
            status, body, headers = self.call(client, "/api/auth/sign-in", {"access_key": key})
            self.assertEqual((status, body), (200, {"id": key, "name": name}))
            self.assertIn("HttpOnly", headers["Set-Cookie"])
            self.assertIn("SameSite=lax", headers["Set-Cookie"])
            self.assertEqual(headers["Cache-Control"], "no-store")
            self.assertNotEqual(next(iter(jar)).value, key)
            restored_client = build_opener(HTTPCookieProcessor(jar))
            self.assertEqual(self.call(restored_client, "/api/auth/me")[:2], (200, body))
            clients.append(client)
        self.assertEqual(self.call(clients[0], "/api/auth/me")[1]["id"], "austin")
        self.assertEqual(self.call(clients[1], "/api/auth/me")[1]["id"], "john")

    def test_invalid_key_and_validation(self):
        client, jar = self.client()
        for key in ["wrong", "Austin", " john", "austin "]:
            self.assertEqual(self.call(client, "/api/auth/sign-in", {"access_key": key})[0], 401)
        for body in [{}, {"access_key": ""}, {"access_key": "x" * 33}]:
            self.assertEqual(self.call(client, "/api/auth/sign-in", body)[0], 422)
        self.assertEqual(len(jar), 0)
        self.assertEqual(self.call(client, "/api/auth/me")[0], 401)

    def test_cookie_cannot_be_a_username_or_forged_token(self):
        for token in ["austin", "john", "made-up-token"]:
            status, _, _ = self.call(build_opener(), "/api/auth/me",
                                    headers={"Cookie": f"ssscribe_session={token}"})
            self.assertEqual(status, 401)

    def test_sign_out_revokes_token_and_is_repeatable(self):
        client, jar = self.client()
        self.call(client, "/api/auth/sign-in", {"access_key": "austin"})
        old_token = next(iter(jar)).value
        status, body, headers = self.call(client, "/api/auth/sign-out", method="POST")
        self.assertEqual((status, body), (204, None))
        self.assertIn("Max-Age=0", headers["Set-Cookie"])
        self.assertEqual(len(jar), 0)
        self.assertEqual(self.call(client, "/api/auth/me")[0], 401)
        self.assertEqual(self.call(build_opener(), "/api/auth/me",
                                   headers={"Cookie": f"ssscribe_session={old_token}"})[0], 401)
        self.assertEqual(self.call(client, "/api/auth/sign-out", method="POST")[0], 204)

    def test_reauthentication_revokes_old_session(self):
        client, jar = self.client()
        self.call(client, "/api/auth/sign-in", {"access_key": "austin"})
        old_token = next(iter(jar)).value
        self.call(client, "/api/auth/sign-in", {"access_key": "john"})
        self.assertEqual(self.call(client, "/api/auth/me")[1]["id"], "john")
        self.assertEqual(self.call(build_opener(), "/api/auth/me",
                                   headers={"Cookie": f"ssscribe_session={old_token}"})[0], 401)

    def test_restart_requires_sign_in(self):
        client, _ = self.client()
        self.call(client, "/api/auth/sign-in", {"access_key": "john"})
        self.server.terminate()
        self.server.wait(timeout=5)
        type(self).start_server()
        self.assertEqual(self.call(client, "/api/auth/me")[0], 401)


if __name__ == "__main__":
    unittest.main()
