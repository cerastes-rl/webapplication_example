"""Minimal local subset of Azure Blob Storage: Put Blob, HEAD and Delete Blob."""

import os
import re
from contextlib import asynccontextmanager
from email.utils import formatdate
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from starlette.requests import ClientDisconnect

ROOT = Path(os.environ.get('SSSCRIBE_STORAGE_DIR', Path(__file__).resolve().parents[1] / 'backend/data/storage'))
MAX_BYTES = int(os.environ.get('SSSCRIBE_STORAGE_MAX_BYTES', '1000000'))


@asynccontextmanager
async def lifespan(app: FastAPI):
    ROOT.mkdir(parents=True, exist_ok=True)
    for partial in ROOT.glob('.*.partial'):
        partial.unlink(missing_ok=True)
    yield


app = FastAPI(title='Mock Blob Storage', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('SSSCRIBE_STORAGE_UI_ORIGINS', 'http://localhost:5173').split(','),
    allow_methods=['PUT', 'HEAD', 'DELETE'],
    allow_headers=['Content-Type', 'x-ms-blob-type', 'x-ms-version', 'x-ms-date'],
    expose_headers=['ETag', 'Last-Modified', 'x-ms-blob-type', 'x-ms-error-code'],
)


def blob_path(name: str) -> Path:
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,254}', name):
        raise HTTPException(400, 'InvalidResourceName')
    return ROOT / name


def properties(path: Path) -> dict:
    try:
        stat = path.stat()
    except FileNotFoundError:
        raise HTTPException(404, 'BlobNotFound') from None
    return {'Content-Length': str(stat.st_size), 'ETag': f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"',
            'Last-Modified': formatdate(stat.st_mtime, usegmt=True), 'x-ms-blob-type': 'BlockBlob'}


@app.exception_handler(HTTPException)
async def blob_error(request: Request, error: HTTPException):
    body = '' if request.method == 'HEAD' else f'<Error><Code>{error.detail}</Code></Error>'
    return Response(body, status_code=error.status_code, media_type='application/xml',
                    headers={'x-ms-error-code': str(error.detail)})


@app.put('/blobs/{name}', status_code=201)
async def put_blob(name: str, request: Request):
    path = blob_path(name)
    if request.headers.get('x-ms-blob-type') != 'BlockBlob':
        raise HTTPException(400, 'InvalidHeaderValue')
    try:
        expected = int(request.headers['content-length'])
    except KeyError:
        raise HTTPException(411, 'MissingContentLengthHeader') from None
    except ValueError:
        raise HTTPException(400, 'InvalidHeaderValue') from None
    if expected < 0:
        raise HTTPException(400, 'InvalidHeaderValue')
    if expected > MAX_BYTES:
        raise HTTPException(413, 'RequestBodyTooLarge')
    partial = ROOT / f'.{uuid4()}.partial'
    received = 0
    try:
        with partial.open('wb') as file:
            async for chunk in request.stream():
                received += len(chunk)
                if received > MAX_BYTES or received > expected:
                    raise HTTPException(413, 'RequestBodyTooLarge')
                await run_in_threadpool(file.write, chunk)
        if received != expected:
            raise HTTPException(400, 'InvalidHeaderValue')
        await run_in_threadpool(partial.replace, path)
    except ClientDisconnect:
        raise HTTPException(400, 'InvalidHeaderValue') from None
    finally:
        partial.unlink(missing_ok=True)
    headers = properties(path)
    headers.pop('Content-Length')
    return Response(status_code=201, headers=headers)


@app.head('/blobs/{name}')
def head_blob(name: str):
    return Response(headers=properties(blob_path(name)))


@app.delete('/blobs/{name}', status_code=202)
def delete_blob(name: str):
    try:
        blob_path(name).unlink()
    except FileNotFoundError:
        raise HTTPException(404, 'BlobNotFound') from None
    return Response(status_code=202)
