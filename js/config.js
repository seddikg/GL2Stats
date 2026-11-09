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
  sqlJsBase: "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/",
};
