/*
 * Pure computation: averages, score, ranking and statistics.
 * No DOM access here, so it can be tested in Node.
 */
(function (root) {
  const GL = (root.GL = root.GL || {});

  const isNum = (x) => typeof x === "number" && Number.isFinite(x);

  // The three test types stored on a Mark row. A null value means "not
  // published"; a weight of 0 means the subject does not have that test.
  const TESTS = [
    { value: "midterm", weight: "midterm_weight", label: "midterm" },
    { value: "final", weight: "final_weight", label: "final" },
    { value: "lab", weight: "lab_weight", label: "lab" },
  ];

  function problemMessage(p) {
    const who = p.students.length ? " [" + p.students.join(", ") + "]" : "";
    if (p.kind === "zero-weight") {
      return (
        "Zero-weight " + p.test + " in " + p.subject + " (semester " + p.semester + "): " +
        p.students.length + " of " + p.total + " students have a value but the weight is 0" + who
      );
    }
    return (
      "Incomplete " + p.test + " in " + p.subject + " (semester " + p.semester + "): " +
      p.students.length + " of " + p.total + " students have no value" + who
    );
  }

  // Raised when the Mark table is inconsistent. This is by design: the site
  // refuses to run on marks that cannot be trusted.
  class FatalDataError extends Error {
    constructor(problems) {
      super("FATAL: " + problems.map(problemMessage).join("; "));
      this.name = "FatalDataError";
      this.problems = problems;
    }
  }

  // sum(mark * coef) / sum(coef), only over the marks that exist
  function weightedAverage(items) {
    let sumMarks = 0;
    let sumCoefs = 0;
    for (const item of items) {
      if (!isNum(item.value) || !isNum(item.coef)) continue;
      sumMarks += item.value * item.coef;
      sumCoefs += item.coef;
    }
    return sumCoefs > 0 ? sumMarks / sumCoefs : null;
  }

  // this_year_average = (sem1 + sem2) / 2, or whichever semester exists
  function thisYearAverage(s1, s2) {
    if (isNum(s1) && isNum(s2)) return (s1 + s2) / 2;
    if (isNum(s1)) return s1;
    if (isNum(s2)) return s2;
    return null;
  }

  // score = (last + 0.5 + (this + 0.5) * 2) / 3
  // fallback when there are no marks at all: (last + 0.5)
  function score(last, s1, s2) {
    if (!isNum(last)) return null;
    const current = thisYearAverage(s1, s2);
    if (current === null) return (last + 0.5);
    return (last + 0.5 + (current + 0.5) * 2) / 3;
  }

  /*
   * input:  { students: [{id, hash, lastYearsAverage}],
   *           subjects: [{slug, name, coefficient, semester_number,
   *                       midterm_weight, final_weight, lab_weight}],
   *           marks:    [{student_id, subject_slug, midterm, final, lab}] }
   * output: { rows, subjects, errors }
   * A subject mark is the weight-normalised mean of the published tests.
   * Rows are sorted by score, descending, and carry a competition rank.
   */
  function computeAll(input) {
    const subjectBySlug = new Map(input.subjects.map((s) => [s.slug, s]));
    const total = input.students.length;

    // student_id -> subject_slug -> Mark row
    const rowByStudent = new Map();
    for (const m of input.marks) {
      if (!rowByStudent.has(m.student_id)) rowByStudent.set(m.student_id, new Map());
      rowByStudent.get(m.student_id).set(m.subject_slug, m);
    }
    const rowOf = (studentId, slug) => {
      const bySlug = rowByStudent.get(studentId);
      return bySlug ? bySlug.get(slug) : undefined;
    };

    /*
     * Weights live on the Subject row, so there is exactly one weight per test
     * per subject. For every subject and test type:
     *   weight is 0         -> the subject has no such test; any value is fatal
     *   value for everyone   -> the test is published and used
     *   value for nobody     -> the test is ignored (not published yet)
     *   value for some       -> fatal error
     */
    // The strict clean-database check can be disabled in js/config.js.
    const loginChecks = !(root.GL_CONFIG && root.GL_CONFIG.debug === false);

    const activeBySlug = new Map();
    const problems = [];
    for (const sub of input.subjects) {
      const active = new Set();
      for (const test of TESTS) {
        const weight = sub[test.weight];
        const hasWeight = isNum(weight) && weight > 0;
        const missing = [];
        const withValue = [];
        const offenders = [];
        for (const st of input.students) {
          const row = rowOf(st.id, sub.slug);
          const value = row ? row[test.value] : null;
          if (value === null || value === undefined) {
            missing.push(st.hash);
          } else {
            withValue.push(st.hash);
            if (!hasWeight) offenders.push(st.hash);
          }
        }
        if (loginChecks && offenders.length) {
          problems.push({
            kind: "zero-weight",
            subject: sub.name,
            semester: sub.semester_number,
            test: test.label,
            students: offenders,
            total,
          });
        }
        if (!hasWeight || withValue.length === 0) continue;
        if (withValue.length < total) {
          problems.push({
            kind: "incomplete",
            subject: sub.name,
            semester: sub.semester_number,
            test: test.label,
            students: missing,
            total,
          });
        } else {
          active.add(test.value);
        }
      }
      activeBySlug.set(sub.slug, active);
    }
    if (problems.length) throw new FatalDataError(problems);

    const errors = [];
    const rows = input.students.map((st) => {
      const marks = {};
      for (const sub of input.subjects) {
        const active = activeBySlug.get(sub.slug);
        if (!active || active.size === 0) continue;
        const row = rowOf(st.id, sub.slug);
        if (!row) continue;

        let sumMarks = 0;
        let sumWeights = 0;
        for (const test of TESTS) {
          if (!active.has(test.value)) continue;
          const value = row[test.value];
          const weight = sub[test.weight];
          if (!isNum(value) || !isNum(weight) || weight <= 0) continue;
          sumMarks += value * weight;
          sumWeights += weight;
        }
        if (sumWeights > 0) marks[sub.slug] = sumMarks / sumWeights;
      }

      const tests = {};
      for (const sub of input.subjects) {
        const markRow = rowOf(st.id, sub.slug);
        tests[sub.slug] = {
          midterm: markRow ? markRow.midterm : null,
          final: markRow ? markRow.final : null,
          lab: markRow ? markRow.lab : null,
        };
      }

      const bySem = { 1: [], 2: [] };
      for (const [slug, value] of Object.entries(marks)) {
        const sub = subjectBySlug.get(slug);
        if (!sub) continue;
        if (bySem[sub.semester_number]) {
          bySem[sub.semester_number].push({ value, coef: sub.coefficient });
        }
      }
      const prev = isNum(st.lastYearsAverage) ? st.lastYearsAverage : null;
      const s1 = weightedAverage(bySem[1]);
      const s2 = weightedAverage(bySem[2]);
      const thisYear = thisYearAverage(s1, s2);
      const row = {
        id: st.id,
        hash: st.hash,
        previous: prev,
        marks,
        tests,
        s1,
        s2,
        thisYear,
        score: score(prev, s1, s2),
        rank: null,
      };

      if (prev === null) {
        errors.push({
          id: st.id,
          message: "Student " + st.hash.slice(0, 8) + " has no last year average, so no score can be computed.",
        });
      }
      return row;
    });

    rows.sort((a, b) => {
      const sa = a.score === null ? -Infinity : a.score;
      const sb = b.score === null ? -Infinity : b.score;
      if (sb !== sa) return sb - sa;
      return a.id - b.id;
    });

    let lastScore = null;
    let lastRank = 0;
    rows.forEach((row, i) => {
      if (row.score === null) return;
      if (lastScore !== null && Math.abs(row.score - lastScore) < 1e-9) {
        row.rank = lastRank;
      } else {
        row.rank = i + 1;
        lastRank = row.rank;
        lastScore = row.score;
      }
    });

    return { rows, subjects: input.subjects, errors };
  }

  // ---------- statistics ----------

  function quantile(sorted, p) {
    if (sorted.length === 1) return sorted[0];
    const pos = (sorted.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function stats(values, passMark) {
    const v = values.filter(isNum).sort((a, b) => a - b);
    const n = v.length;
    if (n === 0) return null;

    const mean = v.reduce((s, x) => s + x, 0) / n;
    const sumSq = v.reduce((s, x) => s + (x - mean) ** 2, 0);
    const variance = sumSq / n; // population variance
    const std = Math.sqrt(variance);
    const sampleVariance = n > 1 ? sumSq / (n - 1) : null;
    const sampleStd = sampleVariance === null ? null : Math.sqrt(sampleVariance);
    const skewness = std > 0 ? v.reduce((s, x) => s + (x - mean) ** 3, 0) / n / std ** 3 : 0;
    const q1 = quantile(v, 0.25);
    const q3 = quantile(v, 0.75);

    return {
      n,
      mean,
      median: quantile(v, 0.5),
      min: v[0],
      max: v[n - 1],
      range: v[n - 1] - v[0],
      variance,
      std,
      sampleVariance,
      sampleStd,
      q1,
      q3,
      iqr: q3 - q1,
      skewness,
      passRate: v.filter((x) => x >= passMark).length / n,
    };
  }

  // Abramowitz and Stegun 7.1.26, max error about 1.5e-7
  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly =
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    return sign * (1 - poly * Math.exp(-ax * ax));
  }

  const normalCdf = (x, mean, std) => 0.5 * (1 + erf((x - mean) / (std * Math.SQRT2)));

  /*
   * Histogram with equal bins on [0, max].
   * Returns counts, observed probabilities, bin labels and, when the data
   * has a spread, the probability mass a fitted normal curve puts in each bin.
   */
  function distribution(values, bins, max) {
    const v = values.filter(isNum);
    const width = max / bins;
    const counts = new Array(bins).fill(0);
    for (const x of v) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(x / width)));
      counts[idx] += 1;
    }
    const n = v.length;
    const probs = counts.map((c) => (n ? c / n : 0));
    const labels = counts.map((_, i) => {
      const lo = i * width;
      const hi = (i + 1) * width;
      return lo + "-" + hi;
    });

    const s = stats(v, 0);
    let normal = null;
    if (s && s.std > 1e-9) {
      normal = counts.map((_, i) => {
        const lo = i === 0 ? -Infinity : i * width;
        const hi = i === bins - 1 ? Infinity : (i + 1) * width;
        const upper = hi === Infinity ? 1 : normalCdf(hi, s.mean, s.std);
        const lower = lo === -Infinity ? 0 : normalCdf(lo, s.mean, s.std);
        return upper - lower;
      });
    }
    return { counts, probs, labels, normal, width };
  }

  Object.assign(GL, { FatalDataError, TESTS, isNum, weightedAverage, thisYearAverage, score, computeAll, stats, distribution, normalCdf });

  if (typeof module !== "undefined" && module.exports) module.exports = GL;
})(typeof window !== "undefined" ? window : globalThis);
