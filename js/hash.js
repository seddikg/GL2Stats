/*
 * Browser side version of hashing.py: hash_name().
 * Same steps: strip accents, uppercase, keep A-Z and 0-9 only, trim,
 * then scrypt(n=2^14, r=8, p=1, 32 bytes) with the pepper as salt.
 */
(function (root) {
  const GL = (root.GL = root.GL || {});

  function normalizeLastName(name) {
    return String(name)
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  }

  function toHex(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function getScrypt() {
    const lib = root.scrypt;
    if (!lib) throw new Error("scrypt library failed to load.");
    return typeof lib === "function" ? lib : lib.scrypt;
  }

  async function hashLastName(name, pepper, scryptFn) {
    const text = normalizeLastName(name);
    if (!text) throw new Error("Please type your last name.");
    const enc = new TextEncoder();
    const out = await (scryptFn || getScrypt())(enc.encode(text), enc.encode(pepper), 16384, 8, 1, 32);
    return toHex(out);
  }

  Object.assign(GL, { normalizeLastName, hashLastName });
  if (typeof module !== "undefined" && module.exports) module.exports = GL;
})(typeof window !== "undefined" ? window : globalThis);
