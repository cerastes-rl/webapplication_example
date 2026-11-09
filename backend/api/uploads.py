"""Create upload records and verify bytes without proxying the file body."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field, field_validator

from api.runs import CurrentUser, DatabasePath, RunId, RunResponse
from src import database, storage_client

router = APIRouter(prefix='/api', tags=['uploads'])


class AuthorizeUpload(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0, le=storage_client.MAX_UPLOAD_BYTES)
    language: Literal['en-US'] = 'en-US'
    requested_speakers: int | None = Field(default=None, ge=1, le=10)
    include_speaker_labels: bool = True
    include_timestamps: bool = True

    @field_validator('filename')
    @classmethod
    def text_fixture(cls, filename: str) -> str:
        if (filename.startswith('.') or '/' in filename or '\\' in filename
                or len(filename.encode('utf-8')) > 255
                or any(ord(char) < 32 or ord(char) == 127 for char in filename)):
            raise ValueError('Use a plain filename without directory separators or control characters.')
        if not filename.lower().endswith('.txt'):
            raise ValueError('Select a TXT mock file.')
        return filename


class UploadAuthorization(BaseModel):
    run: RunResponse
    upload_url: str
    headers: dict[str, str]


class CompleteUpload(BaseModel):
    run_id: int = Field(gt=0, le=9_223_372_036_854_775_807)


@router.post('/uploads/authorize', response_model=UploadAuthorization)
def authorize(body: AuthorizeUpload, user: CurrentUser, path: DatabasePath, response: Response):
    run = database.create_upload(path, user.id, body.model_dump())
    response.headers['Cache-Control'] = 'no-store'
    return {'run': run, 'upload_url': storage_client.blob_url(run['storage_key'], public=True),
            'headers': {'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'text/plain'}}


@router.post('/uploads/complete', response_model=RunResponse)
def complete(body: CompleteUpload, user: CurrentUser, path: DatabasePath, response: Response):
    run = database.upload_record(path, user.id, body.run_id)
    if run['upload_stage'] == 'cancelled':
        raise HTTPException(409, 'This upload was cancelled. Select the file to start a new run.')
    if run['upload_stage'] in ('uploading', 'failed'):
        size = storage_client.inspect_or_delete(run['storage_key'], 'HEAD')
        if size is None:
            raise HTTPException(409, 'No stored file yet. Reselect the file to start another upload.')
        if size != run['size_bytes']:
            raise HTTPException(409, 'Stored file size does not match. Select the file again.')
        run = database.update_upload(path, user.id, body.run_id, 'completed')
        if run['upload_stage'] == 'cancelled':
            raise HTTPException(409, 'This upload was cancelled.')
    response.headers['Cache-Control'] = 'no-store'
    return run


@router.post('/runs/{run_id}/cancel', response_model=RunResponse)
def cancel(run_id: RunId, user: CurrentUser, path: DatabasePath, response: Response):
    run = database.update_upload(path, user.id, run_id, 'cancelled')
    if run['upload_stage'] != 'cancelled':
        raise HTTPException(409, 'The upload is already completed. Upload cancellation is no longer available.')
    storage_client.inspect_or_delete(run['storage_key'], 'DELETE')
    response.headers['Cache-Control'] = 'no-store'
    return run


@router.post('/runs/{run_id}/upload-failed', response_model=RunResponse)
def failed(run_id: RunId, user: CurrentUser, path: DatabasePath, response: Response):
    run = database.update_upload(path, user.id, run_id, 'failed')
    response.headers['Cache-Control'] = 'no-store'
    return run
