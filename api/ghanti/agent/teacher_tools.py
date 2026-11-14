"""What the teacher's agent can do. Every write leaves an Action so the teacher can undo it."""
import re
from datetime import timedelta
from difflib import SequenceMatcher

from ..models import Action, Attendance, Fee, Homework, Note, SchoolClass, Student
from .common import next_school_day, parse_date, rupees, school_days
from .registry import Registry, Tool, ToolContext, ToolError


# ---- lookups ----

def _classes(ctx: ToolContext) -> list[SchoolClass]:
    return ctx.db.query(SchoolClass).filter_by(teacher_id=ctx.user.id).all()


def _class(ctx: ToolContext, name: str | None) -> SchoolClass:
    classes = _classes(ctx)
    if not name and len(classes) == 1:
        return classes[0]
    wanted = re.sub(r"[^a-z0-9]", "", (name or "").lower().replace("class", ""))
    for c in classes:
        if c.name.lower() == wanted:
            return c
    raise ToolError(f"No class '{name}'. This teacher has: {', '.join(c.name for c in classes)}.")


def _student(ctx: ToolContext, name: str) -> Student:
    """Find one student by name. Speech mishears names, so this is fuzzy, and it refuses to guess."""
    wanted = name.strip().lower()
    students = (ctx.db.query(Student).filter(Student.class_id.in_({c.id for c in _classes(ctx)}))
                .order_by(Student.roll_no).all())
    exact = [s for s in students if s.name.lower() == wanted]
    if len(exact) == 1:
        return exact[0]

    def score(s: Student) -> float:
        # Best of the full name and each part, so "Kabir", "Singh" and "Kabeer Singh" all land.
        full = s.name.lower()
        return max(SequenceMatcher(None, wanted, part).ratio() for part in [full, *full.split()])

    matches = [s for s in students if score(s) >= 0.75]
    if len(matches) == 1:
        return matches[0]
    if matches:
        raise ToolError(f"More than one student matches '{name}': {', '.join(s.name for s in matches)}. "
                        "Nothing was changed. Ask the teacher which one they mean.")
    raise ToolError(f"No student called '{name}'. Nothing was changed. The name may have been misheard. "
                    f"Class roster: {', '.join(s.name for s in students)}.")


def _record(ctx: ToolContext, kind: str, title: str, lines: list[str], payload: dict, status="applied") -> Action:
    action = Action(user_id=ctx.user.id, kind=kind, title=title, lines=lines, payload=payload, status=status)
    ctx.db.add(action)
    ctx.db.commit()
    ctx.action_ids.append(action.id)
    return action


# ---- tools ----

def add_homework(ctx: ToolContext, args: dict) -> dict:
    cls = _class(ctx, args.get("class_name"))
    due = parse_date(args.get("due_date"), next_school_day(ctx.today))
    if due.weekday() == 6:  # "tomorrow" said on a Saturday means Monday
        due = next_school_day(due)
    hw = Homework(class_id=cls.id, subject=args["subject"].strip().title(), task=args["task"].strip(),
                  assigned_date=ctx.today, due_date=due)
    ctx.db.add(hw)
    ctx.db.flush()
    _record(ctx, "homework", f"Homework added · {cls.name} {hw.subject}",
            [hw.task, f"Due {due.strftime('%a %d %b')}"], {"homework_id": hw.id})
    return {"saved": True, "class": cls.name, "subject": hw.subject, "due": due.strftime("%A %d %B")}


