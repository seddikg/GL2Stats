"""
Creates the database and tables for GL2Stats.

Tables:

    Subject(slug TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            coefficient REAL NOT NULL DEFAULT 1,
            semester_number INTEGER)

    Student(id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT NOT NULL,
            lastYearsAverage REAL NOT NULL,
            is_enrolled BOOLEAN NOT NULL DEFAULT 1)

    Mark(student_id INTEGER NOT NULL REFERENCES Student(id),
         subject_slug TEXT NOT NULL REFERENCES Subject(slug),
         value REAL,
         PRIMARY KEY (student_id, subject_slug))
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "gl2stats.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS Semester (
    number INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS Subject (
    slug            TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    coefficient     REAL NOT NULL DEFAULT 1,
    semester_number INTEGER REFERENCES Semester(number)
);

CREATE TABLE IF NOT EXISTS Student (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    hash             TEXT NOT NULL,
    lastYearsAverage REAL NOT NULL,
    is_enrolled      BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS Mark (
    student_id   INTEGER NOT NULL REFERENCES Student(id),
    subject_slug TEXT    NOT NULL REFERENCES Subject(slug),
    value        REAL,
    PRIMARY KEY (student_id, subject_slug)
);
"""


def create_database(db_path=DB_PATH):
    """Create the database file and all tables if they do not exist yet."""
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(SCHEMA)
        connection.commit()

    return db_path


if __name__ == "__main__":
    path = create_database()
    print(f"Database created at {path}")

import sqlite3


