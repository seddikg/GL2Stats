"""
Deterministic hashing of student last names for GL2Stats.

The same last name always gives the same hash, so a student can type
their last name and be found, but the name itself is never stored.
"""
import hashlib
import os
import re
import unicodedata
from pathlib import Path

# Secrets live in data-management/private/.env, which is gitignored.
ENV_PATH = Path(__file__).resolve().parent / "private" / ".env"


def load_env(path=ENV_PATH):
    """Load simple KEY=VALUE pairs from a .env file into os.environ."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line.removeprefix("export ")
        key, separator, value = line.partition("=")
        if not separator:
            continue
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


load_env()

# Secret pepper, kept in the gitignored .env and never stored in the database.
PEPPER_ENV_VAR = os.environ.get("PEPPER_ENV_VAR", "")


def normalize_name(name):
    """Make different spellings of the same last name produce the same string.

    - strips accents (Hédi -> HEDI)
    - uppercases
    - treats hyphens, apostrophes and punctuation as spaces
    - collapses repeated spaces

    This must stay identical to normalizeLastName() in js/hash.js.
    """
    text = unicodedata.normalize("NFKD", name)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.upper()
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return " ".join(text.split())


def _get_pepper():
    if not PEPPER_ENV_VAR:
        raise RuntimeError(
            f"PEPPER_ENV_VAR is not set. Add it to {ENV_PATH} as "
            "PEPPER_ENV_VAR=<long random secret> before hashing names."
        )
    return PEPPER_ENV_VAR.encode("utf-8")


def hash_name(last_name):
    """Return a hex digest for the given last name."""
    normalized = normalize_name(last_name)
    if not normalized:
        raise ValueError("Name is empty after normalization.")

    digest = hashlib.scrypt(
        normalized.encode("utf-8"),
        salt=_get_pepper(),
        n=2**14,
        r=8,
        p=1,
        dklen=32,
    )
    return digest.hex()


def find_student_id(connection, last_name):
    """Look up a student id from a typed last name, or None if not found."""
    row = connection.execute(
        "SELECT id FROM Student WHERE hash = ? AND is_enrolled = 1",
        (hash_name(last_name),),
    ).fetchone()
    return row[0] if row else None