/*
 * Site configuration.
 *
 * The pepper is not stored here: the login form asks for it and keeps it only
 * for that page visit. It must match the PEPPER_ENV_VAR used by hashing.py
 * when the database was built.
 * Hashing only hides the names in the database; it is not real protection.
 */
window.GL_CONFIG = {
  dbPath: "gl2stats.db",
  passMark: 10,
  scale: 20,
  // When true, also check that no student has a value on a zero-weight test.
  // Setting it to false skips that check; the all-or-none check for published
  // tests always runs.
  debug: true,
  sqlJsBase: "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/",
};
