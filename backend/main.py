import asyncio
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src import database, processing
from api.auth import router as auth_router
from api.runs import router as runs_router
from api.uploads import router as uploads_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop = threading.Event()
    wake = asyncio.Event()
    worker = asyncio.create_task(processing.run_worker(app.state.database_path, stop, wake))
    try:
        yield
    finally:
        stop.set()
        wake.set()
        await worker


app = FastAPI(lifespan=lifespan)
app.state.database_path = database.configured_database_path()
app.include_router(auth_router)
app.include_router(runs_router)
app.include_router(uploads_router)


@app.exception_handler(HTTPException)
async def http_error(request: Request, error: HTTPException):
    return JSONResponse(
        status_code=error.status_code,
        content={"error": {
            "code": {401: "unauthorized", 404: "not_found", 409: "conflict"}.get(error.status_code, "http_error"),
            "message": str(error.detail),
        }},
        headers={"Cache-Control": "no-store"},
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": "Invalid request parameters or body."}},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/health")
def health():
    return {"status": "OK!"}
