# GL2Stats

A small static website for the GL2 class (Génie Logiciel, INSAT). A student types their last name, the browser hashes it, and the site shows their marks, their rank and class statistics. Real names are never stored: the database only holds hashes.

The site is plain HTML, CSS and JavaScript. It runs on GitHub Pages and reads a read-only SQLite file (`gl2stats.db`) directly in the browser with [sql.js](https://github.com/sql-js/sql.js). All marks are written into the database with Python scripts, then the database is pushed.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Asks for a last name and the pepper, matches the name to a hash and shows your rank, score, last year average, semester averages and this year average. |
| `ranking.html` | Leaderboard sorted by score, highest first. Columns: rank, hash, score, last year, sem 1, sem 2. Equal scores share a rank. |
| `student.html` | The marks of one student (hash only, no name), with the class average per subject and per test. Only reachable by clicking a hash on the leaderboard. |
| `subjects.html` | Pick a subject (grouped by semester) and switch between the same distribution graph and statistics for each test with a non-zero weight and for the whole subject. Tests with no marks show N/A. |

Every page except the login screen requires a session: the student id chosen at login is kept in `localStorage`, and `student.html` also needs a one-time view id in `sessionStorage` set by a click on the leaderboard. There is no server, so "login" only means "find a row by hash".

## Privacy model

Student last names are never written to the database. The import script turns each last name into a deterministic hash:

1. Normalize the name: strip accents (`Hédi` becomes `HEDI`), uppercase, replace anything that is not `A-Z` or `0-9` with a space, then collapse and trim spaces.
2. Run `scrypt` with `n = 2^14`, `r = 8`, `p = 1`, a 32-byte output, and the pepper as the salt.
3. Store only the hex digest in `Student.hash`.

The same last name always produces the same hash, so a student can type their name and be found. `js/hash.js` and `data-management/hashing.py` implement exactly the same normalization and parameters; if one changes, the other must change too or no lookup will match.

The pepper is a secret shared by the class. It is not stored in the repository or in the database, is never written to browser storage, and is typed into the login form, so it is only used for that page visit. The value typed at login must be the same value used to build the database.

This hides names at rest, but it is not strong authentication: the pepper is shared, the class is small, and two identical hashes reveal that two students share a last name. Treat it as privacy by obscurity, not as real protection.

## Project layout

```text
GL2Stats/
├── index.html              # Login and personal dashboard
├── ranking.html            # Leaderboard
├── student.html            # One student's marks
├── subjects.html           # Per-subject statistics and chart
├── gl2stats.db             # Read-only SQLite database served to the browser
├── css/
│   ├── gl-theme.css        # Colors, fonts and shared theme
│   ├── app.css             # Page layout and components
│   └── style.css           # Additional styles
├── js/
│   ├── config.js           # Database path, pass mark and scale
│   ├── core.js             # Pure computation: averages, score, ranks, statistics
│   ├── db.js               # Loads gl2stats.db with sql.js and caches the rows
│   ├── hash.js             # Browser version of the last-name hash
│   ├── ui.js               # Session, navbar, formatting and error helpers
│   ├── index.js            # Login page logic
│   ├── ranking.js          # Leaderboard page logic
│   ├── student.js          # Student page logic
│   └── subjects.js         # Statistics page and Chart.js graph
└── data-management/
    ├── createDB.py         # Creates the tables
    ├── db.py               # Deletes and rebuilds the whole database
    ├── hashing.py          # Python version of the last-name hash
    ├── insertStudents.py   # Imports private/students.json as hashes
    ├── insertSubjects.py   # Inserts semesters, subjects and test weights
    ├── importMarks.py      # Imports one test's marks for one subject
    └── private/            # Gitignored: names, marks and secrets
        ├── .env            # Contains PEPPER_ENV_VAR
        ├── students.json   # Students with their last year average
        ├── marksExample.json
        └── marks.json      # Filled from the example, one test at a time
```

The frontend has no build step and no global state other than `window.GL` and `window.GL_CONFIG`. `core.js` is DOM-free so it can also be loaded in Node for testing.

## Database schema

```sql
Semester(number INTEGER PRIMARY KEY);

Subject(slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        coefficient REAL NOT NULL DEFAULT 1,
        semester_number INTEGER REFERENCES Semester(number),
        midterm_weight REAL NOT NULL DEFAULT 0,
        final_weight REAL NOT NULL DEFAULT 0,
        lab_weight REAL NOT NULL DEFAULT 0);

Student(id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        lastYearsAverage REAL NOT NULL,
        is_enrolled BOOLEAN NOT NULL DEFAULT 1);

Mark(student_id INTEGER NOT NULL REFERENCES Student(id),
     subject_slug TEXT NOT NULL REFERENCES Subject(slug),
     midterm REAL,
     final REAL,
     lab REAL,
     PRIMARY KEY (student_id, subject_slug));
```

`Student.hash` is not unique, because several students can share a last name. When a typed last name matches more than one student, the login form also asks for last year's average to tell them apart. `is_enrolled = 0` rows are ignored by the site.

## Averages, score and rank

- A subject mark is the test-weight-weighted mean of its published tests: `sum(test mark * test weight) / sum(test weight)`. A test with weight `0` does not exist for that subject.
- A semester average is the coefficient-weighted mean of the subject marks in that semester: `sum(mark * coefficient) / sum(coefficient)`.
- The this-year average is the mean of the two semester averages, or the only one that exists.
- The score is:

  ```text
  score = (last year + 0.5 + (this year + 0.5) * 2) / 3
  ```

  If there are no marks at all this year, the score falls back to `last year + 0.5`.

- Rows are sorted by score, highest first. Equal scores share a rank and the next distinct score skips the tied positions.

Marks are handled strictly on purpose. A test with no marks at all is ignored in every average. A test that has marks for some students but not all is a fatal data error: the site stops and lists the incomplete tests instead of showing averages that cannot be trusted.

## Statistics page

For the selected subject, `js/core.js` computes the same statistics for each test with a non-zero weight and for the whole subject mark described above:

- number of students, mean, median, min, max and range
- population variance and standard deviation
- sample variance and standard deviation (`n - 1`)
- first and third quartiles and the interquartile range
- skewness, with a short interpretation (tail left, tail right or roughly symmetric)
- pass rate, using the pass mark from `js/config.js` (`10` out of `20`)

The chart is a histogram of the marks in 20 equal bins, expressed as probabilities, with a fitted normal curve. The bin containing the logged-in student's mark is highlighted.

## Run locally

The database is fetched with `fetch`, so opening the HTML files directly with `file://` will not work. Serve the folder over HTTP:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/` and type the pepper used to build `gl2stats.db`.

Any static server works; there is no backend and no build command.

## Build or rebuild the database

### Requirements

- Python 3.9 or newer. The scripts use only the standard library (`sqlite3`, `hashlib`, `json`, `pathlib`, `os`, `re`, `unicodedata`).
- A `data-management/private/students.json` file.
- A `data-management/private/.env` file containing the pepper.

Create a virtual environment if you want one:

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
```

### Private files

`data-management/private/students.json` is a JSON array. Only `last_name` and `previous_average` are used by the importer:

```json
[
  {"last_name": "BROOE", "first_name": "ROBERT", "previous_average": 12.72},
  {"last_name": "SMITH", "first_name": "JOHN", "previous_average": 13.01}
]
```

`data-management/private/.env` holds the pepper:

```dotenv
PEPPER_ENV_VAR=some-long-random-secret
```

The whole `private/` directory is gitignored. Never commit it.

### Commands

Run from the repository root:

```bash
# Rebuild everything: delete, create tables, insert subjects and students
python data-management/db.py

# Or run the steps separately
python data-management/createDB.py
python data-management/insertSubjects.py
python data-management/insertStudents.py
```

`insertStudents.py` hashes each `last_name` and adds one row per student. Running it again only inserts hashes that are not already present, so students sharing a last name are preserved.

To import marks, copy `private/marksExample.json` to `private/marks.json`, set `SUBJECT` and `TEST_TYPE` (`midterm`, `final` or `lab`) at the top of `importMarks.py`, fill in the marks, then run:

```bash
python data-management/importMarks.py
```

The script writes each mark into the column selected by `TEST_TYPE`. A null mark clears that test for the student and leaves the other tests untouched. Any `TEST_TYPE` other than `midterm`, `final` or `lab` is a fatal error. Test weights are edited per subject in the last three fields of each `SUBJECTS` tuple in `insertSubjects.py`; rerun that script to apply them.

After changing marks, commit the database again. Because `*.db` is gitignored, force-add it:

```bash
git add -f gl2stats.db
```

To use the rebuilt database, log in with the same pepper that was in `.env` when the names were hashed. A different pepper produces different hashes and no student will be found.

## Deploy to GitHub Pages

1. Push the repository to GitHub, including `gl2stats.db`.
2. Open the repository settings, then **Pages**.
3. Set the source to **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Open the published URL. The site fetches `gl2stats.db` relative to `index.html`, so no extra configuration is needed.

## Dependencies

| Dependency | Version | Used for |
| --- | --- | --- |
| [sql.js](https://github.com/sql-js/sql.js) | 1.10.3 | Reading `gl2stats.db` in the browser |
| [scrypt-js](https://github.com/ricmoo/scrypt-js) | 3.0.1 | Hashing last names in the browser |
| [Chart.js](https://www.chartjs.org/) | 4.4.1 | Distribution chart on `subjects.html` |
| [Google Fonts](https://fonts.google.com/) | - | Inter and JetBrains Mono |
| Python standard library | 3.9+ | Building and filling the database |

All frontend dependencies are loaded from CDNs, so the site needs an internet connection on first load.

## Limitations

- Last-name-only login is not authentication. Anyone who knows the pepper and a last name can open that student's marks.
- The pepper is shared out of band; there is no account system or server-side check.
- The database is public and read-only. All writes happen offline through Python.
- Page data is loaded once per page load and cached in memory for that load.
- The site refuses to display averages when a published test is missing marks for part of the class, by design.
