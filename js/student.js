(function () {
  const GL = window.GL;

  function card(label, value, sub, small) {
    return (
      '<div class="card stat"><div class="value' + (small ? " small" : "") + '">' + GL.esc(value) +
      '</div><div class="label">' + GL.esc(label) + "</div>" +
      (sub ? '<div class="sub">' + GL.esc(sub) + "</div>" : "") + "</div>"
    );
  }

  GL.boot("ranking", async () => {
    if (GL.requireLogin() === null) return;

    // Only reachable through a click on the leaderboard.
    const viewId = GL.session.view();
    if (viewId === null) {
      window.location.replace("Ranking.html");
      return;
    }

    const data = await GL.loadAll();
    const row = data.rows.find((r) => r.id === viewId);
    if (!row) {
      window.location.replace("Ranking.html");
      return;
    }
    GL.showErrors(data.errors.filter((e) => e.id === row.id).map((e) => e.message));

    // class average per subject
    const classAvg = {};
    for (const sub of data.subjects) {
      const vals = data.rows.map((r) => r.marks[sub.slug]).filter(GL.isNum);
      classAvg[sub.slug] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }

    const ranked = data.rows.filter((r) => r.rank !== null).length;
    const rankPct = row.rank === null || ranked === 0 ? null : Math.round((row.rank / ranked) * 100);
    let html =
      '<div class="page-head"><a href="Ranking.html">&larr; Back to ranking</a>' +
      '<h2 class="mt-2">Student <span class="mono accent">' + GL.esc(GL.shortHash(row.hash)) + "</span></h2></div>" +
      '<div class="stats-grid">' +
      card("Rank", row.rank === null ? "-" : "#" + row.rank, "out of " + ranked) +
      card("Ranking", rankPct === null ? "-" : rankPct + "%", "In percentages (less is better)", true) +
      card("Score", GL.fmt(row.score)) +
      card("Last year", GL.fmt(row.previous), "", true) +
      card("Semester 1", GL.fmt(row.s1), "", true) +
      card("Semester 2", GL.fmt(row.s2), "", true) +
      card("This year", GL.fmt(row.thisYear), "", true) +
      "</div>";

    for (const sem of [1, 2]) {
      const subs = data.subjects.filter((s) => s.semester_number === sem);
      if (!subs.length) continue;
      const body = subs
        .map((s) => {
          const mark = row.marks[s.slug];
          const avg = classAvg[s.slug];
          const diff = GL.isNum(mark) && GL.isNum(avg) ? mark - avg : null;
          const diffText = diff === null ? "-" : (diff >= 0 ? "+" : "") + diff.toFixed(2);
          return (
            "<tr><td>" + GL.esc(s.name) + '</td><td class="num">' + GL.fmt(s.coefficient, 1) + "</td>" +
            '<td class="num mark-cell ' + GL.markClass(mark) + '">' + GL.fmt(mark) + "</td>" +
            '<td class="num">' + GL.fmt(avg) + '</td><td class="num">' + diffText + "</td></tr>"
          );
        })
        .join("");
      html +=
        '<h3 class="sem-title">Semester ' + sem + " (average " + GL.fmt(sem === 1 ? row.s1 : row.s2) + ")</h3>" +
        '<div class="table-wrap"><table><thead><tr><th>Subject</th><th class="num">Coef</th>' +
        '<th class="num">Mark</th><th class="num">Class avg</th><th class="num">Diff</th></tr></thead><tbody>' +
        body + "</tbody></table></div>";
    }

    document.getElementById("app").innerHTML = html;
  });
})();
