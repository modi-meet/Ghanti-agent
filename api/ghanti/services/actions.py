"""Undo and confirm for things the teacher's agent did."""
from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Action, Attendance, Fee, Homework, Note


def confirm(db: Session, action: Action) -> None:
    if action.status != "pending":
        raise HTTPException(409, "Nothing to confirm.")
    p = action.payload
    if p["kind"] == "payment":
        db.get(Fee, p["fee_id"]).amount_paid += p["amount"]
    else:
        fee = Fee(student_id=p["student_id"], title=p["title"], amount_due=p["amount"],
                  due_date=date.fromisoformat(p["due_date"]))
        db.add(fee)
        db.flush()
        action.payload = {**p, "fee_id": fee.id}
    action.status = "applied"
    db.commit()


def undo(db: Session, action: Action) -> None:
    if action.status == "undone":
        raise HTTPException(409, "Already undone.")
    p = action.payload
    if action.status == "applied":
        if action.kind == "homework":
            _delete(db, Homework, p["homework_id"])
        elif action.kind == "note":
            _delete(db, Note, p["note_id"])
        elif action.kind == "attendance":
            day = date.fromisoformat(p["date"])
            for prev in p["previous"]:
                row = db.query(Attendance).filter_by(student_id=prev["student_id"], date=day).first()
                if prev["status"] == "present":
                    if row:
                        db.delete(row)
                elif row:
                    row.status = prev["status"]
                else:
                    db.add(Attendance(student_id=prev["student_id"], date=day, status=prev["status"]))
        elif action.kind == "fee":
            if p["kind"] == "payment":
                db.get(Fee, p["fee_id"]).amount_paid -= p["amount"]
            else:
                _delete(db, Fee, p["fee_id"])
    # A pending fee change was never applied, so undoing it just cancels the card.
    action.status = "undone"
    db.commit()


def _delete(db: Session, model, row_id: int) -> None:
    row = db.get(model, row_id)
    if row:
        db.delete(row)
