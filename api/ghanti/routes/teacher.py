from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import config
from ..agent.common import school_days
from ..agent.loop import run_turn
from ..agent.prompts import teacher_prompt
from ..agent.registry import ToolContext
from ..agent.teacher_tools import TEACHER_TOOLS
from ..db import get_db
from ..llm import LLMError, get_llm
from ..models import Action, Attendance, Conversation, Fee, Homework, InboxItem, Note, SchoolClass, Student, Turn, User, iso
from ..seed import reset_db
from ..services import actions, reports, voice
from .auth import teacher_user
from .shared import history, llm_failed, said, turn_json

router = APIRouter(prefix="/teacher", tags=["teacher"])

SUBJECTS = ["Maths", "Science", "Physics", "Chemistry", "Biology", "English", "Hindi", "Gujarati",
            "Social Science", "homework", "absent", "fees"]


def _classes(db: Session, user: User) -> list[SchoolClass]:
    return db.query(SchoolClass).filter_by(teacher_id=user.id).all()


def _students(db: Session, user: User) -> list[Student]:
    ids = [c.id for c in _classes(db, user)]
    return db.query(Student).filter(Student.class_id.in_(ids)).order_by(Student.roll_no).all()


def _own_student(db: Session, user: User, student_id: int) -> Student:
    s = db.get(Student, student_id)
    if s is None or s.school_class.teacher_id != user.id:
        raise HTTPException(404, "No such student.")
    return s


def _conversation(db: Session, user: User) -> Conversation:
    convo = db.query(Conversation).filter_by(user_id=user.id, kind="teacher").first()
    if convo is None:
        convo = Conversation(user_id=user.id, kind="teacher")
        db.add(convo)
        db.commit()
    return convo


# ---- chat: the tab that does everything ----

