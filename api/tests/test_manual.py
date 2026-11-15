"""The + Add buttons: the same records, saved by hand instead of by voice."""
import pytest
from fastapi.testclient import TestClient

from ghanti.models import Fee, Homework, Note, Student, User
from main import app


@pytest.fixture
def teacher(db):
    client = TestClient(app)
    client.post("/api/auth/login", json={"user_id": db.query(User).filter_by(role="teacher").one().id})
    return client


def test_add_homework_by_hand(teacher, db):
    r = teacher.post("/api/teacher/homework", json={"subject": "physics", "task": "Lesson 3, examples 1 to 5"})
    assert r.status_code == 200
    hw = db.get(Homework, r.json()["id"])
    assert (hw.subject, hw.due_date.weekday() != 6) == ("Physics", True)
    assert teacher.post("/api/teacher/homework", json={"subject": " ", "task": "x"}).status_code == 422


def test_add_note_by_hand(teacher, db):
    aarav = db.query(Student).filter_by(name="Aarav Patel").one()
    r = teacher.post(f"/api/teacher/students/{aarav.id}/notes", json={"text": "Topped the quiz", "private": True})
    assert db.get(Note, r.json()["id"]).private is True
    assert teacher.post("/api/teacher/students/9999/notes", json={"text": "x"}).status_code == 404


def test_add_fee_and_record_payment(teacher, db):
    aarav = db.query(Student).filter_by(name="Aarav Patel").one()
    fee_id = teacher.post("/api/teacher/fees", json={"student_id": aarav.id, "title": "Picnic", "amount": 500}).json()["id"]
    assert teacher.post(f"/api/teacher/fees/{fee_id}/pay", json={"amount": 600}).status_code == 422  # more than is due
    assert teacher.post(f"/api/teacher/fees/{fee_id}/pay", json={"amount": 200}).json()["balance"] == 300
    db.expire_all()
    assert db.get(Fee, fee_id).amount_paid == 200


def test_parents_cannot_add(db):
    client = TestClient(app)
    client.post("/api/auth/login", json={"user_id": db.query(User).filter_by(role="parent").first().id})
    assert client.post("/api/teacher/homework", json={"subject": "Maths", "task": "x"}).status_code == 403
