from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session

from .. import config
from ..db import get_db
from ..llm import LLMError, get_llm
from ..models import SchoolClass, User
from ..services import reports, voice
from .auth import current_user

router = APIRouter(tags=["misc"])


@router.get("/health")
def health():
    return {"ok": True, "speech_mode": config.SPEECH_MODE, "models": config.GEMINI_MODELS}


@router.get("/audio/{key}")
def audio(key: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Spoken audio. Made by Timbre the first time someone presses play, served from the cache after."""
    return Response(voice.play(db, user, key), media_type="audio/mpeg",
                    headers={"Cache-Control": "private, max-age=86400"})


@router.get("/jobs/daily")
def daily(authorization: str = Header(""), db: Session = Depends(get_db)):
    """Vercel Cron hits this once a day: homework every school day, the weekly call on Saturday."""
    if not config.CRON_SECRET or authorization != f"Bearer {config.CRON_SECRET}":
        raise HTTPException(401, "Not allowed.")
    today = config.today()
    sent = {"homework": 0, "weekly": 0}
    try:
        llm = get_llm()
        for cls in db.query(SchoolClass).all():
            sent["homework"] += reports.send_homework(db, llm, cls)
            if today.weekday() == 5:
                sent["weekly"] += reports.send_weekly(db, llm, cls)
    except LLMError as e:
        raise HTTPException(502, str(e))
    return sent
