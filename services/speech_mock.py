"""Single-worker Speech mock using backend-local text files; outputs never expire."""

import asyncio
import json
import logging
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from pathlib import Path
from time import monotonic
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

QUEUED_SECONDS = 10
PROCESSING_SECONDS = 20
RETENTION_SECONDS = 30 * 60
BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
BLOB_DIR = BACKEND_DIR / "data" / "blobs"
MAX_TEXT_BYTES = 1_000_000
APPENDED_SENTENCE = "This sentence was appended by the mock Speech service."


def local_path(value: str) -> Path:
    # /data/... is a mock path relative to backend/, not the OS root.
    path = (BACKEND_DIR / value.lstrip("/")).resolve()
    if not path.is_relative_to(BLOB_DIR.resolve()):
        raise ValueError("Use a local path under data/blobs/.")
    return path


class Properties(BaseModel):
    destinationContainerUrl: str = Field(min_length=1)

    @field_validator("destinationContainerUrl")
    @classmethod
    def validate_destination(cls, value: str) -> str:
        local_path(value)
        return value


class Submission(BaseModel):
    displayName: str = Field(min_length=1)
    locale: str = "en-US"
    contentUrls: list[str] = Field(min_length=1, max_length=1)
    properties: Properties

    @field_validator("contentUrls")
    @classmethod
    def validate_sources(cls, values: list[str]) -> list[str]:
        for value in values:
            local_path(value)
        return values


@dataclass
class Job:
    submission: Submission
    started_at: float
    fail: bool
    status: str = "NotStarted"
    finished_at: float | None = None
    error: str | None = None


jobs: dict[str, Job] = {}
RESULT_FILES = {
    "contenturl_0.json": "Transcription",
    "report.json": "TranscriptionReport",
}


def result_path(job_id: str, job: Job, name: str) -> Path:
    return local_path(job.submission.properties.destinationContainerUrl) / job_id / name


def write_results(job_id: str, job: Job):
    with local_path(job.submission.contentUrls[0]).open("rb") as source_file:
        source = source_file.read(MAX_TEXT_BYTES + 1)
    if len(source) > MAX_TEXT_BYTES:
        raise ValueError("Source text exceeds the mock's 1 MB limit.")
    text = source.decode("utf-8") + "\n" + APPENDED_SENTENCE
    results = {
        "contenturl_0.json": {
            "source": job.submission.contentUrls[0],
            "combinedRecognizedPhrases": [{"channel": 0, "display": text}],
        },
        "report.json": {"successfulTranscriptionsCount": 1, "failedTranscriptionsCount": 0},
    }
    for name, data in results.items():
        path = result_path(job_id, job, name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")


async def advance(job_id: str, job: Job):
    if job.finished_at is not None:
        return
    elapsed = monotonic() - job.started_at
    if elapsed < QUEUED_SECONDS:
        return
    if elapsed < QUEUED_SECONDS + PROCESSING_SECONDS:
        job.status = "Running"
        return

    try:
        if job.fail:
            job.error = "Simulated transcription failure."
        else:
            await asyncio.to_thread(write_results, job_id, job)
    except (OSError, ValueError) as error:
        logging.exception("Could not process mock transcription %s", job_id)
        job.error = str(error)
    job.status = "Failed" if job.error else "Succeeded"
    job.finished_at = monotonic()


async def maintain_jobs():
    while True:
        for job_id, job in list(jobs.items()):
            await advance(job_id, job)
            if job.finished_at is not None and monotonic() - job.finished_at >= RETENTION_SECONDS:
                del jobs[job_id]
        await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    BLOB_DIR.mkdir(parents=True, exist_ok=True)
    task = asyncio.create_task(maintain_jobs())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Mock Speech Batch Service", lifespan=lifespan)
app.mount("/blobs", StaticFiles(directory=BLOB_DIR, check_dir=False), name="blobs")


def get_job(job_id: str) -> Job:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Transcription not found or expired")
    return job


def describe(job_id: str, job: Job, request: Request) -> dict:
    result = {
        "self": str(request.url_for("get_transcription", job_id=job_id)),
        "displayName": job.submission.displayName,
        "locale": job.submission.locale,
        "status": job.status,
        "links": {"files": str(request.url_for("list_files", job_id=job_id))},
    }
    if job.error:
        result["properties"] = {"error": {"code": "MockProcessingFailed", "message": job.error}}
    return result


@app.post("/speechtotext/transcriptions:submit", status_code=201)
async def submit(body: Submission, request: Request, response: Response, mock_fail: bool = False):
    job_id = str(uuid4())
    job = Job(body, monotonic(), mock_fail)
    jobs[job_id] = job
    result = describe(job_id, job, request)
    response.headers["Location"] = result["self"]
    return result


@app.get("/speechtotext/transcriptions/{job_id}")
async def get_transcription(job_id: str, request: Request):
    return describe(job_id, get_job(job_id), request)


@app.get("/speechtotext/transcriptions/{job_id}/files")
async def list_files(
    job_id: str,
    request: Request,
    skip: int = Query(0, ge=0),
    top: int = Query(100, ge=1, le=1000),
):
    job = get_job(job_id)
    if job.status != "Succeeded":
        raise HTTPException(409, "No successful transcription results available")
    files = list(RESULT_FILES.items())
    result = {"values": [
        {
            "name": name,
            "kind": kind,
            "links": {"contentUrl": str(request.url_for(
                "blobs", path=result_path(job_id, job, name).relative_to(BLOB_DIR.resolve()).as_posix()
            ))},
        }
        for name, kind in files[skip:skip + top]
    ]}
    if skip + top < len(files):
        result["@nextLink"] = str(request.url.include_query_params(skip=skip + top, top=top))
    return result
