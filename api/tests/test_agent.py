"""The loop, the tools and the guardrails, with a scripted LLM so no key is needed."""
import json

from ghanti.agent import parent_tools, teacher_tools
from ghanti.agent.loop import MAX_ROUNDS, run_single, run_turn
from ghanti.agent.parent_tools import PARENT_TOOLS
from ghanti.agent.teacher_tools import TEACHER_TOOLS
from ghanti.llm import Reply, ToolCall
from ghanti.llm.scripted import ScriptedLLM
from ghanti.models import Action, Attendance, Fee, Homework, InboxItem, Note, Student
from ghanti.services import actions


def call(tool, **args):
    return ToolCall(id=tool, name=tool, args=args)


def test_one_sentence_two_homeworks(teacher_ctx):
    llm = ScriptedLLM([
        Reply("", [call("add_homework", class_name="8B", subject="physics", task="Lesson 3, examples 1 to 5"),
                   call("add_homework", class_name="class 8b", subject="chemistry", task="Read lesson 2")]),
        Reply("Added physics and chemistry homework for 8B."),
    ])
    reply = run_turn(llm, "system", TEACHER_TOOLS, teacher_ctx, [], "8B physics homework is ...")
    assert reply.startswith("Added")
    saved = teacher_ctx.db.query(Homework).filter_by(assigned_date=teacher_ctx.today).all()
    assert {h.subject for h in saved} == {"Physics", "Chemistry"}
    assert len(teacher_ctx.action_ids) == 2 and all(t["ok"] for t in teacher_ctx.trace)
    # the tool results went back to the model before it answered
    assert llm.seen[1][-1].role == "tool" and len(llm.seen[1][-1].tool_results) == 2


def test_two_rohans_are_refused_and_nothing_is_saved(teacher_ctx):
    result = TEACHER_TOOLS.dispatch(teacher_ctx, call("mark_attendance", students=["Meera", "Rohan"], status="late"))
    assert "Rohan Desai or Rohan Mehta" in result.content["error"]
    assert teacher_ctx.db.query(Attendance).filter_by(date=teacher_ctx.today).count() == 0  # not even Meera


def test_misheard_name_gets_the_roster(teacher_ctx):
    result = TEACHER_TOOLS.dispatch(teacher_ctx, call("add_student_note", student="Zubin", note="x"))
    assert "Aarav Patel" in result.content["error"]


def test_names_are_found_loosely(teacher_ctx):
    for said, real in [("Kabir", "Kabir Singh"), ("kabeer singh", "Kabir Singh"), ("Mehta", "Rohan Mehta"), ("Arav", "Aarav Patel")]:
        assert TEACHER_TOOLS.dispatch(teacher_ctx, call("get_student_record", student=said)).content["student"] == real


def test_homework_due_on_sunday_moves_to_monday(teacher_ctx):
    from datetime import date
    result = TEACHER_TOOLS.dispatch(teacher_ctx, call("add_homework", subject="maths", task="x", due_date="2026-11-15"))
    assert result.content["due"].startswith("Monday")
    assert teacher_ctx.db.query(Homework).filter_by(task="x").one().due_date == date(2026, 11, 16)


def test_attendance_then_undo(teacher_ctx):
    db = teacher_ctx.db
    meera = db.query(Student).filter_by(name="Meera Nair").one()
    TEACHER_TOOLS.dispatch(teacher_ctx, call("mark_attendance", students=["Meera Nair"], status="absent"))
    assert db.query(Attendance).filter_by(student_id=meera.id, date=teacher_ctx.today).one().status == "absent"
    actions.undo(db, db.get(Action, teacher_ctx.action_ids[0]))
    assert db.query(Attendance).filter_by(student_id=meera.id, date=teacher_ctx.today).first() is None


def test_fee_waits_for_confirm(teacher_ctx):
    db = teacher_ctx.db
    kabir = db.query(Student).filter_by(name="Kabir Singh").one()
    result = TEACHER_TOOLS.dispatch(teacher_ctx, call("update_fee", student="Kabir", kind="payment", amount=5000))
    assert result.content["needs_confirmation"]
    fee = db.query(Fee).filter_by(student_id=kabir.id).one()
    assert fee.amount_paid == 0  # nothing moved yet
    action = db.get(Action, teacher_ctx.action_ids[0])
    actions.confirm(db, action)
    assert fee.amount_paid == 5000
    actions.undo(db, action)
    assert fee.amount_paid == 0


def test_bad_arguments_come_back_as_an_error_not_a_crash(teacher_ctx):
    result = TEACHER_TOOLS.dispatch(teacher_ctx, call("mark_attendance", students=["Meera"], status="sleeping"))
    assert "error" in result.content and teacher_ctx.trace[-1]["ok"] is False
    result = TEACHER_TOOLS.dispatch(teacher_ctx, call("no_such_tool"))
    assert "No tool named" in result.content["error"]


