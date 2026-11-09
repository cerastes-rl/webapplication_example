"""Local authentication for two fixed development users."""

from secrets import token_urlsafe
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/auth", tags=["auth"])
COOKIE_NAME = "ssscribe_session"
sessions: dict[str, str] = {}


class User(BaseModel):
    id: Literal["austin", "john"]
    name: str


USERS = {
    "austin": User(id="austin", name="Austin"),
    "john": User(id="john", name="John"),
}


class SignIn(BaseModel):
    access_key: str = Field(min_length=1, max_length=32)


def get_current_user(request: Request) -> User:
    user_id = sessions.get(request.cookies.get(COOKIE_NAME, ""))
    if user_id not in USERS:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return USERS[user_id]


@router.post("/sign-in", response_model=User)
def sign_in(body: SignIn, request: Request, response: Response):
    user = USERS.get(body.access_key)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid access key. Enter austin or john.")
    sessions.pop(request.cookies.get(COOKIE_NAME, ""), None)
    token = token_urlsafe(32)
    sessions[token] = user.id
    response.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax", path="/api")
    response.headers["Cache-Control"] = "no-store"
    return user


@router.get("/me", response_model=User)
def me(user: Annotated[User, Depends(get_current_user)], response: Response):
    response.headers["Cache-Control"] = "no-store"
    return user


@router.post("/sign-out", status_code=204)
def sign_out(request: Request, response: Response):
    sessions.pop(request.cookies.get(COOKIE_NAME, ""), None)
    response.delete_cookie(COOKIE_NAME, path="/api", httponly=True, samesite="lax")
    response.headers["Cache-Control"] = "no-store"
