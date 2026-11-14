from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    """SQLite hands datetimes back without a timezone. They are always UTC, so say so."""
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(16))  # teacher | parent
    name: Mapped[str] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(8), default="en-IN")
    demo: Mapped[bool] = mapped_column(Boolean, default=False)  # shown on the login page


class SchoolClass(Base):
    __tablename__ = "classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(16))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))


class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    roll_no: Mapped[int] = mapped_column(Integer)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"))
    parent_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    school_class: Mapped[SchoolClass] = relationship()
    parent: Mapped[User] = relationship()


class Attendance(Base):
    """Only exceptions are stored. No row for a school day means present."""
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("student_id", "date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(8))  # absent | late


class Homework(Base):
    __tablename__ = "homework"
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"))
    subject: Mapped[str] = mapped_column(String(60))
    task: Mapped[str] = mapped_column(Text)
    assigned_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)


class Fee(Base):
    __tablename__ = "fees"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    title: Mapped[str] = mapped_column(String(120))
    amount_due: Mapped[int] = mapped_column(Integer)
    amount_paid: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date] = mapped_column(Date)


class Note(Base):
    __tablename__ = "notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    text: Mapped[str] = mapped_column(Text)
    private: Mapped[bool] = mapped_column(Boolean, default=False)  # never shown to parents
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Message(Base):
    """Something the school sent a parent: daily homework, weekly call, or a teacher's reply."""
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    parent_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(16))  # homework | weekly | reply
    title: Mapped[str] = mapped_column(String(160))
    script: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(8))
    audio_key: Mapped[str] = mapped_column(String(64))
    heard: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(16))  # teacher | parent
    message_id: Mapped[int | None] = mapped_column(ForeignKey("messages.id"), nullable=True)
    ended: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Turn(Base):
    __tablename__ = "turns"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(String(12))  # user | assistant
    text: Mapped[str] = mapped_column(Text)
    audio_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    trace: Mapped[list] = mapped_column(JSON, default=list)  # tool calls made for this reply
    action_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Action(Base):
    """One thing the teacher agent changed. Keeps enough to undo it."""
    __tablename__ = "actions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(24))  # homework | attendance | note | fee
    title: Mapped[str] = mapped_column(String(160))
    lines: Mapped[list] = mapped_column(JSON, default=list)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(12), default="applied")  # applied | pending | undone
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class InboxItem(Base):
    """What comes back to the teacher from parents."""
    __tablename__ = "inbox"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    kind: Mapped[str] = mapped_column(String(16))  # question | summary
    text: Mapped[str] = mapped_column(Text)
    original: Mapped[str] = mapped_column(Text, default="")  # the parent's own words
    status: Mapped[str] = mapped_column(String(12), default="open")  # open | answered | read
    reply: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    student: Mapped[Student] = relationship()


class Audio(Base):
    """Spoken audio, keyed by a hash of voice + language + text. Filled in on first play."""
    __tablename__ = "audio"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(8))
    data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Usage(Base):
    __tablename__ = "usage"
    __table_args__ = (UniqueConstraint("day", "user_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    count: Mapped[int] = mapped_column(Integer, default=0)
