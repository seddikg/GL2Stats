(function () {
  const GL = window.GL;
  const cfg = window.GL_CONFIG;
  const LAST_YEAR = "__last-year__";
  let chart = null;

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function statCard(label, value, sub) {
    return (
      '<div class="card stat"><div class="value small">' + GL.esc(value) + '</div><div class="label">' +
      GL.esc(label) + "</div>" + (sub ? '<div class="sub">' + GL.esc(sub) + "</div>" : "") + "</div>"
    );
  }

  function drawChart(canvas, dist, myMark) {
    if (chart) chart.destroy();
    const orange = css("--orange");
    const bright = css("--orange-bright");
    const text = css("--text");
    const muted = css("--text-muted");

    const myBin = GL.isNum(myMark)
      ? Math.min(dist.counts.length - 1, Math.max(0, Math.floor(myMark / dist.width)))
      : -1;
    const fills = dist.counts.map((_, i) => (i === myBin ? bright : "rgba(255, 122, 26, 0.45)"));

    const datasets = [
      {
        type: "bar",
        label: "Observed distribution",
        data: dist.probs,
        backgroundColor: fills,
        borderColor: orange,
        borderWidth: 1,
        borderRadius: 4,
        order: 2,
      },
    ];
    if (dist.normal) {
      datasets.push({
        type: "line",
        label: "Normal fit",
        data: dist.normal,
        borderColor: text,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        order: 1,
      });
    }

    Chart.defaults.color = muted;
    Chart.defaults.borderColor = css("--border");
    Chart.defaults.font.family = css("--font-mono");

    chart = new Chart(canvas.getContext("2d"), {
      data: { labels: dist.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { title: { display: true, text: "Mark" }, grid: { display: false } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Probability" },
            ticks: { callback: (v) => Math.round(v * 100) + "%" },
          },
        },
        plugins: {
          legend: { labels: { color: muted } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = (ctx.parsed.y * 100).toFixed(1) + "%";
                if (ctx.dataset.type === "line") return "Normal fit: " + pct;
                const n = dist.counts[ctx.dataIndex];
                return "Observed distribution: " + pct + " (" + n + (n === 1 ? " student" : " students") + ")";
              },
            },
          },
        },
      },
    });
  }

  function render(data, slug, me) {
    const isLastYear = slug === LAST_YEAR;
    const sub = isLastYear ? { name: "Last year average" } : data.subjects.find((s) => s.slug === slug);
    const markOf = (r) => (isLastYear ? r.previous : r.marks[slug]);
    const values = data.rows.map(markOf).filter(GL.isNum);
    const out = document.getElementById("subject-out");

    if (!values.length) {
      if (chart) chart.destroy();
      out.innerHTML = '<div class="alert">No marks recorded for this subject yet. It is not counted in any average.</div>';
      return;
    }

    const s = GL.stats(values, cfg.passMark);
    const meRow = data.rows.find((r) => r.id === me);
    const myMark = meRow ? markOf(meRow) : undefined;
    const myRank = GL.isNum(myMark) ? 1 + values.filter((v) => v > myMark).length : null;

    const cards = [
      statCard("Students", String(s.n)),
      statCard("Mean", GL.fmt(s.mean),"Espérance"),
      statCard("Std deviation", GL.fmt(s.std), "écarte type"),
      statCard("Min", GL.fmt(s.min)),
      statCard("Max", GL.fmt(s.max)),
      statCard("Pass rate", (s.passRate * 100).toFixed(1) + "%", "mark >= " + cfg.passMark),
    ];
    if (myRank !== null) {
      cards.push(statCard("Your mark", GL.fmt(myMark), "rank " + myRank + " of " + s.n));
    }

    const meta = isLastYear
      ? '<span class="muted">· previous year</span>'
      : '<span class="muted">· coef ' + GL.fmt(sub.coefficient, 1) + ' · semester ' + sub.semester_number + "</span>";

    out.innerHTML =
      '<div class="card chart-card"><h3>' + GL.esc(sub.name) + " " + meta + '</h3><div class="chart-box"><canvas id="chart"></canvas></div></div>' +
      '<div class="stats-grid">' + cards.join("") + "</div>";

    drawChart(document.getElementById("chart"), GL.distribution(values, cfg.scale, cfg.scale), myMark);
  }

  GL.boot("subjects", async () => {
    const me = GL.requireLogin();
    if (me === null) return;

    const data = await GL.loadAll();
    GL.showErrors(data.errors.map((e) => e.message));

    let options =
      '<optgroup label="Last year"><option value="' + LAST_YEAR + '">Last year average</option></optgroup>';
    for (const sem of [1, 2]) {
      const subs = data.subjects.filter((s) => s.semester_number === sem);
      if (!subs.length) continue;
      options += '<optgroup label="Semester ' + sem + '">' +
        subs.map((s) => '<option value="' + GL.esc(s.slug) + '">' + GL.esc(s.name) + "</option>").join("") + "</optgroup>";
    }

    document.getElementById("app").innerHTML =
      '<div class="toolbar"><div class="form-group"><label for="subject-select">Subject</label>' +
      '<select id="subject-select">' + options + "</select></div></div>" +
      '<div id="subject-out"></div>';

    const select = document.getElementById("subject-select");
    select.addEventListener("change", () => render(data, select.value, me));
    render(data, select.value, me);
  });
})();
