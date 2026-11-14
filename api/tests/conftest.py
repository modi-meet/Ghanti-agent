import os
import tempfile

# Point at a throwaway database before anything imports the app.
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["SPEECH_MODE"] = "mock"

import pytest  # noqa: E402

from ghanti import config  # noqa: E402
from ghanti.agent.registry import ToolContext  # noqa: E402
from ghanti.db import SessionLocal  # noqa: E402
from ghanti.models import Student, User  # noqa: E402
from ghanti.seed import reset_db  # noqa: E402


@pytest.fixture
def db():
    reset_db()
    with SessionLocal() as session:
        yield session


@pytest.fixture
def teacher_ctx(db):
    teacher = db.query(User).filter_by(role="teacher").one()
    return ToolContext(db=db, user=teacher, today=config.today())


@pytest.fixture
def parent_ctx(db):
    """Kabir's parent. Kabir has one shareable note and one private note in the seed."""
    kabir = db.query(Student).filter_by(name="Kabir Singh").one()
    return ToolContext(db=db, user=kabir.parent, today=config.today(), student=kabir)
