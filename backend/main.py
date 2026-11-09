from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from src import database
from api.auth import router as auth_router
from api.runs import router as runs_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.database_path = database.configured_database_path()
    await run_in_threadpool(database.initialize_database, app.state.database_path)
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(auth_router)
app.include_router(runs_router)


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
