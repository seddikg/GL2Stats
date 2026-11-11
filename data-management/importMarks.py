"""
Imports the marks of ONE subject and ONE test type into the Mark table.

1. Set SUBJECT below (a slug from insertSubjects.py) and TEST_TYPE to
   "midterm", "final" or "lab". Any other value is a fatal error.
2. Copy private/marksExample.json to private/marks.json and fill it in:
       [{"last_name": "DOE", "first_name": "JOHN", "mark": 14.5}, ...]
3. Run: python data-management/importMarks.py

The mark of each student is written into the column selected by TEST_TYPE.
A null mark clears that column for the student and leaves the other test
types untouched. Each student is paired with a Student id like this: the last
name is hashed, and last year's average (from students.json, found through
last name + first name) picks the right row. If anything is wrong the script
prints every problem and writes nothing.
"""
import json
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

from hashing import hash_name

SUBJECT = "algebre"
TEST_TYPE = "midterm"  # midterm, final or lab
TEST_TYPES = ("midterm", "final", "lab")

HERE = Path(__file__).resolve().parent
PRIVATE_DIR = HERE / "private"
ROOT = HERE.parent
DB_PATH = ROOT / "gl2stats.db"
MARKS_PATH = PRIVATE_DIR / "marks.json"
STUDENTS_PATH = PRIVATE_DIR / "students.json"


def norm(text):
    """Accent-free uppercase with single spaces, for comparing names."""
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9]+", " ", text.upper()).strip()


def load_json(path):
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def import_marks():
    if TEST_TYPE not in TEST_TYPES:
        sys.exit(f"FATAL ERROR: unknown TEST_TYPE '{TEST_TYPE}'. Use one of: {', '.join(TEST_TYPES)}.")

    previous_by_name = {
        (norm(s["last_name"]), norm(s["first_name"])): s.get("previous_average")
        for s in load_json(STUDENTS_PATH)
    }

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute("PRAGMA foreign_keys = ON")

        if not connection.execute("SELECT 1 FROM Subject WHERE slug = ?", (SUBJECT,)).fetchone():
            sys.exit(f"Unknown subject '{SUBJECT}'. Check SUBJECT at the top of this file.")

        problems = []
        marks = {}  # student_id -> mark
        has_mark = set()  # names that have a real (non null) mark in the file

        for entry in load_json(MARKS_PATH):
            last, first, mark = entry["last_name"], entry["first_name"], entry["mark"]
            label = f"{last} {first}"
            key = (norm(last), norm(first))

            if key not in previous_by_name:
                problems.append(f"{label}: not found in students.json")
                continue
            if mark is not None and (isinstance(mark, bool) or not isinstance(mark, (int, float)) or not 0 <= mark <= 20):
                problems.append(f"{label}: invalid mark {mark!r}")
                continue

            rows = connection.execute(
                "SELECT id FROM Student WHERE hash = ? AND lastYearsAverage IS ?",
                (hash_name(last), previous_by_name[key]),
            ).fetchall()
            if len(rows) != 1:
                problems.append(f"{label}: {len(rows)} matching rows in the Student table, expected 1")
                continue
            if rows[0][0] in marks:
                problems.append(f"{label}: listed twice")
                continue
            marks[rows[0][0]] = mark
            if mark is not None:
                has_mark.add(key)

        if problems:
            print(f"{len(problems)} problem(s), nothing was written:")
            for message in problems:
                print("  -", message)
            sys.exit(1)

        for student_id, mark in marks.items():
            if mark is None:
                connection.execute(
                    f"UPDATE Mark SET {TEST_TYPE} = NULL WHERE student_id = ? AND subject_slug = ?",
                    (student_id, SUBJECT),
                )
            else:
                connection.execute(
                    f"""
                    INSERT INTO Mark (student_id, subject_slug, {TEST_TYPE}) VALUES (?, ?, ?)
                    ON CONFLICT(student_id, subject_slug) DO UPDATE SET {TEST_TYPE} = excluded.{TEST_TYPE}
                    """,
                    (student_id, SUBJECT, float(mark)),
                )
        connection.commit()

        total = connection.execute("SELECT COUNT(*) FROM Student WHERE is_enrolled = 1").fetchone()[0]
        marked = connection.execute(
            f"""
            SELECT COUNT(*) FROM Mark m JOIN Student s ON s.id = m.student_id
            WHERE m.subject_slug = ? AND s.is_enrolled = 1 AND m.{TEST_TYPE} IS NOT NULL
            """,
            (SUBJECT,),
        ).fetchone()[0]

    print(f"{SUBJECT} {TEST_TYPE}: {len(has_mark)} marks written, {marked}/{total} students have a mark.")
    if 0 < marked < total:
        print("PARTIAL: the site will show a FATAL ERROR. Students without a mark in this file:")
        for key in previous_by_name:
            if key not in has_mark:
                print("  -", " ".join(key))


if __name__ == "__main__":
    import_marks()