@router.get("/chat")
def chat_history(user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    convo = _conversation(db, user)
    turns = db.query(Turn).filter_by(conversation_id=convo.id).order_by(Turn.id.desc()).limit(40).all()
    return [turn_json(db, t) for t in reversed(turns)]


@router.post("/chat")
def chat(text: str | None = Form(None), audio: UploadFile | None = File(None),
         user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    classes = _classes(db, user)
    if audio is not None:
        # Roster names as key terms, so Prisma leans towards them over lookalike words.
        names = [s.name for s in _students(db, user)]
        heard = voice.listen(db, user, audio, ["en-IN", "hi-IN"], names + SUBJECTS)
    else:
        heard = said(text)

    convo = _conversation(db, user)
    ctx = ToolContext(db=db, user=user, today=config.today())
    try:
        reply = run_turn(get_llm(), teacher_prompt(user, classes, ctx.today), TEACHER_TOOLS, ctx,
                         history(db, convo.id), heard)
    except LLMError as e:
        raise llm_failed(e)
    reply = reply or ("Done." if ctx.action_ids else "Sorry, I didn't catch that. Could you say it again?")

    mine = Turn(conversation_id=convo.id, role="user", text=heard)
    theirs = Turn(conversation_id=convo.id, role="assistant", text=reply, trace=ctx.trace,
                  action_ids=ctx.action_ids, audio_key=voice.remember(db, reply, "hi-en"))
    db.add_all([mine, theirs])
    db.commit()
    return {"user": turn_json(db, mine), "assistant": turn_json(db, theirs)}


def _own_action(db: Session, user: User, action_id: int) -> Action:
    action = db.get(Action, action_id)
    if action is None or action.user_id != user.id:
        raise HTTPException(404, "No such action.")
    return action


@router.post("/actions/{action_id}/undo")
def undo_action(action_id: int, user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    action = _own_action(db, user, action_id)
    actions.undo(db, action)
    return {"id": action.id, "status": action.status}


@router.post("/actions/{action_id}/confirm")
def confirm_action(action_id: int, user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    action = _own_action(db, user, action_id)
    actions.confirm(db, action)
    return {"id": action.id, "status": action.status}


# ---- the tabs: look at what's there, fix by hand ----

@router.get("/overview")
def overview(user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    today = config.today()
    students = _students(db, user)
    ids = [s.id for s in students]
    class_ids = [c.id for c in _classes(db, user)]
    return {
        "teacher": user.name, "classes": [c.name for c in _classes(db, user)], "students": len(students),
        "absent_today": db.query(Attendance).filter(Attendance.student_id.in_(ids), Attendance.date == today,
                                                    Attendance.status == "absent").count(),
        "homework_today": db.query(Homework).filter(Homework.class_id.in_(class_ids),
                                                    Homework.assigned_date == today).count(),
        "fees_pending": db.query(Fee).filter(Fee.student_id.in_(ids), Fee.amount_paid < Fee.amount_due).count(),
        "inbox_open": db.query(InboxItem).filter_by(teacher_id=user.id, status="open").count(),
    }


@router.get("/homework")
def list_homework(user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    names = {c.id: c.name for c in _classes(db, user)}
    rows = (db.query(Homework).filter(Homework.class_id.in_(names))
            .order_by(Homework.assigned_date.desc(), Homework.id.desc()).limit(60).all())
    return [{"id": h.id, "class": names[h.class_id], "subject": h.subject, "task": h.task,
             "assigned_date": h.assigned_date.isoformat(), "due_date": h.due_date.isoformat()} for h in rows]


@router.delete("/homework/{homework_id}")
def delete_homework(homework_id: int, user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    h = db.get(Homework, homework_id)
    if h is None or h.class_id not in [c.id for c in _classes(db, user)]:
        raise HTTPException(404, "No such homework.")
    db.delete(h)
    db.commit()
    return {"ok": True}


@router.get("/attendance")
def attendance_grid(user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    today = config.today()
    days = school_days(today - timedelta(days=9), today)[-6:]
    students = _students(db, user)
    rows = db.query(Attendance).filter(Attendance.student_id.in_([s.id for s in students]),
                                       Attendance.date >= days[0]).all()
    marks = {(r.student_id, r.date): r.status for r in rows}
    return {"days": [d.isoformat() for d in days], "today": today.isoformat(),
            "students": [{"id": s.id, "name": s.name, "roll_no": s.roll_no,
                          "marks": [marks.get((s.id, d), "present") for d in days]} for s in students]}


class Mark(BaseModel):
    student_id: int
    date: date
    status: str  # present | absent | late


@router.put("/attendance")
def set_attendance(body: Mark, user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    if body.status not in ("present", "absent", "late") or body.date > config.today():
        raise HTTPException(422, "Bad status or date.")
    s = _own_student(db, user, body.student_id)
    row = db.query(Attendance).filter_by(student_id=s.id, date=body.date).first()
    if body.status == "present":
        if row:
            db.delete(row)
    elif row:
        row.status = body.status
    else:
        db.add(Attendance(student_id=s.id, date=body.date, status=body.status))
    db.commit()
    return {"ok": True}


@router.get("/students")
def list_students(user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    week_ago = config.today() - timedelta(days=6)
    out = []
    for s in _students(db, user):
        notes = db.query(Note).filter_by(student_id=s.id).order_by(Note.created_at.desc()).all()
        fees = db.query(Fee).filter_by(student_id=s.id).all()
        out.append({
            "id": s.id, "name": s.name, "roll_no": s.roll_no, "class": s.school_class.name,
            "parent": s.parent.name, "parent_language": s.parent.language,
            "absent_7d": db.query(Attendance).filter(Attendance.student_id == s.id, Attendance.date >= week_ago,
                                                     Attendance.status == "absent").count(),
            "fee_balance": sum(f.amount_due - f.amount_paid for f in fees),
            "notes": [{"id": n.id, "text": n.text, "private": n.private,
                       "created_at": iso(n.created_at)} for n in notes],
        })
    return out


class NotePatch(BaseModel):
    private: bool


def _own_note(db: Session, user: User, note_id: int) -> Note:
    n = db.get(Note, note_id)
    if n is None:
        raise HTTPException(404, "No such note.")
    _own_student(db, user, n.student_id)
    return n


@router.put("/notes/{note_id}")
def patch_note(note_id: int, body: NotePatch, user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    _own_note(db, user, note_id).private = body.private
    db.commit()
    return {"ok": True}


@router.delete("/notes/{note_id}")
def delete_note(note_id: int, user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    db.delete(_own_note(db, user, note_id))
    db.commit()
    return {"ok": True}


@router.get("/fees")
def list_fees(user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    today = config.today()
    students = {s.id: s for s in _students(db, user)}
    fees = db.query(Fee).filter(Fee.student_id.in_(students)).order_by(Fee.due_date, Fee.student_id).all()
    return [{"id": f.id, "student": students[f.student_id].name, "title": f.title, "amount_due": f.amount_due,
             "amount_paid": f.amount_paid, "balance": f.amount_due - f.amount_paid,
             "due_date": f.due_date.isoformat(),
             "status": "paid" if f.amount_paid >= f.amount_due else "overdue" if f.due_date < today else "due"}
            for f in fees]


# ---- inbox: what parents sent back ----

@router.get("/inbox")
def inbox(user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    items = db.query(InboxItem).filter_by(teacher_id=user.id).order_by(InboxItem.id.desc()).limit(50).all()
    return [{"id": i.id, "kind": i.kind, "student": i.student.name, "parent": i.student.parent.name,
             "text": i.text, "original": i.original, "status": i.status, "reply": i.reply,
             "created_at": iso(i.created_at)} for i in items]


def _own_item(db: Session, user: User, item_id: int) -> InboxItem:
    item = db.get(InboxItem, item_id)
    if item is None or item.teacher_id != user.id:
        raise HTTPException(404, "No such item.")
    return item


@router.post("/inbox/{item_id}/reply")
def reply_to_parent(item_id: int, text: str | None = Form(None), audio: UploadFile | None = File(None),
                    user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    """Typed or spoken. Either way the parent hears it in their own language."""
    item = _own_item(db, user, item_id)
    answer = voice.listen(db, user, audio, ["en-IN", "hi-IN"], [item.student.name]) if audio else said(text)
    try:
        reports.send_reply(db, get_llm(), item, answer)
    except LLMError as e:
        raise llm_failed(e)
    return {"ok": True, "reply": answer}


@router.post("/inbox/{item_id}/read")
def mark_read(item_id: int, user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    item = _own_item(db, user, item_id)
    if item.status == "open":
        item.status = "read"
        db.commit()
    return {"ok": True}


# ---- sending to parents ----

class SendBody(BaseModel):
    kind: str  # homework | weekly


@router.post("/send")
def send_now(body: SendBody, user: User = Depends(teacher_user), db: Session = Depends(get_db)):
    """What the daily cron does, on a button. Handy for demos."""
    if body.kind not in ("homework", "weekly"):
        raise HTTPException(422, "kind must be homework or weekly.")
    send = reports.send_homework if body.kind == "homework" else reports.send_weekly
    try:
        sent = sum(send(db, get_llm(), c) for c in _classes(db, user))
    except LLMError as e:
        raise llm_failed(e)
    return {"sent": sent}


@router.post("/reset")
def reset_demo(user: User = Depends(teacher_user)):
    """Wipe everything back to the seed data."""
    reset_db()
    return {"ok": True}
