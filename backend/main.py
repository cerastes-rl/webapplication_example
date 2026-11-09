from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from auth import router as auth_router

app = FastAPI()
app.include_router(auth_router)


@app.exception_handler(HTTPException)
async def http_error(request: Request, error: HTTPException):
    return JSONResponse(
        status_code=error.status_code,
        content={"error": {"code": "unauthorized" if error.status_code == 401 else "http_error", "message": str(error.detail)}},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/health")
def health():
    return {"status": "OK!"}
