/* Loads the read-only SQLite file in the browser with sql.js. */
(function (root) {
  const GL = (root.GL = root.GL || {});

  async function openDb() {
    if (typeof root.initSqlJs !== "function") throw new Error("sql.js failed to load.");
    const cfg = root.GL_CONFIG;
    const SQL = await root.initSqlJs({ locateFile: (file) => cfg.sqlJsBase + file });
    const res = await fetch(cfg.dbPath, { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not download " + cfg.dbPath + " (HTTP " + res.status + ").");
    return new SQL.Database(new Uint8Array(await res.arrayBuffer()));
  }

  function query(db, sql, params) {
    const stmt = db.prepare(sql);
    const out = [];
    try {
      if (params) stmt.bind(params);
      while (stmt.step()) out.push(stmt.getAsObject());
    } finally {
      stmt.free();
    }
    return out;
  }

  let cache = null;

  // Reads everything once per page load and returns computed rows.
  async function loadAll() {
    if (cache) return cache;
    const db = await openDb();
    try {
      const students = query(db, "SELECT id, hash, lastYearsAverage FROM Student WHERE is_enrolled = 1");
      const subjects = query(
        db,
        "SELECT slug, name, coefficient, semester_number FROM Subject ORDER BY semester_number, rowid"
      );
      const marks = query(db, "SELECT student_id, subject_slug, value FROM Mark");
      cache = GL.computeAll({ students, subjects, marks });
    } finally {
      db.close();
    }
    return cache;
  }

  Object.assign(GL, { openDb, query, loadAll });
  if (typeof module !== "undefined" && module.exports) module.exports = GL;
})(typeof window !== "undefined" ? window : globalThis);