def test_loop_stops_after_max_rounds(teacher_ctx):
    stuck = Reply("", [call("get_class_summary")])
    llm = ScriptedLLM([stuck] * MAX_ROUNDS + [Reply("Here is what I found.")])
    assert run_turn(llm, "system", TEACHER_TOOLS, teacher_ctx, [], "loop forever") == "Here is what I found."
    assert len(teacher_ctx.trace) == MAX_ROUNDS


def test_parent_never_hears_private_notes(parent_ctx):
    notes = PARENT_TOOLS.dispatch(parent_ctx, call("get_teacher_notes")).content["notes"]
    assert len(notes) == 1 and "fallen behind" in notes[0]["note"]
    assert parent_ctx.db.query(Note).filter_by(student_id=parent_ctx.student.id, private=True).count() == 1


def test_parent_tools_cannot_be_pointed_at_another_child(parent_ctx):
    # No parent tool has a student parameter at all, so there's nothing to aim.
    for schema in PARENT_TOOLS.schemas():
        assert not any("student" in key for key in schema["parameters"]["properties"])
    absent = PARENT_TOOLS.dispatch(parent_ctx, call("get_attendance", days=7)).content
    assert len(absent["absent_on"]) == 3  # Kabir's own three days, from the seed


def test_question_reaches_the_teacher(parent_ctx):
    PARENT_TOOLS.dispatch(parent_ctx, call("ask_teacher", question="Can Kabir get extra science help?",
                                           parent_words="कबीर को साइंस में मदद मिल सकती है?"))
    item = parent_ctx.db.query(InboxItem).one()
    assert item.kind == "question" and item.student_id == parent_ctx.student.id and item.status == "open"


def test_homework_with_no_dates_means_today_or_the_latest_day(parent_ctx):
    out = PARENT_TOOLS.dispatch(parent_ctx, call("get_homework")).content
    assert "Nothing was given today" in out["note"] and len(out["homework"]) == 2  # the seed's latest day
    parent_ctx.db.add(Homework(class_id=parent_ctx.student.class_id, subject="Maths", task="today's",
                               assigned_date=parent_ctx.today, due_date=parent_ctx.today))
    parent_ctx.db.commit()
    out = PARENT_TOOLS.dispatch(parent_ctx, call("get_homework")).content
    assert [h["task"] for h in out["homework"]] == ["today's"] and "note" not in out


# ---- single mode: one request, records in the prompt, JSON back ----

def say(text, **calls):
    return Reply(json.dumps({"say": text, "calls": calls}))


def test_single_mode_runs_every_call_in_one_request(teacher_ctx):
    llm = ScriptedLLM([say("Homework saved and Meera marked absent.",
                           add_homework=[{"subject": "physics", "task": "Lesson 3", "class_name": "", "due_date": ""}],
                           mark_attendance=[{"students": ["Meera Nair"], "status": "absent"}])])
    reply = run_single(llm, "system", TEACHER_TOOLS, teacher_ctx, [], "...")
    assert reply == "Homework saved and Meera marked absent." and len(llm.seen) == 1
    assert [t["name"] for t in teacher_ctx.trace] == ["add_homework", "mark_attendance"]
    assert len(teacher_ctx.action_ids) == 2


def test_single_mode_says_the_problem_when_a_call_fails(teacher_ctx):
    llm = ScriptedLLM([say("Rohan is marked late.", mark_attendance=[{"students": ["Rohan"], "status": "late"}])])
    reply = run_single(llm, "system", TEACHER_TOOLS, teacher_ctx, [], "...")
    assert "Which one did you mean?" in reply and "marked late" not in reply


def test_single_mode_cannot_run_read_tools_or_unknown_ones(teacher_ctx):
    llm = ScriptedLLM([say("ok", get_class_summary=[{}], drop_tables=[{}])])
    run_single(llm, "system", TEACHER_TOOLS, teacher_ctx, [], "...")
    assert teacher_ctx.action_ids == []  # a lookup changes nothing, and the unknown tool was refused
    assert teacher_ctx.trace[-1] == {"name": "drop_tables", "args": {}, "ok": False, "ms": teacher_ctx.trace[-1]["ms"]}


def test_records_for_the_prompt_respect_the_same_guardrails(parent_ctx, teacher_ctx):
    theirs = parent_tools.records(parent_ctx)
    assert len(theirs["teacher_notes"]) == 1  # the private note stays out of the prompt too
    assert theirs["homework_given_today"] == [] and len(theirs["homework_given_earlier_this_week"]) == 4
    assert len(theirs["attendance_last_14_days"]["absent_on"]) == 3
    assert "Rohan Mehta" in teacher_tools.records(teacher_ctx)["class 8B"]["roster"]
