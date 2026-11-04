  /* ═══════════════════════════════════════════════════════════════
     FONCTIONNALITÉ 2 : AUDIT TRAIL — ADMIN UNIQUEMENT
     ═══════════════════════════════════════════════════════════════ */
  var AUDIT_KEY = 'eqnovia_l2_audit_v1';
  var AUDIT_MAX = 500;

  var AUDIT_ACTIONS = {
    'create':        { icon: '➕', label: 'Création',             color: 'green' },
    'update':        { icon: '✏️', label: 'Modification',        color: 'blue' },
    'delete':        { icon: '🗑️', label: 'Suppression',          color: 'red' },
    'refund':        { icon: '✅', label: 'Remboursement',        color: 'green' },
    'refund-cancel': { icon: '↩️', label: 'Remboursement annulé', color: 'orange' },
    'submit':        { icon: '📤', label: 'Soumission',           color: 'blue' },
    'validate':      { icon: '✔️', label: 'Validation manager',  color: 'green' },
    'reject':        { icon: '❌', label: 'Rejet',                color: 'red' }
  };

  function auditLoadLocal() {
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch (e) { return []; }
  }

  function auditSaveLocal(arr) {
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(arr.slice(-AUDIT_MAX))); }
    catch (e) { console.warn('[Lot2] audit save local', e); }
  }

  function auditLog(action, exp, changesText) {
    try { if (typeof isAdmin === 'undefined' || isAdmin !== true) return; } catch (e) {}
    if (!exp) return;
    var mode = (typeof useFirebase !== 'undefined' && useFirebase) ? 'cloud' : 'local';
    var entry = {
      id: 'a' + Date.now() + '' + Math.floor(Math.random() * 1000),
      ts: new Date().toISOString(),
      user: auditNowUser(),
      action: action,
      expenseId: exp.id,
      desc: (exp.desc || ''),
      cat: (exp.cat || ''),
      amount: exp.amount != null ? exp.amount : null,
      changes: changesText || '',
      mode: mode
    };
    var local = auditLoadLocal();
    local.push(entry);
    auditSaveLocal(local);
    if (mode === 'cloud' && window.__fs && window.__db && window.__fs.addDoc) {
      try {
        var fs = window.__fs;
        fs.addDoc(fs.collection(window.__db, 'l2_audit_logs'), JSON.parse(JSON.stringify(entry)))
          .catch(function (e) { console.warn('[Lot2] audit cloud write', e); });
      } catch (e) { console.warn('[Lot2] audit cloud write', e); }
    }
  }

  function summarizeChanges(before, updates) {
    var labels = {
      tva: 'TVA', tvaAmount: 'Montant TVA', rembourse: 'Remboursement',
      rembourseDate: 'Date remb.', rembourseBy: 'Remboursé par',
      date: 'Date', desc: 'Description', amount: 'Montant TTC', cat: 'Catégorie',
      l2Status: 'Statut workflow', l2StatusAt: 'Date statut', l2StatusBy: 'Par'
    };
    var skip = ['modifiedBy', 'modifiedAt', 'createdBy', 'createdAt', '_authUid'];
    var parts = [];
    Object.keys(updates || {}).forEach(function (k) {
      if (skip.indexOf(k) >= 0) return;
      var label = labels[k] || k;
      var b = before ? JSON.stringify(before[k]) : '∅';
      var a = JSON.stringify(updates[k]);
      if (b !== a) parts.push(label + ' : ' + b + ' → ' + a);
    });
    return parts.join(' | ');
  }

  function injectAuditNav() {
    if (!isAdminNow()) return;
    var ref = document.getElementById('nav-all');
    if (ref && !document.getElementById('nav-l2audit')) {
      var a = document.createElement('a');
      a.className = 'nav-item l2audit-nav';
      a.id = 'nav-l2audit';
      a.setAttribute('data-tooltip', 'Audit trail');
      a.setAttribute('role', 'button');
      a.setAttribute('tabindex', '0');
      a.innerHTML = '<span class="nav-icon">🧾</span> <span>Audit</span>';
      a.addEventListener('click', function () { if (typeof window.switchTab === 'function') window.switchTab('l2audit'); });
      ref.parentNode.insertBefore(a, ref.nextSibling);
    }
    var bref = document.getElementById('bnav-backup');
    if (bref && !document.getElementById('bnav-l2audit')) {
      var b = document.createElement('a');
      b.className = 'bottom-nav-item';
      b.id = 'bnav-l2audit';
      b.tabIndex = 0;
      b.style.display = 'none';
      b.innerHTML = '<span class="nav-icon">🧾</span><span>Audit</span>';
      b.setAttribute('aria-label', "Journal d'audit");
      b.addEventListener('click', function () { if (typeof window.switchTab === 'function') window.switchTab('l2audit'); });
      bref.parentNode.insertBefore(b, bref);
    }
  }

  function injectAuditTab() {
    if (!isAdminNow()) return;
    var ref = document.getElementById('tab-content-all');
    if (!ref || document.getElementById('tab-content-l2audit')) return;
    var div = document.createElement('div');
    div.id = 'tab-content-l2audit';
    div.setAttribute('role', 'tabpanel');
    div.setAttribute('aria-label', "Journal d'audit");
    div.style.display = 'none';
    div.innerHTML =
      '<div class="panel">' +
      '  <div class="panel-header">' +
      '    <div class="panel-title"><div class="panel-icon blue">🧾</div> Journal d\'Audit Eqnovia</div>' +
      '    <div class="filters-bar" style="border:none;background:transparent;padding:0;">' +
      '      <input class="form-input" id="l2AuditSearch" placeholder="🔍 Rechercher (description, changements, utilisateur...)">' +
      '      <select class="form-select" id="l2AuditUserFilter"></select>' +
      '      <select class="form-select" id="l2AuditActionFilter">' +
      '        <option value="all">Toutes les actions</option>' +
      '        <option value="create">➕ Créations</option>' +
      '        <option value="update">✏️ Modifications</option>' +
      '        <option value="delete">🗑️ Suppressions</option>' +
      '        <option value="refund">✅ Remboursements</option>' +
      '        <option value="submit">📤 Soumissions</option>' +
      '        <option value="validate">✔️ Validations</option>' +
      '        <option value="reject">❌ Rejets</option>' +
      '      </select>' +
      '      <button class="btn btn-ghost" id="l2AuditImportBtn" onclick="window.importAuditFromExpenses()" title="Importer les dépenses existantes dans l\'audit">📥 Importer l\'existant</button>' +
      '      <button class="btn btn-ghost" id="l2AuditCloudBtn" onclick="window.syncAuditCloud()" style="display:none;">☁️ Charger depuis Firebase</button>' +
      '      <button class="btn btn-ghost" onclick="window.refreshAudit()">⟳</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="l2a-stats" id="l2AuditStats"></div>' +
      '  <div class="l2a-timeline" id="l2AuditList"></div>' +
      '</div>';

    ref.parentNode.insertBefore(div, ref.nextSibling);

    var cloudBtn = document.getElementById('l2AuditCloudBtn');
    if (cloudBtn && window.__fbReady && window.__fs && window.__db) cloudBtn.style.display = '';

    ['l2AuditSearch', 'l2AuditUserFilter', 'l2AuditActionFilter'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', renderAudit);
      if (el) el.addEventListener('input', renderAudit);
    });
    populateAuditUsers();
    renderAudit();
  }

  function populateAuditUsers() {
    var sel = document.getElementById('l2AuditUserFilter');
    if (!sel) return;
    var cur = sel.value || 'all';
    var userMap = getAllAuditUsers();
    sel.innerHTML = '<option value="all">👥 Tous les utilisateurs</option>' +
      Object.keys(userMap).sort().map(function (k) {
        return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(userMap[k]) + '</option>';
      }).join('');
  }

  function importAuditFromExpenses(silent) {
    var expenses = (typeof window.dataAll === 'function') ? window.dataAll() : [];
    if (!expenses.length) {
      if (!silent && typeof window.toast === 'function') window.toast('Aucune dépense trouvée dans le cache.', 'info');
      return;
    }
    var local = auditLoadLocal();
    var seen = {};
    local.forEach(function (l) { if (l.expenseId) seen[l.expenseId] = true; });
    var added = 0;
    expenses.forEach(function (e) {
      if (!e || seen[e.id]) return;
      added++;
      var action = (e.rembourse === true) ? 'refund' : 'create';
      local.push({
        id: 'a' + Date.now() + '' + Math.floor(Math.random() * 1000) + '-' + added,
        ts: e.modifiedAt || e.createdAt || new Date().toISOString(),
        user: e.createdBy || e.user || auditNowUser(),
        action: action,
        expenseId: e.id,
        desc: (e.desc || ''),
        cat: (e.cat || ''),
        amount: e.amount != null ? e.amount : null,
        changes: 'Dépense existante importée (TTC ' + fmtDH(e.amount) + ')',
        mode: 'local'
      });
    });
    if (added) {
      auditSaveLocal(local);
      populateAuditUsers();
      renderAudit();
    }
    if (!silent && typeof window.toast === 'function') {
      window.toast(added ? ('📥 ' + added + ' dépense(s) importée(s) dans le journal d\'audit.') : 'Aucune nouvelle dépense à importer (déjà couverte).', added ? 'ok' : 'info');
    }
  }

  function renderAudit() {
    var list = document.getElementById('l2AuditList');
    if (!list) return;
    var statsEl = document.getElementById('l2AuditStats');
    var userSel = document.getElementById('l2AuditUserFilter');
    var actionSel = document.getElementById('l2AuditActionFilter');
    var searchInp = document.getElementById('l2AuditSearch');
    var usrF = userSel ? (userSel.value || 'all') : 'all';
    var actF = actionSel ? (actionSel.value || 'all') : 'all';
    var q = searchInp ? String(searchInp.value || '').toLowerCase() : '';
    var logs = auditLoadLocal().slice().reverse().filter(function (l) {
      if (usrF !== 'all' && l.user !== usrF) return false;
      if (actF !== 'all' && l.action !== actF) return false;
      if (q &&
          String(l.desc || '').toLowerCase().indexOf(q) < 0 &&
          String(l.changes || '').toLowerCase().indexOf(q) < 0 &&
          String(userLabel(l.user) || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    if (statsEl) {
      var nbCreate = 0, nbUpdate = 0, nbDelete = 0, nbRefund = 0;
      logs.forEach(function (l) {
        if (l.action === 'create') nbCreate++;
        else if (l.action === 'update') nbUpdate++;
        else if (l.action === 'delete' || l.action === 'reject') nbDelete++;
        else if (l.action === 'refund' || l.action === 'refund-cancel') nbRefund++;
      });
      statsEl.innerHTML =
        '<span class="l2a-stat l2a-green">➕ <strong>' + nbCreate + '</strong> créations</span>' +
        '<span class="l2a-stat l2a-blue">✏️ <strong>' + nbUpdate + '</strong> modifications</span>' +
        '<span class="l2a-stat l2a-green">✅ <strong>' + nbRefund + '</strong> remboursements</span>' +
        '<span class="l2a-stat l2a-red">🗑️ <strong>' + nbDelete + '</strong> suppressions</span>';
    }

    if (!logs.length) {
      list.innerHTML = '<div class="l2a-empty">Aucune action enregistrée — importez les dépenses existantes ou effectuez des opérations.</div>';
      return;
    }

    var html = '';
    var lastDay = '';
    logs.forEach(function (l) {
      var day = String(l.ts || '').substring(0, 10);
      if (day !== lastDay) {
        lastDay = day;
        html += '<div class="l2a-day">' + esc(day) + '</div>';
      }
      var meta = AUDIT_ACTIONS[l.action] || { icon: '•', label: l.action, color: 'blue' };
      var changeItems = String(l.changes || '').split(' | ').filter(Boolean).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
      html +=
        '<div class="l2a-entry l2a-' + meta.color + '">' +
        '  <div class="l2a-icon">' + meta.icon + '</div>' +
        '  <div class="l2a-body">' +
        '    <div class="l2a-head">' +
        '      <span><strong>' + esc(meta.label) + '</strong></span>' +
        '      <span class="l2a-user">' + esc(userLabel(l.user)) + '</span>' +
        '      <span class="l2a-time">' + esc(String(l.ts || '').substring(11, 16)) + '</span>' +
        '      <span class="l2a-mode">(' + esc(l.mode || 'local') + ')</span>' +
        '    </div>' +
        '    <div class="l2a-exp">#' + esc(l.expenseId) + ' — ' + esc(l.desc || '') +
        (l.cat ? ' • ' + esc(l.cat) : '') + (l.amount != null ? ' • ' + fmtDH(l.amount) : '') + '</div>' +
        (changeItems ? '<ul class="l2a-changes">' + changeItems + '</ul>' : '') +
        '  </div>' +
        '</div>';
    });
    list.innerHTML = html;
  }

  function refreshAudit() {
    if (auditLoadLocal().length === 0) {
      importAuditFromExpenses(true);
    }
    populateAuditUsers();
    renderAudit();
  }

  function syncAuditCloud() {
    if (!(window.__fs && window.__db && window.__fbReady)) {
      if (typeof window.toast === 'function') window.toast('Firebase non disponible — journal local uniquement.', 'info');
      return;
    }
    try {
      var fs = window.__fs;
      fs.getDocs(fs.collection(window.__db, 'l2_audit_logs')).then(function (snap) {
        var local = auditLoadLocal();
        var seen = {};
        local.forEach(function (l) { if (l.id) seen[l.id] = true; });
        var nb = 0;
        snap.forEach(function (d) {
          var l = d.data();
          if (l && l.id && !seen[l.id]) { local.push(l); nb++; }
        });
        local.sort(function (a, b) { return String(a.ts || '').localeCompare(String(b.ts || '')); });
        auditSaveLocal(local);
        refreshAudit();
        if (typeof window.toast === 'function') {
          window.toast(nb ? ('☁️ ' + nb + ' entrée(s) chargée(s) depuis Firebase.') : 'Journal d\'audit déjà à jour.', 'ok');
        }
      }).catch(function (e) {
        console.warn('[Lot2] audit cloud sync', e);
        if (typeof window.toast === 'function') window.toast('Erreur de synchronisation cloud.', 'err');
      });
    } catch (e) {
      console.warn('[Lot2] audit cloud sync', e);
      if (typeof window.toast === 'function') window.toast('Erreur de synchronisation cloud.', 'err');
    }
  }

  function switchToAuditTab() {
    try { activeTab = 'l2audit'; } catch (e) { console.warn('[Lot2] activeTab', e); }
    document.querySelectorAll('[id^="tab-content-"]').forEach(function (el) { el.style.display = 'none'; });
    var mine = document.getElementById('tab-content-l2audit');
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
    if (navA) navA.classList.add('active');
    if (bnavA) bnavA.classList.add('active');
    var navAn = document.getElementById('nav-l2analytics');
    var bnavAn = document.getElementById('bnav-l2analytics');
    if (navAn) navAn.classList.remove('active');
    if (bnavAn) bnavAn.classList.remove('active');
    if (window.innerWidth <= 768) document.body.style.overflow = '';
    refreshAudit();
  }

  function refreshAuditVisibility() {
    var show = isAdminNow();
    ['nav-l2audit', 'bnav-l2audit'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = show ? '' : 'none';
    });
  }

