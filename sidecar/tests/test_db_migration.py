"""Databases from earlier versions gain new columns in place, keeping their rows."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from mlxstudio.db.session import add_missing_columns


def _old_schema_engine(path: Path):
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id VARCHAR, "
                "role VARCHAR NOT NULL, content TEXT NOT NULL, tok_per_sec FLOAT, created_at DATETIME)"
            )
        )
        conn.execute(text("INSERT INTO messages (conversation_id, role, content) VALUES ('c', 'user', 'hi')"))
    return engine


def test_adds_images_column_and_keeps_rows(tmp_path: Path) -> None:
    engine = _old_schema_engine(tmp_path / "old.db")

    add_missing_columns(engine)
    add_missing_columns(engine)  # idempotent: a second start changes nothing

    columns = {c["name"] for c in inspect(engine).get_columns("messages")}
    assert "images" in columns
    with engine.connect() as conn:
        assert conn.execute(text("SELECT content, images FROM messages")).one() == ("hi", None)


def test_no_messages_table_is_left_alone(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'empty.db'}")

    add_missing_columns(engine)

    assert inspect(engine).get_table_names() == []
