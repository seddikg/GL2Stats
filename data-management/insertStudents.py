"""
Imports students from private/students.json into the GL2Stats database.

Each student's last name is hashed, so the name itself is never stored.
students.json is gitignored. Running the script again only adds missing rows.
"""
import json
import sqlite3
from collections import Counter
from pathlib import Path

from hashing import hash_name

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "gl2stats.db"
JSON_PATH = Path(__file__).resolve().parent / "private" / "students.json"


def import_students(db_path=DB_PATH, json_path=JSON_PATH):
    """Insert one row per student, allowing several students to share a last name."""
    with open(json_path, encoding="utf-8") as file:
        students = json.load(file)

    with sqlite3.connect(db_path) as connection:
        existing = Counter(row[0] for row in connection.execute("SELECT hash FROM Student"))
        added = 0
        for student in students:
            student_hash = hash_name(student["last_name"])
            if existing[student_hash] > 0:
                existing[student_hash] -= 1
                continue
            connection.execute(
                "INSERT INTO Student (hash, lastYearsAverage, is_enrolled) VALUES (?, ?, 1)",
                (student_hash, student["previous_average"]),
            )
            added += 1
        connection.commit()

    print(f"{len(students)} students in JSON, {added} rows added")
    return added


if __name__ == "__main__":
    import_students()
