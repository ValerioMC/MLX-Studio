"""SQLAlchemy engine/session setup with WAL for concurrent reads during downloads."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from ..config import get_settings
from .models import Base

settings = get_settings()

_engine = create_engine(
    f"sqlite:///{settings.db_path}",
    connect_args={"check_same_thread": False},
    future=True,
)


@event.listens_for(_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _record):  # noqa: ANN001
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False, future=True)


def _drop_legacy_conversation_tables() -> None:
    """Early builds created conversations/messages with a different schema (e.g.
    a NOT NULL `pinned` column) that inserts now violate. The feature never had
    a UI, so those tables are guaranteed empty; recreate them cleanly."""
    inspector = inspect(_engine)
    if "conversations" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("conversations")}
    if "pinned" not in columns:
        return
    with _engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS messages"))
        conn.execute(text("DROP TABLE IF EXISTS conversations"))


def add_missing_columns(engine: Engine) -> None:
    """Add columns introduced after a table was first created.

    create_all only creates missing tables, never columns, so databases from
    earlier versions are upgraded here in place, keeping their rows. Each
    addition is idempotent."""
    inspector = inspect(engine)
    if "messages" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("messages")}
    if "images" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE messages ADD COLUMN images JSON"))


def init_db() -> None:
    _drop_legacy_conversation_tables()
    Base.metadata.create_all(_engine)
    add_missing_columns(_engine)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
