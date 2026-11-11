(function () {
  const GL = window.GL;

  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  function card(label, value, sub, small) {
    return (
      '<div class="card stat"><div class="value' + (small ? " small" : "") + '">' + GL.esc(value) +
      '</div><div class="label">' + GL.esc(label) + "</div>" +
      (sub ? '<div class="sub">' + GL.esc(sub) + "</div>" : "") + "</div>"
    );
  }

  function diffText(mark, avg) {
    if (!GL.isNum(mark) || !GL.isNum(avg)) return "-";
    const diff = mark - avg;
    return (diff >= 0 ? "+" : "") + diff.toFixed(2);
  }

  GL.boot("ranking", async () => {
    if (GL.requireLogin() === null) return;

    // Only reachable through a click on the leaderboard.
    const viewId = GL.session.view();
    if (viewId === null) {
      window.location.replace("ranking.html");
      return;
    }

    const data = await GL.loadAll();
    const row = data.rows.find((r) => r.id === viewId);
    if (!row) {
      window.location.replace("ranking.html");
      return;
    }
    GL.showErrors(data.errors.filter((e) => e.id === row.id).map((e) => e.message));

    // class average per subject and per test
    const classAvg = {};
    const classTests = {};
    for (const sub of data.subjects) {
      const vals = data.rows.map((r) => r.marks[sub.slug]).filter(GL.isNum);
      classAvg[sub.slug] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

      classTests[sub.slug] = {};
      for (const test of GL.TESTS) {
        const weight = sub[test.weight];
        if (!GL.isNum(weight) || weight <= 0) continue;
        const testVals = data.rows
          .map((r) => (r.tests && r.tests[sub.slug] ? r.tests[sub.slug][test.value] : null))
          .filter(GL.isNum);
        classTests[sub.slug][test.value] = {
          weight,
          hasMarks: testVals.length > 0,
          avg: testVals.length ? testVals.reduce((a, b) => a + b, 0) / testVals.length : null,
        };
      }
    }

    const ranked = data.rows.filter((r) => r.rank !== null).length;
    const rankPct = row.rank === null || ranked === 0 ? null : Math.round((row.rank / ranked) * 100);
    let html =
      '<div class="page-head"><a href="ranking.html">&larr; Back to ranking</a>' +
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
          const subjectRow =
            '<tr class="subject-row"><td><strong>' + GL.esc(s.name) + "</strong></td>" +
            '<td class="num">' + GL.fmt(s.coefficient, 1) + "</td>" +
            (GL.isNum(avg)
              ? '<td class="num mark-cell ' + GL.markClass(mark) + '">' + GL.fmt(mark) + "</td>" +
                '<td class="num">' + GL.fmt(avg) + '</td><td class="num">' + diffText(mark, avg) + "</td>"
              : '<td class="num mark-cell none">N/A</td><td class="num">N/A</td><td class="num">N/A</td>') +
            "</tr>";

          let testRows = "";
          for (const test of GL.TESTS) {
            const info = classTests[s.slug][test.value];
            if (!info) continue;
            const testMark = row.tests && row.tests[s.slug] ? row.tests[s.slug][test.value] : null;
            const label =
              "<td>" + cap(test.label) + '</td><td class="num">' + GL.fmt(info.weight, 1) + "</td>";
            if (!info.hasMarks) {
              testRows +=
                '<tr class="test-row">' + label +
                '<td class="num mark-cell none">N/A</td><td class="num">N/A</td><td class="num">N/A</td></tr>';
            } else {
              testRows +=
                '<tr class="test-row">' + label +
                '<td class="num mark-cell ' + GL.markClass(testMark) + '">' + GL.fmt(testMark) + "</td>" +
                '<td class="num">' + GL.fmt(info.avg) + '</td><td class="num">' + diffText(testMark, info.avg) + "</td></tr>";
            }
          }

          return subjectRow + testRows;
        })
        .join("");
      semAverage=GL.fmt(sem === 1 ? row.s1 : row.s2);
      html +=
        '<h3 class="sem-title">Semester ' + sem + (semAverage=="-"?"":" (average " + semAverage + ")")+"</h3>" +
        '<div class="table-wrap"><table class="student-tests"><thead><tr><th>Subject / test</th><th class="num">Coef / weight</th>' +
        '<th class="num">Mark</th><th class="num">Class avg</th><th class="num">Diff</th></tr></thead><tbody>' +
        body + "</tbody></table></div>";
    }

    document.getElementById("app").innerHTML = html;
  });
})();
