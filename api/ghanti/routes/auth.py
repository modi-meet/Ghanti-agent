"""Demo logins. No passwords: every account is synthetic and you pick one from a list."""
import os

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from itsdangerous import BadSignature, URLSafeSerializer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import config
from ..db import get_db
from ..models import Student, User

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE = "ghanti_session"
signer = URLSafeSerializer(config.SESSION_SECRET, salt="session")


def current_user(ghanti_session: str | None = Cookie(None), db: Session = Depends(get_db)) -> User:
    try:
        user = db.get(User, signer.loads(ghanti_session or ""))
    except BadSignature:
        user = None
    if user is None:
        raise HTTPException(401, "Please log in.")
    return user


def teacher_user(user: User = Depends(current_user)) -> User:
    if user.role != "teacher":
        raise HTTPException(403, "Teachers only.")
    return user


def parent_user(user: User = Depends(current_user)) -> User:
    if user.role != "parent":
        raise HTTPException(403, "Parents only.")
    return user


def _public(db: Session, u: User) -> dict:
    out = {"id": u.id, "name": u.name, "role": u.role, "language": u.language}
    if u.role == "parent":
        child = db.query(Student).filter_by(parent_id=u.id).first()
        out["child"] = child.name if child else ""
    return out


@router.get("/accounts")
def accounts(db: Session = Depends(get_db)):
    users = db.query(User).filter_by(demo=True).order_by(User.id).all()
    return [_public(db, u) for u in users]


class Login(BaseModel):
    user_id: int


@router.post("/login")
def login(body: Login, response: Response, db: Session = Depends(get_db)):
    user = db.get(User, body.user_id)
    if user is None or not user.demo:
        raise HTTPException(404, "No such demo account.")
    response.set_cookie(COOKIE, signer.dumps(user.id), httponly=True, samesite="lax",
                        secure=bool(os.getenv("VERCEL")), max_age=60 * 60 * 24 * 7)
    return _public(db, user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {**_public(db, user), "speech_mode": config.SPEECH_MODE}
