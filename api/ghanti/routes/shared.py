"""Bits the teacher and parent routes both need."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..llm import LLMError, Message as LLMMessage
from ..models import Action, Turn, iso

HISTORY_TURNS = 8


def history(db: Session, conversation_id: int) -> list[LLMMessage]:
    turns = (db.query(Turn).filter_by(conversation_id=conversation_id)
             .order_by(Turn.id.desc()).limit(HISTORY_TURNS).all())
    return [LLMMessage(role=t.role, text=t.text) for t in reversed(turns)]


def action_json(a: Action) -> dict:
    return {"id": a.id, "kind": a.kind, "title": a.title, "lines": a.lines, "status": a.status}


def turn_json(db: Session, t: Turn) -> dict:
    actions = db.query(Action).filter(Action.id.in_(t.action_ids)).all() if t.action_ids else []
    return {"id": t.id, "role": t.role, "text": t.text,
            "audio_url": f"/api/audio/{t.audio_key}" if t.audio_key else None,
            "trace": t.trace, "actions": [action_json(a) for a in actions],
            "created_at": iso(t.created_at)}


def llm_failed(e: LLMError) -> HTTPException:
    return HTTPException(502, f"The assistant couldn't think just now. {e}")


def said(text: str | None) -> str:
    text = (text or "").strip()
    if not text:
        raise HTTPException(422, "Say or type something first.")
    return text[:2000]
