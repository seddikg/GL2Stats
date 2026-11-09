"""
Rebuilds the GL2Stats database from scratch.

Deletes the existing database file, recreates the tables, then inserts
the subjects and students.
"""
from pathlib import Path

from createDB import DB_PATH, create_database
from insertStudents import import_students
from insertSubjects import insert_subjects


def rebuild_database(db_path=DB_PATH):
    """Delete the database, recreate it, and repopulate it."""
    db_path = Path(db_path)
    if db_path.exists():
        db_path.unlink()

    create_database(db_path)
    subject_count = insert_subjects(db_path)
    student_count = import_students(db_path)

    print(f"Rebuilt {db_path} with {subject_count} subjects and {student_count} students")
    return db_path


if __name__ == "__main__":
    rebuild_database()
