(function () {
  const GL = window.GL;

  GL.boot("ranking", async () => {
    const me = GL.requireLogin();
    if (me === null) return;

    const data = await GL.loadAll();
    GL.showErrors(data.errors.map((e) => e.message));

    const body = data.rows
      .map((r) => {
        const classes = [];
        if (r.rank !== null && r.rank <= 3) classes.push("top-" + r.rank);
        if (r.id === me) classes.push("me");
        return (
          '<tr class="' + classes.join(" ") + '">' +
          '<td class="rank">' + (r.rank === null ? "-" : r.rank) + "</td>" +
          '<td><button type="button" class="hash-link" data-id="' + r.id + '" title="' + GL.esc(r.hash) + '">' +
          GL.esc(GL.shortHash(r.hash)) + "</button>" + (r.id === me ? ' <span class="badge badge-orange">you</span>' : "") + "</td>" +
          '<td class="num score">' + GL.fmt(r.score) + "</td>" +
          '<td class="num">' + GL.fmt(r.previous) + "</td>" +
          '<td class="num">' + GL.fmt(r.s1) + "</td>" +
          '<td class="num">' + GL.fmt(r.s2) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    document.getElementById("app").innerHTML =
      '<div class="table-wrap"><table class="rank-table"><thead><tr>' +
      "<th>#</th><th>Hash</th>" +
      '<th class="num">Score</th><th class="num">Last year</th><th class="num">Sem 1</th><th class="num">Sem 2</th>' +
      "</tr></thead><tbody>" + body + "</tbody></table></div>" +
      '<p class="muted mt-2">Score = (last year + 0.5 + (this year + 0.5) x 2) / 3, where this year is the mean of the semester averages. ' +
      "Students with equal scores share a rank.</p>";

    document.querySelector(".rank-table tbody").addEventListener("click", (event) => {
      const btn = event.target.closest(".hash-link");
      if (!btn) return;
      GL.session.setView(Number(btn.dataset.id));
      window.location.href = "student.html";
    });
  });
})();
