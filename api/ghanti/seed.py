"""Synthetic demo school. Dates hang off today so the demo always looks current."""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from . import config
from .db import Base, engine
from .models import Attendance, Fee, Homework, Note, SchoolClass, Student, User

# student, parent, parent language, demo login
ROSTER = [
    ("Aarav Patel", "Hetal Patel", "gu-IN", True),
    ("Ananya Verma", "Rakesh Verma", "hi-IN", False),
    ("Diya Shah", "Bhavesh Shah", "gu-IN", False),
    ("Ishita Joshi", "Pooja Joshi", "hi-IN", False),
    ("Kabir Singh", "Sunita Singh", "hi-IN", True),
    ("Meera Nair", "Lakshmi Nair", "en-IN", True),
    ("Rohan Desai", "Nilesh Desai", "gu-IN", False),
    ("Rohan Mehta", "Kavita Mehta", "hi-IN", False),  # two Rohans on purpose
]


def school_days_back(n: int, end: date) -> list[date]:
    """The last n school days up to and including end. Sunday is off."""
    days, d = [], end
    while len(days) < n:
        if d.weekday() != 6:
            days.append(d)
        d -= timedelta(days=1)
    return days


def next_school_day(d: date) -> date:
    d += timedelta(days=1)
    return d + timedelta(days=1) if d.weekday() == 6 else d


def seed(db: Session) -> None:
    today = config.today()
    days = school_days_back(10, today)  # days[0] is the latest school day

    teacher = User(role="teacher", name="Anita Sharma", language="en-IN", demo=True)
    db.add(teacher)
    db.flush()
    cls = SchoolClass(name="8B", teacher_id=teacher.id)
    db.add(cls)
    db.flush()

    students = {}
    for roll, (name, parent_name, lang, demo) in enumerate(ROSTER, start=1):
        parent = User(role="parent", name=parent_name, language=lang, demo=demo)
        db.add(parent)
        db.flush()
        s = Student(name=name, roll_no=roll, class_id=cls.id, parent_id=parent.id)
        db.add(s)
        db.flush()
        students[name] = s

    def absent(name, *idx, status="absent"):
        for i in idx:
            db.add(Attendance(student_id=students[name].id, date=days[i], status=status))

    absent("Aarav Patel", 1, 3)
    absent("Kabir Singh", 2, 3, 4)
    absent("Diya Shah", 6)
    absent("Rohan Mehta", 1, status="late")
    absent("Ishita Joshi", 8)

    homework = [
        (2, "Maths", "Exercise 4.2, questions 1 to 10"),
        (2, "English", "Write a paragraph on your favourite festival"),
        (1, "Science", "Draw and label the parts of a plant cell"),
        (1, "Hindi", "Chapter 5 ke prashn uttar likho"),
    ]
    for back, subject, task in homework:
        db.add(Homework(class_id=cls.id, subject=subject, task=task,
                        assigned_date=days[back], due_date=next_school_day(days[back])))

    term_due = today - timedelta(days=5)
    paid = {"Aarav Patel": 12000, "Ananya Verma": 12000, "Diya Shah": 6000, "Ishita Joshi": 12000,
            "Kabir Singh": 0, "Meera Nair": 12000, "Rohan Desai": 12000, "Rohan Mehta": 7500}
    for name, amount in paid.items():
        db.add(Fee(student_id=students[name].id, title="Term 2 tuition fee",
                   amount_due=12000, amount_paid=amount, due_date=term_due))
    db.add(Fee(student_id=students["Aarav Patel"].id, title="Science exhibition trip",
               amount_due=800, amount_paid=0, due_date=today + timedelta(days=6)))

    notes = [
        ("Aarav Patel", "Very good at maths, solved the hardest problem on the board this week.", False),
        ("Aarav Patel", "Keeps talking to his bench partner while I teach. Needs a reminder now and then.", False),
        ("Kabir Singh", "Missed three days in a row and has fallen behind in science.", False),
        ("Kabir Singh", "Family seems to be going through something, handle gently.", True),
        ("Meera Nair", "Reads well above her grade. Could try the school library's senior shelf.", False),
        ("Diya Shah", "Shy in class but her written work is neat and always on time.", False),
    ]
    for name, text, private in notes:
        db.add(Note(student_id=students[name].id, text=text, private=private))

    db.commit()


def init_db() -> None:
    """Create tables and seed once. Safe to call on every cold start."""
    from .db import SessionLocal

    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.query(User).count() == 0:
            seed(db)


def reset_db() -> None:
    from .db import SessionLocal

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
