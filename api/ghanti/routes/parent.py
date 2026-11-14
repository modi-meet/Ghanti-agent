from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import config
from ..agent.loop import run_turn
from ..agent.parent_tools import PARENT_TOOLS, get_attendance, get_fee_status
from ..agent.prompts import parent_prompt
from ..agent.registry import ToolContext
from ..db import get_db
from ..llm import LLMError, get_llm
from ..models import Conversation, Homework, Message, Student, Turn, User, iso
from ..services import reports, voice
from .auth import parent_user
from .shared import history, llm_failed, said, turn_json

router = APIRouter(prefix="/parent", tags=["parent"])


def _child(db: Session, user: User) -> Student:
    child = db.query(Student).filter_by(parent_id=user.id).first()
    if child is None:
        raise HTTPException(404, "No student is linked to this account.")
    return child


def _message_json(m: Message) -> dict:
    return {"id": m.id, "kind": m.kind, "title": m.title, "script": m.script, "heard": m.heard,
            "audio_url": f"/api/audio/{m.audio_key}", "created_at": iso(m.created_at)}


@router.get("/home")
def home(user: User = Depends(parent_user), db: Session = Depends(get_db)):
    child = _child(db, user)
    today = config.today()
    ctx = ToolContext(db=db, user=user, today=today, student=child)
    messages = db.query(Message).filter_by(parent_id=user.id).order_by(Message.id.desc()).limit(20).all()
    homework = (db.query(Homework).filter(Homework.class_id == child.class_id,
                                          Homework.assigned_date >= today - timedelta(days=3))
                .order_by(Homework.assigned_date.desc()).all())
    return {
        "child": {"name": child.name, "class": child.school_class.name, "roll_no": child.roll_no},
        "teacher": db.get(User, child.school_class.teacher_id).name,
        "messages": [_message_json(m) for m in messages],
        "homework": [{"id": h.id, "subject": h.subject, "task": h.task,
                      "assigned_date": h.assigned_date.isoformat(), "due_date": h.due_date.isoformat()} for h in homework],
        "attendance": get_attendance(ctx, {"days": 7}),
        "fees": get_fee_status(ctx, {})["fees"],
    }


class StartCall(BaseModel):
    message_id: int | None = None


@router.post("/calls")
def start_call(body: StartCall, user: User = Depends(parent_user), db: Session = Depends(get_db)):
    """Pick up a call. With a message_id the call opens with that message, then the parent can ask things."""
    convo = Conversation(user_id=user.id, kind="parent", message_id=body.message_id)
    db.add(convo)
    db.flush()
    opening = None
    if body.message_id is not None:
        msg = db.get(Message, body.message_id)
        if msg is None or msg.parent_id != user.id:
            raise HTTPException(404, "No such message.")
        msg.heard = True
        # Saved as the first turn so the agent knows what the parent just heard.
        opening = Turn(conversation_id=convo.id, role="assistant", text=msg.script, audio_key=msg.audio_key)
        db.add(opening)
    db.commit()
    return {"conversation_id": convo.id, "opening": turn_json(db, opening) if opening else None}


def _own_call(db: Session, user: User, call_id: int) -> Conversation:
    convo = db.get(Conversation, call_id)
    if convo is None or convo.user_id != user.id or convo.kind != "parent":
        raise HTTPException(404, "No such call.")
    return convo


@router.post("/calls/{call_id}/talk")
def talk(call_id: int, text: str | None = Form(None), audio: UploadFile | None = File(None),
         user: User = Depends(parent_user), db: Session = Depends(get_db)):
    convo = _own_call(db, user, call_id)
    child = _child(db, user)
    teacher = db.get(User, child.school_class.teacher_id)
    if audio is not None:
        terms = [child.name, child.name.split()[0], teacher.name, "homework", "fees", "attendance"]
        heard = voice.listen(db, user, audio, [user.language, "en-IN"], terms)
    else:
        heard = said(text)

    ctx = ToolContext(db=db, user=user, today=config.today(), student=child)
    try:
        reply = run_turn(get_llm(), parent_prompt(user, child, teacher, ctx.today), PARENT_TOOLS, ctx,
                         history(db, convo.id), heard)
    except LLMError as e:
        raise llm_failed(e)
    if not reply:
        raise HTTPException(502, "The assistant had nothing to say. Please ask again.")

    mine = Turn(conversation_id=convo.id, role="user", text=heard)
    theirs = Turn(conversation_id=convo.id, role="assistant", text=reply, trace=ctx.trace,
                  audio_key=voice.remember(db, reply, user.language))
    db.add_all([mine, theirs])
    db.commit()
    return {"user": turn_json(db, mine), "assistant": turn_json(db, theirs)}


@router.post("/calls/{call_id}/end")
def end_call(call_id: int, user: User = Depends(parent_user), db: Session = Depends(get_db)):
    """Hang up. The teacher gets a two-line summary if the parent said anything."""
    convo = _own_call(db, user, call_id)
    if not convo.ended:
        convo.ended = True
        db.commit()
        try:
            reports.summarise_call(db, get_llm(), convo, _child(db, user))
        except LLMError:
            pass  # the call itself went fine, a missing summary shouldn't fail the hang-up
    return {"ok": True}
