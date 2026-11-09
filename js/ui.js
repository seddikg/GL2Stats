/* Shared page helpers: session, navbar, formatting, error banners. */
(function (root) {
  const GL = (root.GL = root.GL || {});

  const KEY_ME = "gl2.studentId";
  const KEY_VIEW = "gl2.viewId";

  function safeGet(store, key) {
    try {
      return store.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function safeSet(store, key, value) {
    try {
      store.setItem(key, value);
    } catch (e) {
      /* storage blocked, ignore */
    }
  }

  const session = {
    me() {
      const v = safeGet(root.localStorage, KEY_ME);
      return v === null ? null : Number(v);
    },
    login(id) {
      safeSet(root.localStorage, KEY_ME, String(id));
    },
    logout() {
      try {
        root.localStorage.removeItem(KEY_ME);
        root.sessionStorage.removeItem(KEY_VIEW);
      } catch (e) {
        /* ignore */
      }
    },
    // Student.html only opens after a click on a leaderboard hash.
    setView(id) {
      safeSet(root.sessionStorage, KEY_VIEW, String(id));
    },
    view() {
      const v = safeGet(root.sessionStorage, KEY_VIEW);
      return v === null ? null : Number(v);
    },
  };

  function requireLogin() {
    const id = session.me();
    if (id === null || Number.isNaN(id)) {
      root.location.replace("index.html");
      return null;
    }
    return id;
  }

  function fmt(x, digits) {
    return GL.isNum(x) ? x.toFixed(digits === undefined ? 2 : digits) : "-";
  }

  function esc(text) {
    const d = root.document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  function shortHash(hash) {
    return hash.slice(0, 8);
  }

  function markClass(value) {
    if (!GL.isNum(value)) return "none";
    if (value >= root.GL_CONFIG.passMark) return "pass";
    if (value >= 8) return "mid";
    return "fail";
  }

  function renderNav(active) {
    const links = [
      ["index.html", "Home", "home"],
      ["Ranking.html", "Ranking", "ranking"],
      ["Subjects.html", "Subjects", "subjects"],
    ];
    const items = links
      .map(([href, label, key]) => '<li><a href="' + href + '"' + (key === active ? ' class="active"' : "") + ">" + label + "</a></li>")
      .join("");
    const logout = session.me() !== null ? '<li><button type="button" id="logout-btn">Log out</button></li>' : "";
    const nav = root.document.getElementById("nav");
    nav.className = "navbar";
    nav.innerHTML =
      '<div class="container"><a class="brand" href="index.html">GL2Stats</a><ul class="nav-links">' + items + logout + "</ul></div>";
    const btn = root.document.getElementById("logout-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        session.logout();
        root.location.href = "index.html";
      });
    }
  }

  function showErrors(messages) {
    const box = root.document.getElementById("errors");
    if (!box) return;
    box.innerHTML = messages.map((m) => '<div class="alert alert-danger">' + esc(m) + "</div>").join("");
  }

  // Replaces the whole page content: the site stops working on purpose.
  function showFatal(err) {
    const main = root.document.querySelector("main");
    const lines = (err.problems || [])
      .map((x) => "<li>" + esc(x.name) + " (semester " + x.semester + "): " + x.missing + " of " + x.total + " students have no mark</li>")
      .join("");
    main.className = "container page";
    main.innerHTML =
      '<div class="alert alert-danger"><h2>FATAL ERROR</h2>' +
      "<p>Some subjects have marks for only part of the class, so no average can be trusted. The site is stopped until the database is fixed.</p>" +
      "<ul>" + lines + "</ul></div>";
  }

  // Wraps a page start so failures show up on screen instead of a blank page.
  async function boot(active, fn) {
    renderNav(active);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      if (err && err.name === "FatalDataError") {
        showFatal(err);
        return;
      }
      showErrors([String(err && err.message ? err.message : err)]);
      const app = root.document.getElementById("app");
      if (app) app.innerHTML = "";
    }
  }

  Object.assign(GL, { session, requireLogin, fmt, esc, shortHash, markClass, renderNav, showErrors, showFatal, boot });
  if (typeof module !== "undefined" && module.exports) module.exports = GL;
})(typeof window !== "undefined" ? window : globalThis);
