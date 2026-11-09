"""Create the local SQLite database with the single-table runs schema."""

import sqlite3
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BACKEND_DIR / "data" / "databases" / "app.db"
SCHEMA_PATH = BACKEND_DIR / "schema.sql"


def initialize_database(path: Path = DATABASE_PATH) -> None:
    """Create missing directories/table; preserve existing runs on repeat calls."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


if __name__ == "__main__":
    initialize_database()
    print(f"Initialized SQLite database: {DATABASE_PATH}")
