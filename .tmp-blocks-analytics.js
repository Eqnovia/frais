  /* ═══════════════════════════════════════════════════════════════
     FONCTIONNALITÉ 6 : ANALYTICS (ONGLET + CHART.JS) — ADMIN UNIQUEMENT
     ═══════════════════════════════════════════════════════════════ */
  var chartsInstances = {};

  function injectAnalyticsNav() {
    if (!isAdminNow()) return;
    var ref = document.getElementById('nav-comparison') || document.getElementById('nav-trimestre');
    if (ref && !document.getElementById('nav-l2analytics')) {
      var a = document.createElement('a');
      a.className = 'nav-item';
      a.id = 'nav-l2analytics';
      a.setAttribute('data-tooltip', 'Analytique & Graphiques');
      a.setAttribute('role', 'button');
      a.setAttribute('tabindex', '0');
      a.innerHTML = '<span class="nav-icon">📊</span> <span>Analytics</span>';
      a.addEventListener('click', function () { if (typeof window.switchTab === 'function') window.switchTab('l2analytics'); });
      ref.parentNode.insertBefore(a, ref.nextSibling);
    }
    var bref = document.getElementById('bnav-backup');
    if (bref && !document.getElementById('bnav-l2analytics')) {
      var b = document.createElement('a');
      b.className = 'bottom-nav-item';
      b.id = 'bnav-l2analytics';
      b.tabIndex = 0;
      b.innerHTML = '<span class="nav-icon">📊</span><span>Analytics</span>';
      b.setAttribute('aria-label', 'Analytics');
      b.addEventListener('click', function () { if (typeof window.switchTab === 'function') window.switchTab('l2analytics'); });
      bref.parentNode.insertBefore(b, bref);
    }
  }

  function injectAnalyticsTab() {
    if (!isAdminNow()) return;
    var ref = document.getElementById('tab-content-all');
    if (!ref || document.getElementById('tab-content-l2analytics')) return;
    var div = document.createElement('div');
    div.id = 'tab-content-l2analytics';
    div.setAttribute('role', 'tabpanel');
    div.setAttribute('aria-label', 'Analytics');
    div.style.display = 'none';
    div.innerHTML =
      '<div class="panel">' +
      '  <div class="panel-header">' +
      '    <div class="panel-title"><div class="panel-icon blue">📊</div> Tableaux de Bord Analytique Eqnovia</div>' +
      '    <div class="filters-bar" style="border:none;background:transparent;padding:0;">' +
      '      <select class="form-select" id="l2AnYearFilter"></select>' +
      '      <select class="form-select" id="l2AnUserFilter"><option value="all">👤 Tous collaborateurs</option></select>' +
      '      <button class="btn btn-ghost" onclick="window.renderAnalytics()">⟳</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="stats-grid" id="l2AnKpis" style="margin-bottom:16px;"></div>' +
      '  <div class="l2-analytics-grid">' +
      '    <div class="l2-chart-card">' +
      '      <div class="l2-chart-title">👥 Dépenses par collaborateur (TTC)</div>' +
      '      <div class="l2-chart-canvas-wrap"><canvas id="l2ChartEmployee"></canvas></div>' +
      '    </div>' +
      '    <div class="l2-chart-card">' +
      '      <div class="l2-chart-title">🏷️ Répartition par catégorie</div>' +
      '      <div class="l2-chart-canvas-wrap"><canvas id="l2ChartCategory"></canvas></div>' +
      '    </div>' +
      '    <div class="l2-chart-card">' +
      '      <div class="l2-chart-title">📅 Évolution mensuelle des dépenses</div>' +
      '      <div class="l2-chart-canvas-wrap"><canvas id="l2ChartMonthly"></canvas></div>' +
      '    </div>' +
      '    <div class="l2-chart-card">' +
      '      <div class="l2-chart-title">🧾 Répartition de la TVA Récupérable</div>' +
      '      <div class="l2-chart-canvas-wrap"><canvas id="l2ChartTva"></canvas></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    ref.parentNode.insertBefore(div, ref.nextSibling);

    var ySel = document.getElementById('l2AnYearFilter');
    var uSel = document.getElementById('l2AnUserFilter');
    if (ySel) ySel.addEventListener('change', renderAnalytics);
    if (uSel) uSel.addEventListener('change', renderAnalytics);
  }

  function ensureChartJsLoaded(cb) {
    if (window.Chart) { cb(); return; }
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js';
    script.onload = function () { cb(); };
    script.onerror = function () {
      console.warn('[Lot2] Échec du chargement de Chart.js');
    };
    document.head.appendChild(script);
  }

  function renderAnalytics() {
    ensureChartJsLoaded(function () {
      doRenderAnalytics();
    });
  }

  function doRenderAnalytics() {
    var all = (typeof window.dataAll === 'function') ? window.dataAll() : [];
    var ySel = document.getElementById('l2AnYearFilter');
    var uSel = document.getElementById('l2AnUserFilter');
    if (!ySel || !uSel) return;

    /* Populate Year options */
    var years = Array.from(new Set(all.map(function (e) { return (e.date || '').substring(0, 4); }).filter(Boolean))).sort().reverse();
    var curY = ySel.value || 'all';
    ySel.innerHTML = '<option value="all">📅 Toutes années</option>' + years.map(function (y) {
      return '<option value="' + y + '"' + (y === curY ? ' selected' : '') + '>' + y + '</option>';
    }).join('');

    /* Populate User options */
    var curU = uSel.value || 'all';
    var uMap = getAllAuditUsers();
    uSel.innerHTML = '<option value="all">👤 Tous collaborateurs</option>' + Object.keys(uMap).sort().map(function (k) {
      return '<option value="' + k + '"' + (k === curU ? ' selected' : '') + '>' + esc(uMap[k]) + '</option>';
    }).join('');

    var yearF = ySel.value;
    var userF = uSel.value;

    var filtered = all.filter(function (e) {
      if (yearF !== 'all' && (e.date || '').substring(0, 4) !== yearF) return false;
      if (userF !== 'all' && e.user !== userF) return false;
      return true;
    });

    /* KPIs */
    var totalTTC = 0;
    var totalTVA = 0;
    var totalRemb = 0;
    filtered.forEach(function (e) {
      var amt = parseFloat(e.amount) || 0;
      totalTTC += amt;
      if (e.tva === 'oui') totalTVA += (parseFloat(e.tvaAmount) || 0);
      if (e.rembourse) totalRemb += amt;
    });
    var avgExp = filtered.length ? (totalTTC / filtered.length) : 0;

    var kpisEl = document.getElementById('l2AnKpis');
    if (kpisEl) {
      kpisEl.innerHTML =
        '<div class="stat-card blue"><div class="stat-icon blue">💰</div><div class="stat-label">Total Dépenses TTC</div><div class="stat-value">' + fmtDH(totalTTC) + '</div><div class="stat-sub">' + filtered.length + ' note(s)</div></div>' +
        '<div class="stat-card" style="background:#E7F7EC;"><div class="stat-icon" style="background:#1B7A3D;color:#fff;">🧾</div><div class="stat-label">TVA Récupérable</div><div class="stat-value">' + fmtDH(totalTVA) + '</div><div class="stat-sub">Déductible</div></div>' +
        '<div class="stat-card" style="background:#F3E8FF;"><div class="stat-icon" style="background:#6B21A8;color:#fff;">✅</div><div class="stat-label">Frais Remboursés</div><div class="stat-value">' + fmtDH(totalRemb) + '</div><div class="stat-sub">' + fmtDH(totalTTC - totalRemb) + ' en attente</div></div>' +
        '<div class="stat-card orange"><div class="stat-icon orange">📈</div><div class="stat-label">Moyenne / Note</div><div class="stat-value">' + fmtDH(avgExp) + '</div><div class="stat-sub">par dépense</div></div>';
    }

    if (!window.Chart) return;

    /* 1. Par Employé */
    var empTotals = {};
    filtered.forEach(function (e) {
      var u = userLabel(e.user);
      empTotals[u] = (empTotals[u] || 0) + (parseFloat(e.amount) || 0);
    });
    renderBarChart('l2ChartEmployee', Object.keys(empTotals), Object.values(empTotals), 'Montant TTC (DH)', '#0B4F9E', true);

    /* 2. Par Catégorie */
    var catTotals = {};
    filtered.forEach(function (e) {
      var c = e.cat || 'Autre';
      catTotals[c] = (catTotals[c] || 0) + (parseFloat(e.amount) || 0);
    });
    renderDoughnutChart('l2ChartCategory', Object.keys(catTotals), Object.values(catTotals), ['#0B4F9E', '#1B7A3D', '#B45309', '#6366F1', '#EC4899', '#14B8A6', '#8B5CF6']);

    /* 3. Évolution Mensuelle */
    var months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    var monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    var monthTotals = months.map(function (m) {
      return filtered.filter(function (e) { return (e.date || '').substring(5, 7) === m; })
                     .reduce(function (sum, e) { return sum + (parseFloat(e.amount) || 0); }, 0);
    });
    renderLineChart('l2ChartMonthly', monthLabels, monthTotals, 'Total Mensuel (DH)', '#1B7A3D');

    /* 4. TVA Répartition */
    var htTotal = Math.max(0, totalTTC - totalTVA);
    renderDoughnutChart('l2ChartTva', ['TVA Récupérable', 'Montant HT'], [totalTVA, htTotal], ['#1B7A3D', '#CBD5E1']);
  }

  function destroyChart(id) {
    if (chartsInstances[id]) {
      try { chartsInstances[id].destroy(); } catch (e) {}
      delete chartsInstances[id];
    }
  }

  function renderBarChart(canvasId, labels, data, datasetLabel, color, horizontal) {
    destroyChart(canvasId);
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    chartsInstances[canvasId] = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: datasetLabel, data: data, backgroundColor: color, borderRadius: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#F1F5F9' } }
        }
      }
    });
  }

  function renderDoughnutChart(canvasId, labels, data, colors) {
    destroyChart(canvasId);
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    chartsInstances[canvasId] = new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  function renderLineChart(canvasId, labels, data, datasetLabel, color) {
    destroyChart(canvasId);
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    chartsInstances[canvasId] = new window.Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: datasetLabel,
          data: data,
          borderColor: color,
          backgroundColor: 'rgba(27, 122, 61, 0.1)',
          tension: 0.35,
          fill: true,
          pointBackgroundColor: color,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#F1F5F9' } }
        }
      }
    });
  }

  function switchToAnalyticsTab() {
    try { activeTab = 'l2analytics'; } catch (e) { console.warn('[Lot2] activeTab', e); }
    document.querySelectorAll('[id^="tab-content-"]').forEach(function (el) { el.style.display = 'none'; });
    var mine = document.getElementById('tab-content-l2analytics');
    if (mine) mine.style.display = 'block';
    document.querySelectorAll('.mobile-section-header').forEach(function (el) { el.style.display = 'none'; });
    if (typeof TABS !== 'undefined') {
      TABS.forEach(function (id) {
        var tBtn = document.getElementById('tab-' + id);
        if (tBtn) { tBtn.classList.remove('active'); tBtn.setAttribute('aria-selected', 'false'); }
        var nBtn = document.getElementById('nav-' + id);
        if (nBtn) nBtn.classList.remove('active');
        var bBtn = document.getElementById('bnav-' + id);
        if (bBtn) bBtn.classList.remove('active');
      });
    }
    var navA = document.getElementById('nav-l2audit');
    var bnavA = document.getElementById('bnav-l2audit');
    if (navA) navA.classList.remove('active');
    if (bnavA) bnavA.classList.remove('active');
    var navAn = document.getElementById('nav-l2analytics');
    var bnavAn = document.getElementById('bnav-l2analytics');
    if (navAn) navAn.classList.add('active');
    if (bnavAn) bnavAn.classList.add('active');
    if (window.innerWidth <= 768) document.body.style.overflow = '';
    renderAnalytics();
  }