def mark_attendance(ctx: ToolContext, args: dict) -> dict:
    day = parse_date(args.get("date"), ctx.today)
    if day > ctx.today:
        raise ToolError("Attendance can't be marked for a future date.")
    status = args["status"]
    # Resolve everyone first, so one bad name saves nothing rather than half the list.
    students = [_student(ctx, name) for name in args["students"]]
    previous = []
    for s in students:
        row = ctx.db.query(Attendance).filter_by(student_id=s.id, date=day).first()
        previous.append({"student_id": s.id, "status": row.status if row else "present"})
        if status == "present":
            if row:
                ctx.db.delete(row)
        elif row:
            row.status = status
        else:
            ctx.db.add(Attendance(student_id=s.id, date=day, status=status))
    names = ", ".join(s.name for s in students)
    _record(ctx, "attendance", f"Marked {status} · {day.strftime('%a %d %b')}", [names],
            {"date": day.isoformat(), "previous": previous})
    return {"saved": True, "date": day.isoformat(), "status": status, "students": [s.name for s in students]}


def add_student_note(ctx: ToolContext, args: dict) -> dict:
    s = _student(ctx, args["student"])
    private = bool(args.get("private", False))
    note = Note(student_id=s.id, text=args["note"].strip(), private=private)
    ctx.db.add(note)
    ctx.db.flush()
    _record(ctx, "note", f"Note added · {s.name}",
            [note.text, "Private, parents won't hear this" if private else "Parents can hear this"],
            {"note_id": note.id})
    return {"saved": True, "student": s.name, "private": private}


def update_fee(ctx: ToolContext, args: dict) -> dict:
    s = _student(ctx, args["student"])
    amount = int(args["amount"])
    if amount <= 0:
        raise ToolError("Amount must be more than zero.")
    if args["kind"] == "payment":
        fee = (ctx.db.query(Fee).filter(Fee.student_id == s.id, Fee.amount_paid < Fee.amount_due)
               .order_by(Fee.due_date).first())
        if fee is None:
            raise ToolError(f"{s.name} has no pending fees.")
        if amount > fee.amount_due - fee.amount_paid:
            raise ToolError(f"Only {rupees(fee.amount_due - fee.amount_paid)} is pending on '{fee.title}'.")
        title, lines = f"Record payment · {s.name}", [f"{rupees(amount)} towards {fee.title}"]
        payload = {"kind": "payment", "fee_id": fee.id, "amount": amount}
    else:
        due = parse_date(args.get("due_date"), ctx.today + timedelta(days=7))
        fee_title = (args.get("title") or "School fee").strip()
        title, lines = f"New fee · {s.name}", [f"{rupees(amount)} for {fee_title}", f"Due {due.strftime('%a %d %b')}"]
        payload = {"kind": "new_due", "student_id": s.id, "amount": amount, "title": fee_title, "due_date": due.isoformat()}
    # Money waits for a tap. Nothing changes until the teacher confirms.
    _record(ctx, "fee", title, lines, payload, status="pending")
    return {"saved": False, "needs_confirmation": True,
            "tell_teacher": "Nothing is saved yet. Ask them to tap Confirm on the card."}


def get_class_summary(ctx: ToolContext, args: dict) -> dict:
    cls = _class(ctx, args.get("class_name"))
    days = int(args.get("days", 7))
    start = ctx.today - timedelta(days=days - 1)
    students = ctx.db.query(Student).filter_by(class_id=cls.id).order_by(Student.roll_no).all()
    ids = [s.id for s in students]
    names = {s.id: s.name for s in students}
    rows = ctx.db.query(Attendance).filter(Attendance.student_id.in_(ids), Attendance.date >= start).all()
    absences: dict[str, list[str]] = {}
    for r in sorted(rows, key=lambda r: r.date):
        absences.setdefault(names[r.student_id], []).append(f"{r.date.isoformat()} {r.status}")
    fees = ctx.db.query(Fee).filter(Fee.student_id.in_(ids), Fee.amount_paid < Fee.amount_due).all()
    homework = ctx.db.query(Homework).filter(Homework.class_id == cls.id, Homework.assigned_date >= start).all()
    return {
        "class": cls.name, "students": len(students), "school_days": len(school_days(start, ctx.today)),
        "absent_or_late": absences,
        "fees_pending": [{"student": names[f.student_id], "fee": f.title, "balance": f.amount_due - f.amount_paid,
                          "due_date": f.due_date.isoformat(), "overdue": f.due_date < ctx.today} for f in fees],
        "homework_given": [{"subject": h.subject, "task": h.task, "due_date": h.due_date.isoformat()} for h in homework],
    }


