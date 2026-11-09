"""
Inserts the GL2 semesters and subjects into the GL2Stats database.

Source: INSAT GL2 curriculum, academic year 2022-2023.
Run create_database.py first so the tables exist.
The script is idempotent: running it again updates existing rows.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "gl2stats.db"

SEMESTERS = [1, 2]

# (slug, name, coefficient, semester_number)
SUBJECTS = [
    # Semester 1
    ("proba",  "Probabilités et Statistiques",   3,   1),
    ("math-signal",       "Mathématiques du signal",        3,   1),
    ("ado",   "Architecture des ordinateurs",   3,   1),
    ("se",      "Systèmes d'exploitation",        3,   1),
    ("tx",    "Techniques de transmission",     3,   1),
    ("bdd", "Bases de données relationnelles", 4, 1),
    ("oop", "Programmation orientée objet", 4,   1),
    ("python",      "Atelier Python Avancé",          2,   1),
    ("cpp",                "Atelier C++",                    2,   1),
    ("anglais-s1",                 "Anglais",                        1.5, 1),
    ("gestion",                    "Gestion",                        1.5, 1),
    ("francais-s1",                "Français",                       1.5, 1),

    # Semester 2
    ("algebre",                    "Algèbre",                        3,   2),
    ("analyse",                    "Analyse Mathématique",           3,   2),
    ("sgbd",                       "Systèmes de gestion de bases de données", 2.5, 2),
    ("conception",                 "Conception des systèmes d'information",   4,   2),
    ("java",                       "Atelier Java Avancé",            2,   2),
    ("dev-web",                    "Développement Web",              2,   2),
    ("reseaux",                    "Architecture des réseaux",       3,   2),
    ("applications-reparties",     "Applications réparties",         2.5, 2),
    ("unix",                        "Système d'exploitation UNIX",    2,   2),
    ("anglais-s2",                 "Anglais",                        1.5, 2),
    ("droit",                      "Droit de l'homme",               1.5, 2),
    ("francais-s2",                "Français",                       1.5, 2),
    ("comptabilite",               "Comptabilité",                   1.5, 2),
]


def insert_subjects(db_path=DB_PATH):
    """Insert semesters and subjects, updating subjects that already exist."""
    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")

        connection.executemany(
            "INSERT OR IGNORE INTO Semester (number) VALUES (?)",
            [(number,) for number in SEMESTERS],
        )

        connection.executemany(
            """
            INSERT INTO Subject (slug, name, coefficient, semester_number)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                name            = excluded.name,
                coefficient     = excluded.coefficient,
                semester_number = excluded.semester_number
            """,
            SUBJECTS,
        )
        connection.commit()

    return len(SUBJECTS)


if __name__ == "__main__":
    count = insert_subjects()
    print(f"Inserted or updated {count} subjects in {DB_PATH}")