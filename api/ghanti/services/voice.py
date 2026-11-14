"""Hearing and speaking, with a cache and a daily cap wrapped around the speech adapter."""
import hashlib

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import config
from ..models import Audio, Usage, User
from ..speech import SpeechError, get_speech

MAX_CLIP_BYTES = 2_000_000  # 30s of 16 kHz mono WAV is about 1 MB


def _spend(db: Session, user: User) -> None:
    """Count one real speech call. Mock calls are free and not counted."""
    if config.SPEECH_MODE != "gnani":
        return
    day = config.today()
    rows = db.query(Usage).filter_by(day=day).all()
    mine = next((r for r in rows if r.user_id == user.id), None)
    if sum(r.count for r in rows) >= config.VOICE_CAP_TOTAL or (mine and mine.count >= config.VOICE_CAP_PER_USER):
        raise HTTPException(429, "Today's voice limit for the demo is used up. Typing still works.")
    if mine is None:
        mine = Usage(day=day, user_id=user.id, count=0)
        db.add(mine)
    mine.count += 1
    db.commit()


def listen(db: Session, user: User, clip: UploadFile, languages: list[str], keyterms: list[str]) -> str:
    audio = clip.file.read(MAX_CLIP_BYTES + 1)
    if len(audio) > MAX_CLIP_BYTES:
        raise HTTPException(413, "That recording is too long. Keep it under 30 seconds.")
    _spend(db, user)
    try:
        text = get_speech().transcribe(audio, clip.filename or "clip.wav", languages, keyterms).text
    except SpeechError as e:
        raise HTTPException(502, str(e))
    if not text:
        raise HTTPException(422, "Couldn't hear anything. Try again a little closer to the mic.")
    return text


def audio_key(text: str, language: str) -> str:
    """Register text to be spoken and return its key. The audio itself is made on first play."""
    return hashlib.sha256(f"{get_speech().name}|{language}|{text}".encode()).hexdigest()


def remember(db: Session, text: str, language: str) -> str:
    key = audio_key(text, language)
    if db.get(Audio, key) is None:
        db.add(Audio(key=key, text=text, language=language))
        db.commit()
    return key


def play(db: Session, user: User, key: str) -> bytes:
    row = db.get(Audio, key)
    if row is None:
        raise HTTPException(404, "No such audio.")
    if row.data is None:
        _spend(db, user)
        try:
            row.data = get_speech().synthesize(row.text, row.language)
        except SpeechError as e:
            raise HTTPException(502, str(e))
        db.commit()
    return row.data
