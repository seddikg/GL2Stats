# Marks: calculation, validation and the fatal-error rules

This document explains how a subject mark is built from the three test types,
why the database is validated so aggressively, and what the site does when the
data is not clean.

## Design philosophy

Marks are always published together for the whole class. A test (midterm,
final or lab) is either published for **every enrolled student** or for
**nobody**. There is no legitimate state where only part of the class has a
value for a given test.

The site therefore treats the Mark table as an all-or-nothing contract. If the
contract is broken, the ranking and the statistics would silently be wrong, so
the site refuses to run and shows a FATAL ERROR instead. A clean database is a
hard requirement, not a nice-to-have.

## Schema

The weights live on the Subject row, so a subject has exactly one weight per
test. The Mark table has one row per `(student_id, subject_slug)`:

```sql
Subject(slug            TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        coefficient     REAL NOT NULL,
        semester_number INTEGER,
        midterm_weight  REAL NOT NULL DEFAULT 0,
        final_weight    REAL NOT NULL DEFAULT 0,
        lab_weight      REAL NOT NULL DEFAULT 0);

Mark(student_id   INTEGER NOT NULL REFERENCES Student(id),
     subject_slug TEXT    NOT NULL REFERENCES Subject(slug),
     midterm      REAL    DEFAULT NULL,
     final        REAL    DEFAULT NULL,
     lab          REAL    DEFAULT NULL,
     PRIMARY KEY (student_id, subject_slug));
```

- A **NULL value** means that test has no mark for that student.
- A **numeric value** is a real mark. `0` is a valid mark, not "missing": only
  NULL/absent means missing.
- A **weight of 0** on the subject means the subject does not have that test at
  all (for example, a subject with no midterm). Because the weight is stored on
  the subject, every student automatically shares the same weight.

## Importing marks

`importMarks.py` imports one test at a time. Set `TEST_TYPE` to `midterm`,
`final` or `lab` (anything else is a fatal error) and `SUBJECT` to a subject
slug, then run the script with `private/marks.json`. Each mark is written into
the matching column; a null mark clears only that column. The other test types
keep their existing values, so the three tests can be imported independently.

## How a subject mark is computed

For one student and one subject, only the published tests are used:

```text
mark = sum(value * weight) / sum(weight)
```

summed over the test types that are published and have a weight greater than 0.

Rules:

- A test with a NULL value is not added to the numerator and its weight is not
  added to the denominator.
- A test with weight 0 is never added to either side (the subject does not have
  that test).
- If no test contributes, the subject has no mark for anyone and is ignored:
  it does not enter the semester average, the ranking or the statistics.
- A published test with value `0` is counted normally.

The resulting subject mark then behaves exactly like the old single-value Mark:
it is combined with the subject coefficient to form the semester average, and
the semester averages feed the this-year average, the score and the rank.

## Validation on every data load

`computeAll` (in `js/core.js`) validates the whole Mark table every time the
data is loaded, which happens on every page load and when a session is
restored. There are two independent checks.

The first is a "clean database" check. It can be disabled by setting
`debug: false` in `js/config.js`. The second check always runs, because an
incomplete published test would directly corrupt the calculations.

### 1. No value on a zero-weight test

A weight of 0 means the subject has no such test. Therefore, if **any** student
has a non-NULL value on a test whose weight is 0, the data is dirty and the
site raises a FATAL ERROR. This is stricter than the calculation needs (a
zero weight contributes nothing), but the project's rule is that the database
must be clean, with no leftover marks on tests the subject does not have.

The error lists the hashes of the offending students.

### 2. All-or-none per test type (always on)

For every subject and every test type with a weight greater than 0:

| Students with a value | Meaning | Action |
| --- | --- | --- |
| all enrolled students | the test is published | use it in the calculation |
| nobody | the test is not published yet | ignore it (do not add it or its weight) |
| some, but not all | the insertion is broken | **FATAL ERROR** |

The "nobody" case is valid because a subject can have a midterm published
before the final. That only affects the calculation for that subject, never
the rest of the site.

The "some, but not all" case only happens when marks were inserted incorrectly.
Because the class is small, the error lists the hashes of the students who are
missing the value.

## What a FATAL ERROR does

All checks collect every problem they find before throwing a `FatalDataError`.
`js/ui.js` then replaces the whole page with a FATAL ERROR panel that lists:

- the subject and semester,
- the test type (midterm / final / lab),
- the kind of problem: a value on a zero-weight test or an incomplete test,
- the count and the hashes of the students involved.

Nothing else on the page is rendered: no averages, no ranking, no statistics.
The site only works again once the database is fixed.

## Summary of cases

| Situation | Result |
| --- | --- |
| No student has any value for a subject | subject ignored everywhere |
| A test has a value for every student | test used in the subject mark |
| A test has no value for any student | test ignored, other tests still used |
| A test has a value for some students only | FATAL ERROR (always checked) |
| Any value exists on a test with weight 0 | FATAL ERROR (when `debug` is on) |
| A student has value `0` | valid mark, counted normally |
| A student has NULL for a published test | FATAL ERROR (missing value) |

## Why not guess?

A partial subject could be "completed" by treating missing values as 0 or by
dropping the missing students, but both choices silently change the ranking
and the class statistics. Since marks are published class-wide, a partial test
is always an insertion mistake, never a real state of the data. Stopping the
site makes the mistake impossible to miss and impossible to publish.
