"""Writes what parents hear: the daily homework message, the weekly call, and teacher replies."""
import json
from datetime import timedelta

from sqlalchemy.orm import Session

from .. import config
from ..agent.parent_tools import get_attendance, get_fee_status, get_homework, get_teacher_notes
from ..agent.registry import ToolContext
from ..llm import LLM, Message as LLMMessage
from ..models import Conversation, Homework, InboxItem, Message, SchoolClass, Student, Turn, User
from ..speech import LANGUAGE_NAMES
from . import voice

STYLE = """Write it in {language}, the way people really speak it, in its own script. School words like homework, fees, maths can stay in English.
It will be read aloud by a voice, so: short sentences, amounts and dates as spoken words, no lists, no symbols, no markdown.
Reply with only the words to be spoken."""


def _write(llm: LLM, task: str, language: str) -> str:
    system = "You write short voice messages a school sends to parents. Use only the facts given. Never invent any."
    prompt = task + "\n\n" + STYLE.format(language=LANGUAGE_NAMES.get(language, "Hindi"))
    return llm.generate(system, [LLMMessage(role="user", text=prompt)]).text.strip()


def _send(db: Session, student: Student, kind: str, title: str, script: str) -> Message:
    language = student.parent.language
    msg = Message(student_id=student.id, parent_id=student.parent_id, kind=kind, title=title, script=script,
                  language=language, audio_key=voice.remember(db, script, language))
    db.add(msg)
    db.commit()
    return msg


def _sent(db: Session, student: Student, title: str) -> bool:
    """Titles carry the date, so this stops a second send on the same day."""
    return db.query(Message).filter_by(student_id=student.id, title=title).first() is not None


def send_homework(db: Session, llm: LLM, cls: SchoolClass) -> int:
    """Today's homework to every parent. One script per language, shared by parents who speak it."""
    today = config.today()
    items = db.query(Homework).filter_by(class_id=cls.id, assigned_date=today).all()
    if not items:
        return 0
    facts = json.dumps([{"subject": h.subject, "task": h.task, "due": h.due_date.strftime("%A")} for h in items],
                       ensure_ascii=False)
    title = f"Homework · {today.strftime('%a %d %b')}"
    students = [s for s in db.query(Student).filter_by(class_id=cls.id).all() if not _sent(db, s, title)]
    scripts: dict[str, str] = {}
    for s in students:
        lang = s.parent.language
        if lang not in scripts:
            scripts[lang] = _write(llm, f"Tell the parents of class {cls.name} today's homework, starting with a "
                                        f"one-line greeting from the school. Homework: {facts}", lang)
        _send(db, s, "homework", title, scripts[lang])
    return len(students)


def send_weekly(db: Session, llm: LLM, cls: SchoolClass) -> int:
    """The weekly call, written per child from the same lookups the parent agent uses."""
    today = config.today()
    title = f"Weekly report · {today.strftime('%d %b')}"
    students = [s for s in db.query(Student).filter_by(class_id=cls.id).all() if not _sent(db, s, title)]
    teacher = db.get(User, cls.teacher_id)
    for s in students:
        ctx = ToolContext(db=db, user=s.parent, today=today, student=s)
        facts = json.dumps({
            "attendance_last_7_days": get_attendance(ctx, {"days": 7}),
            "fees": [f for f in get_fee_status(ctx, {})["fees"] if f["balance"] > 0],
            "teacher_notes": get_teacher_notes(ctx, {})["notes"][:3],
            "homework_this_week": len(get_homework(ctx, {"from_date": (today - timedelta(days=6)).isoformat()})["homework"]),
        }, ensure_ascii=False)
        script = _write(llm, f"This is the weekly call from {teacher.name}'s class to {s.parent.name}, parent of "
                             f"{s.name.split()[0]}. In four or five sentences: greet them, give the week's attendance, "
                             f"mention any pending fee, share one thing from the teacher's notes kindly, and end by "
                             f"inviting them to ask anything. Facts: {facts}", s.parent.language)
        _send(db, s, "weekly", title, script)
    return len(students)


def send_reply(db: Session, llm: LLM, item: InboxItem, reply: str) -> Message:
    """The teacher's answer to a parent's question, in the parent's language."""
    student = item.student
    script = _write(llm, f"A parent asked the teacher: \"{item.text}\". The teacher answered: \"{reply}\". "
                         f"Tell the parent the teacher's answer, starting with a short greeting. "
                         f"Keep the teacher's meaning exactly.", student.parent.language)
    item.reply, item.status = reply, "answered"
    return _send(db, student, "reply", "Reply from the teacher", script)


def summarise_call(db: Session, llm: LLM, convo: Conversation, student: Student) -> None:
    """Two lines for the teacher about what the parent asked and said."""
    turns = db.query(Turn).filter_by(conversation_id=convo.id).order_by(Turn.id).all()
    if not any(t.role == "user" for t in turns):
        return
    transcript = "\n".join(f"{'Parent' if t.role == 'user' else 'Assistant'}: {t.text}" for t in turns)
    summary = llm.generate(
        "You summarise a school's call with a parent for the class teacher. Two short sentences in English: "
        "what the parent asked or said, and anything the teacher should follow up. Plain text only.",
        [LLMMessage(role="user", text=transcript)]).text.strip()
    db.add(InboxItem(teacher_id=student.school_class.teacher_id, student_id=student.id, kind="summary", text=summary))
    db.commit()
