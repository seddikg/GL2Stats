(function () {
  const GL = window.GL;
  const $ = (id) => document.getElementById(id);

  function setStatus(text, isError) {
    const el = $("status");
    el.textContent = text;
    el.className = "status" + (isError ? " error" : "");
  }

  function statCard(label, value, sub, small) {
    return (
      '<div class="card stat"><div class="value' + (small ? " small" : "") + '">' + GL.esc(value) +
      '</div><div class="label">' + GL.esc(label) + "</div>" +
      (sub ? '<div class="sub">' + GL.esc(sub) + "</div>" : "") + "</div>"
    );
  }

  function showLogin() {
    $("dashboard").classList.add("hidden");
    $("login-section").classList.remove("hidden");
    $("lastname").focus();
  }

  async function showDashboard(id) {
    const data = await GL.loadAll();
    const row = data.rows.find((r) => r.id === id);
    if (!row) return false;

    $("login-section").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("me-hash").textContent = GL.shortHash(row.hash);

    const ranked = data.rows.filter((r) => r.rank !== null).length;
    const rankPct = row.rank === null || ranked === 0 ? null : Math.round((row.rank / ranked) * 100);
    $("me-stats").innerHTML =
      statCard("Rank", row.rank === null ? "-" : "#" + row.rank, "out of " + ranked) +
      statCard("Ranking", rankPct === null ? "-" : rankPct + "%", "In percentages (less is better)", true) +
      statCard("Score", GL.fmt(row.score),"(MPI+GL2*2)/3+0.5") +
      statCard("Last year's Average", GL.fmt(row.previous), "", true) +
      statCard("Semester 1 Average", GL.fmt(row.s1), "", true) +
      statCard("Semester 2 Average", GL.fmt(row.s2), "", true) +
      statCard("This year's Average", GL.fmt(row.thisYear), "", true);

    $("formula-note").textContent =
      "";

    GL.showErrors(data.errors.filter((e) => e.id === row.id).map((e) => e.message));

    $("my-marks").onclick = () => {
      GL.session.setView(row.id);
      window.location.href = "student.html";
    };
    return true;
  }

  async function onSubmit(event) {
    event.preventDefault();
    const btn = $("login-btn");
    btn.disabled = true;
    try {
      setStatus("Hashing your name...", false);
      const hash = await GL.hashLastName($("lastname").value, $("pepper").value, undefined);

      setStatus("Looking you up...", false);
      const data = await GL.loadAll();
      const matches = data.rows.filter((r) => r.hash === hash);

      if (matches.length === 0) {
        setStatus("No student found with that last name. Check the spelling.", true);
        return;
      }

      let chosen = null;
      if (matches.length === 1) {
        chosen = matches[0];
      } else {
        const group = $("prev-group");
        const raw = $("prev").value.trim().replace(",", ".");
        if (group.classList.contains("hidden") || raw === "") {
          group.classList.remove("hidden");
          $("prev").focus();
          setStatus("Several students share this last name. Enter last year's average to continue.", true);
          return;
        }
        const typed = Number(raw);
        if (!Number.isFinite(typed)) {
          setStatus("Last year's average must be a number.", true);
          return;
        }
        const hits = matches.filter(
          (r) => r.previous !== null && Math.round(r.previous * 100) === Math.round(typed * 100)
        );
        if (hits.length !== 1) {
          setStatus("That average does not match any student with this last name.", true);
          return;
        }
        chosen = hits[0];
      }

      GL.session.login(chosen.id);
      GL.renderNav("home");
      setStatus("", false);
      await showDashboard(chosen.id);
    } catch (err) {
      console.error(err);
      setStatus(String(err && err.message ? err.message : err), true);
    } finally {
      btn.disabled = false;
    }
  }

  GL.boot("home", async () => {
    await GL.loadAll(); // throws on a fatal data error before anything is shown
    $("login-form").addEventListener("submit", onSubmit);
    const me = GL.session.me();
    if (me !== null && (await showDashboard(me))) return;
    GL.session.logout();
    GL.renderNav("home");
    showLogin();
  });
})();
