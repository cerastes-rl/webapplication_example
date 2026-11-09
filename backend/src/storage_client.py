"""The application's small HTTP boundary to the standalone blob service."""

import os
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import HTTPException

MAX_UPLOAD_BYTES = 1_000_000


def blob_url(key: str, public: bool = False) -> str:
    base = os.environ.get('SSSCRIBE_STORAGE_URL', 'http://127.0.0.1:8001')
    if public:
        base = os.environ.get('SSSCRIBE_STORAGE_PUBLIC_URL', base)
    return f"{base.rstrip('/')}/blobs/{quote(key, safe='')}"


def inspect_or_delete(key: str, method: str) -> int | None:
    try:
        with urlopen(Request(blob_url(key), method=method), timeout=3) as response:
            return int(response.headers['Content-Length']) if method == 'HEAD' else None
    except HTTPError as error:
        error.close()
        if error.code == 404:
            return None
        raise HTTPException(503, 'Storage could not complete the request. Try again.') from error
    except (URLError, TimeoutError, OSError, ValueError, KeyError) as error:
        raise HTTPException(503, 'Cannot reach storage. Start the storage mock and try again.') from error
