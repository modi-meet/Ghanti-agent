"""What the parent's agent can look up. Read only, and only ever about ctx.student.

None of these take a student id. The server sets ctx.student from the login,
so there is nothing the model could pass to reach another child.
"""
from datetime import timedelta

from ..models import Attendance, Fee, Homework, InboxItem, Note
from .common import parse_date, school_days
from .registry import Registry, Tool, ToolContext


def get_attendance(ctx: ToolContext, args: dict) -> dict:
    days = min(int(args.get("days", 7)), 90)
    start = ctx.today - timedelta(days=days - 1)
    rows = (ctx.db.query(Attendance)
            .filter(Attendance.student_id == ctx.student.id, Attendance.date >= start)
            .order_by(Attendance.date).all())
    total = len(school_days(start, ctx.today))
    absent = [r.date for r in rows if r.status == "absent"]
    late = [r.date for r in rows if r.status == "late"]
    fmt = lambda d: d.strftime("%A %d %B")
    return {"from": start.isoformat(), "to": ctx.today.isoformat(), "school_days": total,
            "days_present": total - len(absent), "absent_on": [fmt(d) for d in absent], "late_on": [fmt(d) for d in late]}


def get_homework(ctx: ToolContext, args: dict) -> dict:
    q = ctx.db.query(Homework).filter(Homework.class_id == ctx.student.class_id)
    note = ""
    if args.get("from_date") or args.get("to_date"):
        start = parse_date(args.get("from_date"), ctx.today)
        end = parse_date(args.get("to_date"), ctx.today)
        items = q.filter(Homework.assigned_date >= start, Homework.assigned_date <= end).all()
    else:
        # No dates asked for means today's. If nothing was given today, show the last day something was.
        items = q.filter(Homework.assigned_date == ctx.today).all()
        if not items:
            latest = q.order_by(Homework.assigned_date.desc()).first()
            if latest:
                items = q.filter(Homework.assigned_date == latest.assigned_date).all()
                note = f"Nothing was given today. This is from {latest.assigned_date.strftime('%A %d %B')}."
    if args.get("subject"):
        wanted = args["subject"].lower()
        items = [h for h in items if wanted in h.subject.lower()]
    out = {"homework": [{"subject": h.subject, "task": h.task, "given_on": h.assigned_date.strftime("%A %d %B"),
                         "due_on": h.due_date.strftime("%A %d %B")} for h in sorted(items, key=lambda h: h.assigned_date)]}
    if note:
        out["note"] = note
    return out


def get_fee_status(ctx: ToolContext, args: dict) -> dict:
    fees = ctx.db.query(Fee).filter_by(student_id=ctx.student.id).order_by(Fee.due_date).all()
    return {"fees": [{"fee": f.title, "total": f.amount_due, "paid": f.amount_paid,
                      "balance": f.amount_due - f.amount_paid, "due_on": f.due_date.strftime("%d %B"),
                      "overdue": f.amount_paid < f.amount_due and f.due_date < ctx.today} for f in fees]}


def get_teacher_notes(ctx: ToolContext, args: dict) -> dict:
    notes = (ctx.db.query(Note).filter_by(student_id=ctx.student.id, private=False)
             .order_by(Note.created_at.desc()).limit(10).all())
    return {"notes": [{"note": n.text, "written_on": n.created_at.strftime("%d %B")} for n in notes]}


def ask_teacher(ctx: ToolContext, args: dict) -> dict:
    ctx.db.add(InboxItem(teacher_id=ctx.student.school_class.teacher_id, student_id=ctx.student.id,
                         kind="question", text=args["question"].strip(),
                         original=(args.get("parent_words") or "").strip()))
    ctx.db.commit()
    return {"sent": True, "tell_parent": "The teacher has the question and the answer will come as a voice message."}


PARENT_TOOLS = Registry([
    Tool("get_attendance",
         "The child's attendance over the last N days: days present, and the dates absent or late.",
         {"type": "object", "properties": {
             "days": {"type": "integer", "description": "How many days back. Defaults to 7."}}}, get_attendance),
    Tool("get_homework",
         "Homework given to the child's class. With no dates it returns today's, or the most recent day's if "
         "nothing was given today. Pass dates for any other day or range.",
         {"type": "object", "properties": {
             "from_date": {"type": "string", "description": "YYYY-MM-DD."},
             "to_date": {"type": "string", "description": "YYYY-MM-DD."},
             "subject": {"type": "string"}}}, get_homework),
    Tool("get_fee_status",
         "What the family has paid, what is still due and by when.",
         {"type": "object", "properties": {}}, get_fee_status),
    Tool("get_teacher_notes",
         "What the teacher has written about the child: behaviour, strengths, where they need help.",
         {"type": "object", "properties": {}}, get_teacher_notes),
    Tool("ask_teacher",
         "Pass a question or message to the teacher when the records don't answer it, or the parent wants "
         "to tell the teacher something (a reason for absence, a request, a worry).",
         {"type": "object", "properties": {
             "question": {"type": "string", "description": "The message in clear English for the teacher."},
             "parent_words": {"type": "string", "description": "What the parent actually said, in their language."}},
          "required": ["question"]}, ask_teacher),
])
