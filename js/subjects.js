(function () {
  const GL = window.GL;
  const cfg = window.GL_CONFIG;
  const LAST_YEAR = "__last-year__";
  let charts = [];

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  function statCard(label, value, sub) {
    return (
      '<div class="card stat"><div class="value small">' + GL.esc(value) + '</div><div class="label">' +
      GL.esc(label) + "</div>" + (sub ? '<div class="sub">' + GL.esc(sub) + "</div>" : "") + "</div>"
    );
  }

  function drawChart(canvas, dist, myMark) {
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

    charts.push(
      new Chart(canvas.getContext("2d"), {
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
      })
    );
  }

  function statsBlock(specs, title, meta, values, myMark, chartId) {
    const heading = GL.esc(title) + (meta ? " " + meta : "");
    if (!values.length) {
      return '<div class="chart-card"><h3>' + heading + '</h3><div class="alert">No data yet</div></div>';
    }

    const s = GL.stats(values, cfg.passMark);
    const myRank = GL.isNum(myMark) ? 1 + values.filter((v) => v > myMark).length : null;
    const cards = [
      statCard("Students", String(s.n)),
      statCard("Mean", GL.fmt(s.mean), "Espérance"),
      statCard("Std deviation", GL.fmt(s.std), "écarte type"),
      statCard("Min", GL.fmt(s.min)),
      statCard("Max", GL.fmt(s.max)),
      statCard("Pass rate", (s.passRate * 100).toFixed(1) + "%", "mark >= " + cfg.passMark),
    ];
    if (myRank !== null) {
      cards.push(statCard("Your mark", GL.fmt(myMark), "rank " + myRank + " of " + s.n));
    }

    specs.push({ id: chartId, values, myMark });
    return (
      '<div class="chart-card"><h3>' + heading +
      '</h3><div class="chart-box"><canvas id="' + chartId + '"></canvas></div></div>' +
      '<div class="stats-grid">' + cards.join("") + "</div>"
    );
  }

  function drawAll(specs) {
    for (const spec of specs) {
      drawChart(document.getElementById(spec.id), GL.distribution(spec.values, cfg.scale, cfg.scale), spec.myMark);
    }
  }

  function subjectViews(data, sub, meRow) {
    const views = [];
    for (const test of GL.TESTS) {
      const weight = sub[test.weight];
      if (!GL.isNum(weight) || weight <= 0) continue;
      views.push({
        key: test.value,
        label: cap(test.label),
        meta: "",
        values: data.rows
          .map((r) => (r.tests && r.tests[sub.slug] ? r.tests[sub.slug][test.value] : null))
          .filter(GL.isNum),
        myMark: meRow && meRow.tests && meRow.tests[sub.slug] ? meRow.tests[sub.slug][test.value] : undefined,
      });
    }
    views.push({
      key: "overall",
      label: "Overall",
      meta: '<span class="muted"></span>',
      values: data.rows.map((r) => r.marks[sub.slug]).filter(GL.isNum),
      myMark: meRow ? meRow.marks[sub.slug] : undefined,
    });
    return views;
  }

  function render(data, slug, me, viewKey) {
    for (const chart of charts) chart.destroy();
    charts = [];

    const out = document.getElementById("subject-out");
    const meRow = data.rows.find((r) => r.id === me);
    const specs = [];

    if (slug === LAST_YEAR) {
      const values = data.rows.map((r) => r.previous).filter(GL.isNum);
      const myMark = meRow ? meRow.previous : undefined;
      out.innerHTML = statsBlock(specs, "Last year average", "", values, myMark, "chart-view");
      drawAll(specs);
      return;
    }

    const sub = data.subjects.find((s) => s.slug === slug);
    if (!sub) {
      out.innerHTML = '<div class="alert">Unknown subject.</div>';
      return;
    }

    const views = subjectViews(data, sub, meRow);
    const selected = views.find((v) => v.key === viewKey) || views[0];
    const tabs =
      '<div class="subject-tabs">' +
      views
        .map(
          (v) =>
            '<button type="button" id="tab-' + v.key + '" data-view="' + v.key + '"' +
            (v.key === selected.key ? ' class="active"' : "") + ">" + GL.esc(v.label) + "</button>"
        )
        .join("") +
      "</div>";

    out.innerHTML =
      tabs + statsBlock(specs, selected.label, selected.meta, selected.values, selected.myMark, "chart-view");

    for (const view of views) {
      const btn = document.getElementById("tab-" + view.key);
      if (btn) btn.addEventListener("click", () => render(data, slug, me, view.key));
    }
    drawAll(specs);
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