def get_student_record(ctx: ToolContext, args: dict) -> dict:
    s = _student(ctx, args["student"])
    days = int(args.get("days", 30))
    start = ctx.today - timedelta(days=days - 1)
    rows = ctx.db.query(Attendance).filter(Attendance.student_id == s.id, Attendance.date >= start).all()
    fees = ctx.db.query(Fee).filter_by(student_id=s.id).all()
    notes = ctx.db.query(Note).filter_by(student_id=s.id).order_by(Note.created_at.desc()).limit(10).all()
    return {
        "student": s.name, "class": s.school_class.name, "roll_no": s.roll_no,
        "parent": s.parent.name, "parent_language": s.parent.language,
        "absent_or_late": [f"{r.date.isoformat()} {r.status}" for r in sorted(rows, key=lambda r: r.date)],
        "fees": [{"fee": f.title, "balance": f.amount_due - f.amount_paid, "due_date": f.due_date.isoformat()} for f in fees],
        "notes": [{"note": n.text, "private": n.private} for n in notes],
    }


_STUDENT = {"type": "string", "description": "Student's name in English letters, as full as the teacher gave it."}
_DATE = "YYYY-MM-DD."

TEACHER_TOOLS = Registry([
    Tool("add_homework",
         "Save one homework entry for a class. Call once per subject.",
         {"type": "object", "properties": {
             "class_name": {"type": "string", "description": "Like 8B. Leave out if the teacher has one class."},
             "subject": {"type": "string"},
             "task": {"type": "string", "description": "What to do, in the teacher's words, cleaned up."},
             "due_date": {"type": "string", "description": _DATE + " Defaults to the next school day."}},
          "required": ["subject", "task"]}, add_homework),
    Tool("mark_attendance",
         "Mark students absent, late or present for a day. Students with no mark count as present. "
         "If a name matches more than one student, nothing is saved and the error lists them.",
         {"type": "object", "properties": {
             "students": {"type": "array", "items": {"type": "string"},
                          "description": "Names in English letters, as full as the teacher gave them."},
             "status": {"type": "string", "enum": ["absent", "late", "present"]},
             "date": {"type": "string", "description": _DATE + " Defaults to today."}},
          "required": ["students", "status"]}, mark_attendance),
    Tool("add_student_note",
         "Save the teacher's observation about a student. Parents can ask about notes, so set private to "
         "true when the teacher says it is only for them or it is about the family or health.",
         {"type": "object", "properties": {
             "student": _STUDENT,
             "note": {"type": "string", "description": "The observation as one or two clear sentences."},
             "private": {"type": "boolean"}},
          "required": ["student", "note"]}, add_student_note),
    Tool("update_fee",
         "Prepare a fee change: a payment received, or a new amount due. It is not saved until the teacher "
         "taps Confirm on the card that appears.",
         {"type": "object", "properties": {
             "student": _STUDENT,
             "kind": {"type": "string", "enum": ["payment", "new_due"]},
             "amount": {"type": "integer", "description": "Rupees."},
             "title": {"type": "string", "description": "For new_due: what the fee is for."},
             "due_date": {"type": "string", "description": "For new_due. " + _DATE}},
          "required": ["student", "kind", "amount"]}, update_fee),
    Tool("get_class_summary",
         "Absences, pending fees and homework given for a class over the last N days.",
         {"type": "object", "properties": {
             "class_name": {"type": "string"},
             "days": {"type": "integer", "description": "Defaults to 7."}}}, get_class_summary),
    Tool("get_student_record",
         "One student's attendance, fees, notes and parent details.",
         {"type": "object", "properties": {
             "student": _STUDENT,
             "days": {"type": "integer", "description": "How far back to look. Defaults to 30."}},
          "required": ["student"]}, get_student_record),
])
