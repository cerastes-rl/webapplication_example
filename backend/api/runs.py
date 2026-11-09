"""Authenticated, read-only run API backed by the accepted SQLite schema."""

from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path as PathParameter, Query, Request, Response
from pydantic import BaseModel

from src import database
from api.auth import User, get_current_user

router = APIRouter(prefix="/api/runs", tags=["runs"])
CurrentUser = Annotated[User, Depends(get_current_user)]
RunId = Annotated[int, PathParameter(gt=0, le=9_223_372_036_854_775_807)]


class RunResponse(BaseModel):
    run_id: int
    filename: str
    size_bytes: int | None
    language: str
    requested_speakers: int | None
    include_speaker_labels: bool
    include_timestamps: bool
    status: Literal[
        "uploading", "queued", "submitting", "processing", "importing",
        "completed", "failed", "cancelled", "submission_uncertain",
    ]
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class TranscriptResponse(BaseModel):
    run_id: int
    transcript_text: str


def database_path(request: Request) -> Path:
    return request.app.state.database_path


DatabasePath = Annotated[Path, Depends(database_path)]


@router.get("", response_model=list[RunResponse])
def list_runs(
    user: CurrentUser, path: DatabasePath, response: Response,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=9_223_372_036_854_775_807)] = 0,
):
    response.headers["Cache-Control"] = "no-store"
    return database.list_runs(path, user.id, limit, offset)


@router.get("/{run_id}/transcript", response_model=TranscriptResponse)
def get_transcript(run_id: RunId, user: CurrentUser, path: DatabasePath, response: Response):
    run = database.get_transcript(path, user.id, run_id)
    if run is None:
        raise HTTPException(404, "Run not found.")
    if run["status"] != "completed" or run["transcript_text"] is None:
        raise HTTPException(409, "Transcript is not available yet.")
    response.headers["Cache-Control"] = "no-store"
    return {"run_id": run_id, "transcript_text": run["transcript_text"]}
