import os, tempfile
os.environ["DATABASE_URL"] = "postgresql+psycopg://reseller:reseller@localhost:5432/reseller_test"
os.environ["ADMIN_PASSWORD"] = "test-password"
os.environ["SECRET_KEY"] = "test-secret-key-0123456789"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["STORAGE_DIR"] = tempfile.mkdtemp(prefix="rai-test-")
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["ALLOW_PRIVATE_URLS"] = "false"

import pytest
from sqlalchemy import text
from fastapi.testclient import TestClient
from app.db import Base, SessionLocal, engine
from app import models  # noqa: F401
from app.services import agents, automation


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def clean():
    with engine.begin() as c:
        names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        c.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    db = SessionLocal()
    agents.seed(db); automation.seed(db); db.commit(); db.close()
    yield


@pytest.fixture
def db():
    s = SessionLocal()
    yield s
    s.rollback()
    s.close()


@pytest.fixture
def client():
    from app.main import app
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"password": "test-password"})
    assert r.status_code == 200
    return c
