/* ═══════════════════════════════════════════════════════════════
   LOT 2 — MODULES ADDITIFS EQNOVIA
   lot2.js — chargé APRÈS app.js / guide.js (defer).
   100% ADDITIF : n'altère aucune fonction ni variable de app.js.
   Extensions par wrappers globaux et injections DOM.

   LES 5 FONCTIONNALITÉS :
   1. TVA récupérable / non (filtre + badge + champ saisie & édition)
   2. Workflow interne (Brouillon → Soumis → Validé Manager → Remboursé / Rejeté)
   3. Agent IA (suggestion PCGM, détection doublons, anomalies >5000/sans justif/>1an)
   4. Notifications (email EmailJS vers fbourzgui@eqnovia.ma + WhatsApp wa.me)
   5. Offline IndexedDB + sync Firebase + indicateur En ligne/Hors-ligne
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     NOYAU : utilitaires de wrapping additif & contextuels
     ───────────────────────────────────────────────────────────── */
  var L2 = window.__L2 = window.__L2 || { modules: [] };

  function wrapGlobal(name, opts) {
    var orig = typeof window[name] === 'function' ? window[name] : null;
    if (!orig || orig.__l2wrapped) return;
    function wrapped() {
      var args = Array.prototype.slice.call(arguments);
      var ctx = { args: args };
      if (opts.before) { try { opts.before(ctx); } catch (e) { console.warn('[Lot2] before ' + name, e); } }
      if (opts.skip && opts.skip(ctx) && opts.alt) {
        try { opts.alt(ctx); } catch (e) { console.warn('[Lot2] alt ' + name, e); }
        return;
      }
      var result = orig.apply(this, args);
      if (result && typeof result.then === 'function') {
        Promise.resolve(result).then(function () {
          if (opts.after) { try { opts.after(ctx); } catch (e) { console.warn('[Lot2] after ' + name, e); } }
        });
      } else if (opts.after) {
        try { opts.after(ctx); } catch (e) { console.warn('[Lot2] after ' + name, e); }
      }
      return result;
    }
    wrapped.__l2wrapped = true;
    window[name] = wrapped;
  }

  L2.wrapGlobal = wrapGlobal;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDH(val) {
    var n = parseFloat(val) || 0;
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
  }

  function todayStr() {
    return new Date().toISOString().substring(0, 10);
  }

  function isAdminNow() {
    try { return (typeof isAdmin !== 'undefined' && isAdmin === true); } catch (e) { return false; }
  }

  function isComptableNow() {
    try { return (typeof isComptable !== 'undefined' && isComptable === true); } catch (e) { return false; }
  }

  function auditNowUser() {
    try { return (typeof currentUser !== 'undefined') ? currentUser : 'admin'; } catch (e) { return 'admin'; }
  }

  function userLabel(key) {
    try {
      var u = (typeof USERS !== 'undefined' && USERS) ? USERS : (window.USERS || {});
      if (u[key] && u[key].label) return u[key].label;
      for (var k in u) {
        if (u[k] && (u[k].label === key || u[k].email === key)) return u[k].label;
      }
      return key || 'Collaborateur';
    } catch (e) { return key || 'Collaborateur'; }
  }

  function getAllAuditUsers() {
    var userMap = {};
    try {
      var fn = (typeof getSortedUsers === 'function') ? getSortedUsers : (window.getSortedUsers || null);
      if (typeof fn === 'function') {
        fn(false).forEach(function (pair) {
          if (pair && pair[0]) userMap[pair[0]] = (pair[1] && pair[1].label) || pair[0];
        });
      }
    } catch (e) { }

    try {
      var uObj = (typeof USERS !== 'undefined' && USERS) ? USERS : (window.USERS || null);
      if (uObj && typeof uObj === 'object') {
        Object.keys(uObj).forEach(function (k) {
          if (!userMap[k]) userMap[k] = (uObj[k] && uObj[k].label) || k;
        });
      }
    } catch (e) { }

    try {
      var raw = localStorage.getItem('eqnovia_users_v1');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(function (k) {
            if (!userMap[k]) userMap[k] = (parsed[k] && parsed[k].label) || k;
          });
        }
      }
    } catch (e) { }

    try {
      auditLoadLocal().forEach(function (l) {
        if (l && l.user && l.user !== '—' && !userMap[l.user]) {
          userMap[l.user] = userLabel(l.user);
        }
      });
    } catch (e) { }

    return userMap;
  }

  function findExpById(id) {
    if (typeof window.dataAll !== 'function') return null;
    var list = window.dataAll();
    return list.filter(function (e) { return String(e.id) === String(id); })[0] || null;
  }

  function rowIdFromHtml(html) {
    var m = /(?:editRow|deleteRow|viewJustificatif|toggleRembourse|viewRemboursement|l2\w+)\(\s*'?\"?(\d+)/.exec(html);
    return m ? parseInt(m[1], 10) : null;
  }

  /* ═══════════════════════════════════════════════════════════════
     FONCTIONNALITÉ 1 : TVA RÉCUPÉRABLE / NON
     ═══════════════════════════════════════════════════════════════ */
  var tvaState = { search: '' };

  function tvaData() {
    return (typeof window.dataAll === 'function') ? window.dataAll() : [];
  }

  function adminTvaActive() {
    return isAdminNow() || isComptableNow();
  }

  /* ── 1.A Champ de saisie TVA dans le formulaire Saisie Manuelle ── */
  function injectTvaSaisieField() {
    var amountInput = document.getElementById('amountInput');
    if (!amountInput || document.getElementById('l2TvaSaisieWrap')) return;
    var parentGroup = amountInput.closest('.form-group');
    if (!parentGroup) return;

    var wrap = document.createElement('div');
    wrap.className = 'form-group span-2';
    wrap.id = 'l2TvaSaisieWrap';
    wrap.innerHTML =
      '<div class="l2-tva-saisie-box">' +
      '  <label class="l2-checkbox-label">' +
      '    <input type="checkbox" id="l2TvaRecup" />' +
      '    <span>💶 TVA récupérable</span>' +
      '  </label>' +
      '  <div class="l2-tva-inputs" id="l2TvaInputs" style="display:none;">' +
      '    <label>Taux :' +
      '      <select id="l2TvaRate" class="form-select">' +
      '        <option value="20" selected>20% (standard)</option>' +
      '        <option value="14">14% (transport)</option>' +
      '        <option value="10">10% (restauration/hôtel)</option>' +
      '        <option value="7">7% (fournitures)</option>' +
      '        <option value="custom">Autre</option>' +
      '      </select>' +
      '    </label>' +
      '    <label>Montant TVA (DH) :' +
      '      <input type="number" id="l2TvaAmount" class="form-input" step="0.01" min="0" placeholder="0.00" style="width:110px;" />' +
      '    </label>' +
      '  </div>' +
      '</div>';

    parentGroup.parentNode.insertBefore(wrap, parentGroup.nextSibling);

    var chk = document.getElementById('l2TvaRecup');
    var inputs = document.getElementById('l2TvaInputs');
    var rateSel = document.getElementById('l2TvaRate');
    var amtInp = document.getElementById('l2TvaAmount');

    function updateTvaCalc() {
      if (!chk.checked) return;
      var ttc = parseFloat(amountInput.value) || 0;
      var rate = parseFloat(rateSel.value);
      if (!isNaN(rate) && rate > 0) {
        var tva = (ttc * rate) / (100 + rate);
        amtInp.value = tva.toFixed(2);
      }
    }

    chk.addEventListener('change', function () {
      inputs.style.display = chk.checked ? 'flex' : 'none';
      if (chk.checked) updateTvaCalc();
      else amtInp.value = '';
    });

    rateSel.addEventListener('change', updateTvaCalc);
    amountInput.addEventListener('input', updateTvaCalc);
  }

  /* ── 1.B Champ TVA dans la modal d'édition (#editModal) ── */
  function injectTvaEditField() {
    var editAmount = document.getElementById('editAmount');
    if (!editAmount || document.getElementById('l2TvaEditWrap')) return;
    var parentGroup = editAmount.closest('.form-group');
    if (!parentGroup) return;

    var wrap = document.createElement('div');
    wrap.className = 'form-group span-2';
    wrap.id = 'l2TvaEditWrap';
    wrap.innerHTML =
      '<div class="l2-tva-saisie-box">' +
      '  <label class="l2-checkbox-label">' +
      '    <input type="checkbox" id="l2EditTvaRecup" />' +
      '    <span>💶 TVA récupérable</span>' +
      '  </label>' +
      '  <div class="l2-tva-inputs" id="l2EditTvaInputs" style="display:none;">' +
      '    <label>Montant TVA (DH) :' +
      '      <input type="number" id="l2EditTvaAmount" class="form-input" step="0.01" min="0" placeholder="0.00" style="width:110px;" />' +
      '    </label>' +
      '  </div>' +
      '</div>';

    parentGroup.parentNode.insertBefore(wrap, parentGroup.nextSibling);

    var chk = document.getElementById('l2EditTvaRecup');
    var inputs = document.getElementById('l2EditTvaInputs');
    chk.addEventListener('change', function () {
      inputs.style.display = chk.checked ? 'flex' : 'none';
    });
  }

  /* ── 1.C Bouton « Gérer la TVA » sous la page Remboursement (admin) ── */
  function injectTvaButton() {
    var tabRemb = document.getElementById('tab-content-remboursement');
    if (!tabRemb || document.getElementById('l2TvaBtnPanel')) return;
    var panel = document.createElement('div');
    panel.className = 'l2-tva-btn-panel';
    panel.id = 'l2TvaBtnPanel';
    panel.innerHTML =
      '<button class="l2-tva-manage-btn" id="l2TvaOpenBtn" onclick="window.openTvaModal()">' +
      '  <span aria-hidden="true">🧾</span> Gérer la TVA récupérable' +
      '</button>' +
      '<span class="l2-tva-btn-hint">Affectez le statut de TVA (récupérable/non) et le montant calculé pour chaque dépense.</span>';
    tabRemb.appendChild(panel);
  }

  function injectTvaModal() {
    if (document.getElementById('l2TvaModal')) return;
    var div = document.createElement('div');
    div.className = 'modal-overlay';
    div.id = 'l2TvaModal';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.innerHTML =
      '<div class="modal">' +
      '  <div class="modal-header">' +
      '    <h3>🧾 Gestion de la TVA récupérable (Admin)</h3>' +
      '    <button class="modal-close" onclick="window.closeTvaModal()" aria-label="Fermer">✕</button>' +
      '  </div>' +
      '  <div class="modal-body">' +
      '    <div class="l2tva-toolbar">' +
      '      <input type="text" class="form-input" id="l2TvaSearch" placeholder="🔍 Rechercher une dépense (desc, collab, cat…)" autocomplete="off" />' +
      '      <span class="l2tva-count" id="l2TvaCount">0 dépenses</span>' +
      '    </div>' +
      '    <div class="l2tva-list" id="l2TvaList"></div>' +
      '  </div>' +
      '  <div class="modal-footer">' +
      '    <button class="btn btn-ghost" onclick="window.closeTvaModal()">Fermer</button>' +
      '    <button class="btn btn-primary" id="l2TvaSaveBtn" onclick="window.saveTvaChanges()">💾 Enregistrer</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(div);

    var search = document.getElementById('l2TvaSearch');
    if (search) {
      search.addEventListener('input', function (e) {
        tvaState.search = e.target.value.toLowerCase();
        renderTvaList();
      });
    }
  }

  function openTvaModal() {
    if (!adminTvaActive()) {
      if (typeof window.toast === 'function') window.toast('Accès restreint à l\'administrateur / comptable.', 'err');
      return;
    }
    injectTvaModal();
    tvaState.search = '';
    var s = document.getElementById('l2TvaSearch');
    if (s) s.value = '';
    renderTvaList();
    var m = document.getElementById('l2TvaModal');
    if (m) m.classList.add('active');
  }

  function closeTvaModal() {
    var m = document.getElementById('l2TvaModal');
    if (m) m.classList.remove('active');
  }

  function renderTvaList() {
    var list = document.getElementById('l2TvaList');
    var countEl = document.getElementById('l2TvaCount');
    if (!list) return;

    var all = tvaData().slice().reverse();
    var q = tvaState.search;
    var filtered = q ? all.filter(function (e) {
      return (e.desc || '').toLowerCase().indexOf(q) >= 0
        || (e.cat || '').toLowerCase().indexOf(q) >= 0
        || (e.date || '').indexOf(q) >= 0
        || userLabel(e.user).toLowerCase().indexOf(q) >= 0;
    }) : all;

    if (countEl) countEl.textContent = filtered.length + ' dépense(s)';
    if (!filtered.length) {
      list.innerHTML = '<p class="l2tva-empty">Aucune dépense ne correspond aux critères.</p>';
      return;
    }

    var html = '';
    filtered.forEach(function (e) {
      var currentTva = e.tva || 'non';
      var currentAmt = e.tvaAmount != null ? e.tvaAmount : '';
      html +=
        '<div class="l2tva-row" data-l2id="' + e.id + '">' +
        '  <div class="l2tva-desc">' +
        '    <span class="l2tva-title" title="' + esc(e.desc || '') + '">' + esc(e.desc || '(sans description)') + '</span>' +
        '    <span class="l2tva-meta">' + esc(e.date || '') + ' • ' + esc(e.cat || 'Autre') + ' • ' + esc(userLabel(e.user)) + '</span>' +
        '  </div>' +
        '  <div class="l2tva-amount">' + fmtDH(e.amount) + '</div>' +
        '  <select class="form-select l2tva-sel" data-l2sel="' + e.id + '">' +
        '    <option value="non"' + (currentTva !== 'oui' ? ' selected' : '') + '>TVA Non</option>' +
        '    <option value="oui"' + (currentTva === 'oui' ? ' selected' : '') + '>TVA Récup.</option>' +
        '  </select>' +
        '  <input type="number" class="form-input l2tva-amt" data-l2amt="' + e.id + '" min="0" step="0.01" ' +
        '    placeholder="TVA (DH)" value="' + esc(currentAmt) + '" ' + (currentTva === 'oui' ? '' : 'style="visibility:hidden;"') + ' />' +
        '</div>';
    });

    list.innerHTML = html;

    list.querySelectorAll('.l2tva-sel').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var amt = list.querySelector('.l2tva-amt[data-l2amt="' + sel.dataset.l2sel + '"]');
        if (!amt) return;
        if (sel.value === 'oui') {
          amt.style.visibility = 'visible';
          if (!amt.value || parseFloat(amt.value) === 0) {
            var row = sel.closest('.l2tva-row');
            var id = row ? row.dataset.l2id : null;
            var exp = findExpById(id);
            if (exp && exp.amount) {
              amt.value = ((parseFloat(exp.amount) * 20) / 120).toFixed(2);
            }
          }
        } else {
          amt.style.visibility = 'hidden';
          amt.value = '';
        }
      });
    });
  }

  function saveTvaChanges() {
    var list = document.getElementById('l2TvaList');
    if (!list) return;
    var rows = list.querySelectorAll('.l2tva-row');
    var changes = [];

    rows.forEach(function (r) {
      var id = r.dataset.l2id;
      var sel = r.querySelector('.l2tva-sel');
      var amtEl = r.querySelector('.l2tva-amt');
      if (!id || !sel) return;
      var newTva = sel.value === 'oui' ? 'oui' : 'non';
      var newAmt = newTva === 'oui' ? (parseFloat(amtEl.value) || 0) : 0;
      var exp = findExpById(id);
      if (!exp) return;
      var oldTva = exp.tva || 'non';
      var oldAmt = exp.tvaAmount != null ? parseFloat(exp.tvaAmount) : 0;
      if (oldTva !== newTva || Math.abs(oldAmt - newAmt) > 0.009) {
        changes.push(function () {
          return Promise.resolve(window.dataUpdate(id, { tva: newTva, tvaAmount: newAmt }));
        });
      }
    });

    if (!changes.length) {
      if (typeof window.toast === 'function') window.toast('Aucune modification détectée.', 'info');
      closeTvaModal();
      return;
    }

    var btn = document.getElementById('l2TvaSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
    Promise.all(changes.map(function (fn) { return fn(); }))
      .then(function () {
        if (typeof window.toast === 'function') window.toast('🧾 TVA mise à jour avec succès.', 'ok');
        if (typeof window.renderAll === 'function') window.renderAll();
        if (typeof window.renderRemboursement === 'function') window.renderRemboursement();
      })
      .catch(function (err) {
        console.warn('[Lot2] sauvegarde TVA', err);
        if (typeof window.toast === 'function') window.toast('Erreur lors de la sauvegarde TVA.', 'err');
      })
      .then(function () {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Enregistrer'; }
        closeTvaModal();
      });
  }

  /* ── 1.D Filtre TVA dans la barre de filtre (Toutes) ── */
  function injectTvaFilter() {
    var ref = document.getElementById('filterCat');
    if (!ref || document.getElementById('l2TvaFilter')) return;
    var sel = document.createElement('select');
    sel.className = 'form-select l2-tva-filter';
    sel.id = 'l2TvaFilter';
    sel.setAttribute('aria-label', 'Filtrer par statut TVA');
    sel.innerHTML =
      '<option value="all">🧾 TVA : Toutes</option>' +
      '<option value="oui">🧾 TVA Récupérable</option>' +
      '<option value="non">🧾 TVA Non récupérable</option>';
    sel.addEventListener('change', function () {
      if (typeof window.renderAll === 'function') window.renderAll();
    });
    ref.parentNode.insertBefore(sel, ref.nextSibling);
  }

  function refreshTvaVisibility() {
    var show = adminTvaActive();
    var btnPanel = document.getElementById('l2TvaBtnPanel');
    if (btnPanel) btnPanel.style.display = show ? 'flex' : 'none';
    var filter = document.getElementById('l2TvaFilter');
    if (filter) filter.style.display = show ? '' : 'none';
  }

  /* ═══════════════════════════════════════════════════════════════
     FONCTIONNALITÉ 3 : WORKFLOW INTERNE
     Statuts : draft, submitted, validated, refunded, rejected
     ═══════════════════════════════════════════════════════════════ */
  var WORKFLOW_STATUSES = {
    'draft': { label: 'Brouillon', icon: '📝', badgeClass: 'l2-wf-draft' },
    'submitted': { label: 'Soumis', icon: '📤', badgeClass: 'l2-wf-submitted' },
    'validated': { label: 'Validé Manager', icon: '✔️', badgeClass: 'l2-wf-validated' },
    'refunded': { label: 'Remboursé', icon: '✅', badgeClass: 'l2-wf-refunded' },
    'rejected': { label: 'Rejeté', icon: '❌', badgeClass: 'l2-wf-rejected' }
  };

  function getExpenseWorkflowStatus(exp) {
    if (!exp) return 'submitted';
    if (exp.l2Status) return exp.l2Status;
    if (exp.rembourse === true) return 'refunded';
    return 'submitted';
  }

  function setWorkflowStatus(id, newStatus, reason) {
    var exp = findExpById(id);
    if (!exp) return;
    var updates = {
      l2Status: newStatus,
      l2StatusAt: new Date().toISOString(),
      l2StatusBy: auditNowUser()
    };
    if (newStatus === 'rejected') {
      updates.l2RejectReason = reason || 'Non spécifié';
    } else if (newStatus === 'refunded') {
      updates.rembourse = true;
      updates.rembourseDate = todayStr();
      updates.rembourseBy = auditNowUser();
    }

    Promise.resolve(window.dataUpdate(id, updates)).then(function () {
      if (typeof window.toast === 'function') {
        window.toast('Statut mis à jour : ' + (WORKFLOW_STATUSES[newStatus] ? WORKFLOW_STATUSES[newStatus].label : newStatus), 'ok');
      }

      if (typeof window.renderAll === 'function') window.renderAll();
      if (typeof window.renderRemboursement === 'function') window.renderRemboursement();
    });
  }

  window.l2SubmitExpense = function (id) {
    setWorkflowStatus(id, 'submitted');
  };

  window.l2ValidateExpense = function (id) {
    if (!adminTvaActive()) {
      if (typeof window.toast === 'function') window.toast('Réservé aux managers / administrateurs.', 'err');
      return;
    }
    setWorkflowStatus(id, 'validated');
  };

  window.l2RejectExpense = function (id) {
    if (!adminTvaActive()) {
      if (typeof window.toast === 'function') window.toast('Réservé aux managers / administrateurs.', 'err');
      return;
    }
    var reason = prompt('Motif du rejet de la dépense :', 'Justificatif non conforme');
    if (reason === null) return;
    setWorkflowStatus(id, 'rejected', reason.trim() || 'Non spécifié');
  };

  window.l2RefundExpense = function (id) {
    if (!adminTvaActive()) {
      if (typeof window.toast === 'function') window.toast('Réservé à l\'administration.', 'err');
      return;
    }
    setWorkflowStatus(id, 'refunded');
  };

  /* Filtre de workflow dans l'onglet Toutes */
  function injectWorkflowFilter() {
    var ref = document.getElementById('filterCat');
    if (!ref || document.getElementById('l2WfFilter')) return;
    var sel = document.createElement('select');
    sel.className = 'form-select l2-wf-filter';
    sel.id = 'l2WfFilter';
    sel.setAttribute('aria-label', 'Filtrer par statut Workflow');
    sel.innerHTML =
      '<option value="all">⚡ Statut : Tous</option>' +
      '<option value="draft">📝 Brouillons</option>' +
      '<option value="submitted">📤 Soumis (en attente)</option>' +
      '<option value="validated">✔️ Validés Manager</option>' +
      '<option value="refunded">✅ Remboursés</option>' +
      '<option value="rejected">❌ Rejetés</option>';
    sel.addEventListener('change', function () {
      if (typeof window.renderAll === 'function') window.renderAll();
    });
    ref.parentNode.insertBefore(sel, ref.nextSibling);
  }

  /* ═══════════════════════════════════════════════════════════════
     FONCTIONNALITÉ 4 : AGENT IA
     (PCGM, doublons, anomalies >5000 / justificatif / date>1an)
     ═══════════════════════════════════════════════════════════════ */
  var PCGM_RULES = [
    {
      cat: 'Transport',
      account: '6142',
      accountName: 'Transports du personnel',
      icon: '🚗',
      keywords: ['train', 'tgv', 'oncf', 'tram', 'tramway', 'taxi', 'bus', 'peage', 'autoroute', 'adm',
        'carburant', 'essence', 'gasoil', 'gazole', 'shell', 'total', 'afriquia', 'winxo', 'parking',
        'vol', 'avion', 'billet', 'uber', 'careem', 'heetch', 'transport', 'trajet', 'deplacement', 'km']
    },
    {
      cat: 'Repas',
      account: '6143',
      accountName: 'Déplacements, missions et réceptions',
      icon: '🍽️',
      keywords: ['restaurant', 'resto', 'dejeuner', 'diner', 'cafe', 'coffee', 'repas', 'petit dejeuner',
        'sandwich', 'collation', 'traiteur', 'buffet', 'food', 'pizza', 'burger', 'sushi', 'menu',
        'pause cafe', 'starbucks', 'paul', 'mcdo', 'kfc']
    },
    {
      cat: 'Hébergement',
      account: '6144',
      accountName: 'Frais de séjour',
      icon: '🏨',
      keywords: ['hotel', 'nuit', 'nuitee', 'hebergement', 'ibis', 'novotel', 'hilton', 'radisson',
        'sofitel', 'booking', 'airbnb', 'appart', 'sejour', 'chambre']
    },
    {
      cat: 'Matériel',
      account: '6122',
      accountName: 'Achats matières & fournitures',
      icon: '📦',
      keywords: ['fourniture', 'papeterie', 'bureau', 'papier', 'cartouche', 'toner', 'encre', 'stylo',
        'cable', 'souris', 'clavier', 'ecran', 'usb', 'disque', 'chargeur', 'adaptateur', 'pc',
        'ordinateur', 'informatique', 'consommable', 'materiel', 'equipement', 'bureau']
    },
    {
      cat: 'Communication',
      account: '6145',
      accountName: 'Frais postaux & télécoms',
      icon: '📞',
      keywords: ['telephone', 'telecom', 'forfait', 'recharge', 'orange', 'inwi', 'iam', 'maroc telecom',
        'internet', 'wifi', 'routeur', 'sim', 'abonnement', 'poste', 'timbre', 'courrier', 'dhl', 'aramex']
    },
    {
      cat: 'Formation',
      account: '6167',
      accountName: 'Frais formation du personnel',
      icon: '🎓',
      keywords: ['formation', 'cours', 'seminaire', 'certification', 'stage', 'atelier', 'workshop',
        'conference', 'webinaire', 'ecole', 'examen', 'learning']
    }
  ];

  function suggestPcgmCategory(text) {
    if (!text || text.trim().length < 3) return null;
    var norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (var i = 0; i < PCGM_RULES.length; i++) {
      var r = PCGM_RULES[i];
      for (var j = 0; j < r.keywords.length; j++) {
        var kw = r.keywords[j];
        if (norm.indexOf(kw) >= 0) {
          return r;
        }
      }
    }
    return null;
  }

  function detectExpenseDuplicates(date, amount, user, currentId) {
    if (!date || !amount) return null;
    var amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return null;
    var list = (typeof window.dataAll === 'function') ? window.dataAll() : [];

    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (currentId && String(e.id) === String(currentId)) continue;
      if (Math.abs(parseFloat(e.amount) - amt) < 0.01) {
        var matchUser = (!user || !e.user || e.user === user);
        if (matchUser) {
          if (e.date === date) {
            return { type: 'exact', exp: e };
          }
          if (e.date && date) {
            var diffDays = Math.abs(new Date(e.date) - new Date(date)) / (1000 * 60 * 60 * 24);
            if (diffDays <= 2) {
              return { type: 'close', exp: e, diffDays: Math.round(diffDays) };
            }
          }
        }
      }
    }
    return null;
  }

  function detectExpenseAnomalies(exp) {
    var alerts = [];
    if (!exp) return alerts;
    var amt = parseFloat(exp.amount) || 0;
    if (amt > 5000) {
      alerts.push({ code: 'amount_5000', text: 'Montant supérieur à 5 000 DH : validation préalable de direction requise' });
    }
    var hasJustif = !!(exp.justificatif || exp.justifStorageUrl || (exp.justificatifs && exp.justificatifs.length));
    if (!hasJustif) {
      alerts.push({ code: 'no_justif', text: 'Justificatif manquant : aucun reçu ou facture joint' });
    }
    if (exp.date) {
      var expDate = new Date(exp.date);
      var now = new Date();
      var diffDays = (now - expDate) / (1000 * 60 * 60 * 24);
      if (diffDays > 365) {
        alerts.push({ code: 'old_1year', text: 'Dépense de plus d\'un an : risque de prescription fiscale' });
      }
    }
    return alerts;
  }

  function injectAiAssistant() {
    var descInput = document.getElementById('descInput');
    var catInput = document.getElementById('catInput');
    var amountInput = document.getElementById('amountInput');
    var dateInput = document.getElementById('dateInput');

    if (descInput && !document.getElementById('l2AiSuggestBox')) {
      var box = document.createElement('div');
      box.id = 'l2AiSuggestBox';
      box.style.display = 'none';
      descInput.parentNode.insertBefore(box, descInput.nextSibling);

      var dupBox = document.createElement('div');
      dupBox.id = 'l2AiDupBox';
      dupBox.style.display = 'none';
      if (amountInput) amountInput.parentNode.insertBefore(dupBox, amountInput.nextSibling);

      descInput.addEventListener('input', function () {
        var s = suggestPcgmCategory(descInput.value);
        if (s && catInput) {
          box.innerHTML =
            '<div class="l2-ai-suggestion">' +
            '  <span>✨ IA Eqnovia : suggestion <strong>' + s.icon + ' ' + esc(s.cat) + '</strong> (' + esc(s.accountName) + ' • Cpt ' + esc(s.account) + ')</span>' +
            '  <button type="button" class="l2-ai-apply-btn" id="l2AiApplyBtn">Appliquer</button>' +
            '</div>';
          box.style.display = 'block';
          var btn = document.getElementById('l2AiApplyBtn');
          if (btn) {
            btn.onclick = function () {
              catInput.value = s.cat;
              box.style.display = 'none';
              catInput.style.outline = '2px solid #2563EB';
              setTimeout(function () { catInput.style.outline = ''; }, 900);
            };
          }
        } else {
          box.style.display = 'none';
        }
      });

      function checkDupOnSaisie() {
        if (!dateInput || !amountInput) return;
        var dup = detectExpenseDuplicates(dateInput.value, amountInput.value, auditNowUser(), null);
        if (dup) {
          dupBox.innerHTML =
            '<div class="l2-ai-alert warning">' +
            '  <span>⚠️ <strong>Alerte doublon IA :</strong> Dépense similaire détectée (' +
            fmtDH(dup.exp.amount) + ' le ' + esc(dup.exp.date) + ' « ' + esc(dup.exp.desc) + ' »)</span>' +
            '</div>';
          dupBox.style.display = 'block';
        } else {
          dupBox.style.display = 'none';
        }
      }

      if (dateInput) dateInput.addEventListener('change', checkDupOnSaisie);
      if (amountInput) amountInput.addEventListener('input', checkDupOnSaisie);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     FONCTIONNALITÉ 5 : NOTIFICATIONS
     Email vers fbourzgui@eqnovia.ma + WhatsApp wa.me
     ═══════════════════════════════════════════════════════════════ */
  var ACCOUNTING_EMAIL = 'fbourzgui@eqnovia.ma';
  var ACCOUNTING_PHONE = '0664549777';

  function normalizeMoroccanPhone(phone) {
    if (!phone) return '';
    var clean = String(phone).replace(/\s+/g, '').replace(/[^\d+]/g, '');
    if (clean.startsWith('0')) clean = '212' + clean.substring(1);
    if (clean.startsWith('+')) clean = clean.substring(1);
    return clean;
  }

  function sendUnrefundedEmailReport() {
    var all = (typeof window.dataAll === 'function') ? window.dataAll() : [];
    var unrefunded = all.filter(function (e) { return !e.rembourse; });

    if (!unrefunded.length) {
      if (typeof window.toast === 'function') window.toast('Toutes les dépenses sont déjà remboursées !', 'ok');
      return;
    }

    var byUser = {};
    var totalDH = 0;
    unrefunded.forEach(function (e) {
      var u = e.user || 'collaborateur';
      byUser[u] = byUser[u] || { count: 0, total: 0 };
      byUser[u].count++;
      var amt = parseFloat(e.amount) || 0;
      byUser[u].total += amt;
      totalDH += amt;
    });

    var recapLines = Object.keys(byUser).map(function (u) {
      return '• ' + userLabel(u) + ' : ' + fmtDH(byUser[u].total) + ' (' + byUser[u].count + ' dépense(s))';
    }).join('\n');

    var subject = '[Eqnovia Notes de frais] ' + unrefunded.length + ' dépense(s) en attente de remboursement (' + fmtDH(totalDH) + ')';
    var body =
      'Bonjour Fatima Zahra,\n\n' +
      'Voici le récapitulatif des notes de frais Eqnovia en attente de remboursement au ' + new Date().toLocaleDateString('fr-FR') + ' :\n\n' +
      recapLines + '\n\n' +
      'MONTANT TOTAL À REMBOURSER : ' + fmtDH(totalDH) + '\n\n' +
      'Vous pouvez vous connecter à l\'application Eqnovia pour procéder aux validations et virements :\n' +
      window.location.origin + window.location.pathname + '\n\n' +
      'Cordialement,\nSystème de Gestion des Frais Eqnovia';

    var mailtoUrl = 'mailto:' + ACCOUNTING_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

    if (window.emailjs && window.EMAILJS_CONFIG && window.EMAILJS_CONFIG.serviceID && !window.EMAILJS_CONFIG.serviceID.includes('xxxxxxx')) {
      window.emailjs.send(window.EMAILJS_CONFIG.serviceID, window.EMAILJS_CONFIG.templateID, {
        to_email: ACCOUNTING_EMAIL,
        to_name: 'Fatima Zahra Bourzgui',
        subject: subject,
        message: body
      }).then(function () {
        if (typeof window.toast === 'function') window.toast('📧 Email envoyé avec succès à ' + ACCOUNTING_EMAIL, 'ok');
      }).catch(function (err) {
        console.warn('[Lot2] EmailJS send', err);
        window.location.href = mailtoUrl;
      });
    } else {
      window.location.href = mailtoUrl;
      if (typeof window.toast === 'function') {
        window.toast('📧 Client email ouvert pour ' + ACCOUNTING_EMAIL, 'info');
      }
    }
  }

  function openWhatsAppNotification(expId) {
    var exp = findExpById(expId);
    if (!exp) return;
    var userObj = ((typeof USERS !== 'undefined' && USERS) ? USERS : (window.USERS || {}))[exp.user] || {};
    var phone = normalizeMoroccanPhone(userObj.tel || ACCOUNTING_PHONE);
    var uName = userLabel(exp.user);
    var status = getExpenseWorkflowStatus(exp);
    var statusLabel = WORKFLOW_STATUSES[status] ? WORKFLOW_STATUSES[status].label : 'traitée';

    var msg = 'Bonjour ' + uName + ',\nVotre note de frais du ' + (exp.date || '') + ' d\'un montant de ' + fmtDH(exp.amount) +
      ' (« ' + (exp.desc || '') + ' ») est actuellement ' + statusLabel + '.\n— Eqnovia Notes de Frais';

    var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');
  }

  /* ═══════════════════════════════════════════════════════════════
     FONCTIONNALITÉ 7 : OFFLINE INDEXEDDB & SYNC FIREBASE
     ═══════════════════════════════════════════════════════════════ */
  var IDB_NAME = 'eqnovia_offline_db';
  var IDB_VER = 1;
  var dbInstance = null;

  function openIndexedDb(cb) {
    if (dbInstance) { cb(dbInstance); return; }
    if (!window.indexedDB) { cb(null); return; }
    var req = window.indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = function (e) {
      dbInstance = e.target.result;
      cb(dbInstance);
    };
    req.onerror = function (e) {
      console.warn('[Lot2] IndexedDB error', e);
      cb(null);
    };
  }

  function saveExpensesToIdb(expenses) {
    openIndexedDb(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction('expenses', 'readwrite');
        var store = tx.objectStore('expenses');
        expenses.forEach(function (e) { store.put(e); });
      } catch (err) { console.warn('[Lot2] IDB save expenses', err); }
    });
  }

  function queueOutboxAction(type, data) {
    openIndexedDb(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction('outbox', 'readwrite');
        var store = tx.objectStore('outbox');
        store.add({ type: type, data: data, ts: new Date().toISOString() });
      } catch (err) { console.warn('[Lot2] IDB queue action', err); }
    });
  }

  function syncOutboxWithCloud() {
    if (!navigator.onLine || !window.__fs || !window.__db || !window.__fbReady) return;
    openIndexedDb(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction('outbox', 'readonly');
        var store = tx.objectStore('outbox');
        var req = store.getAll();
        req.onsuccess = function () {
          var items = req.result || [];
          if (!items.length) return;
          var promises = items.map(function (item) {
            var fs = window.__fs;
            if (item.type === 'add') {
              return fs.addDoc(fs.collection(window.__db, 'expenses'), item.data);
            } else if (item.type === 'update') {
              var q = fs.query(fs.collection(window.__db, 'expenses'), fs.where('id', '==', item.data.id));
              return fs.getDocs(q).then(function (snap) {
                var p = [];
                snap.forEach(function (d) { p.push(fs.updateDoc(fs.doc(window.__db, 'expenses', d.id), item.data.updates)); });
                return Promise.all(p);
              });
            } else if (item.type === 'delete') {
              var qd = fs.query(fs.collection(window.__db, 'expenses'), fs.where('id', '==', item.data.id));
              return fs.getDocs(qd).then(function (snap) {
                var p = [];
                snap.forEach(function (d) { p.push(fs.deleteDoc(fs.doc(window.__db, 'expenses', d.id))); });
                return Promise.all(p);
              });
            }
          });

          Promise.all(promises).then(function () {
            var clearTx = db.transaction('outbox', 'readwrite');
            clearTx.objectStore('outbox').clear();
            if (typeof window.toast === 'function') {
              window.toast('🟢 ' + items.length + ' action(s) hors-ligne synchronisée(s) avec Firebase.', 'ok');
            }
          }).catch(function (e) {
            console.warn('[Lot2] Sync outbox error', e);
          });
        };
      } catch (err) { console.warn('[Lot2] IDB read outbox', err); }
    });
  }

  function injectNetworkStatusIndicator() {
    var headerRight = document.querySelector('.app-header-right');
    if (!headerRight || document.getElementById('l2NetStatus')) return;

    var pill = document.createElement('div');
    pill.className = 'l2-net-status';
    pill.id = 'l2NetStatus';
    var isOnline = navigator.onLine;
    pill.innerHTML =
      '<span class="l2-net-dot ' + (isOnline ? 'online' : 'offline') + '"></span>' +
      '<span class="l2-net-text">' + (isOnline ? 'En ligne' : 'Hors-ligne') + '</span>';

    headerRight.insertBefore(pill, headerRight.firstChild);

    window.addEventListener('online', function () {
      pill.querySelector('.l2-net-dot').className = 'l2-net-dot online';
      pill.querySelector('.l2-net-text').textContent = 'En ligne';
      if (typeof window.toast === 'function') window.toast('🟢 Connexion rétablie — Mode en ligne', 'ok');
      syncOutboxWithCloud();
    });

    window.addEventListener('offline', function () {
      pill.querySelector('.l2-net-dot').className = 'l2-net-dot offline';
      pill.querySelector('.l2-net-text').textContent = 'Hors-ligne';
      if (typeof window.toast === 'function') window.toast('🔴 Connexion perdue — Mode local actif (sauvegarde auto)', 'err');
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     DÉCORATEUR UNIFIÉ DES LIGNES DU TABLEAU DES DÉPENSES
     Badges : TVA, Workflow, Doublons, Anomalies, WhatsApp, Actions
     ═══════════════════════════════════════════════════════════════ */
  function decorateExpenseRows() {
    var tbody = document.getElementById('tbody');
    if (!tbody) return;
    var all = tvaData();
    var byId = {};
    all.forEach(function (e) { byId[e.id] = e; });
    var admin = adminTvaActive();

    Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function (tr) {
      if (tr.querySelector('.empty-state') || tr.dataset.l2Decorated === '1') return;
      var id = rowIdFromHtml(tr.innerHTML);
      if (id == null) return;
      var exp = byId[id];
      if (!exp) return;

      var catCell = tr.querySelector('.badge-cat');
      var actionCell = tr.querySelector('.td-actions') || tr.cells[tr.cells.length - 1];

      /* 1. Badge TVA (si admin/comptable et tva renseignée) */
      if (admin && exp.tva && !tr.querySelector('.l2-tva-badge')) {
        var b = document.createElement('span');
        b.className = 'l2-tva-badge ' + (exp.tva === 'oui' ? 'l2-tva-oui' : 'l2-tva-non');
        b.textContent = exp.tva === 'oui' ? ('🧾 TVA ✓' + (exp.tvaAmount != null ? ' ' + exp.tvaAmount : '')) : '🧾 TVA ✕';
        if (catCell) catCell.parentNode.appendChild(b);
      }

      /* 2. Badge Workflow */
      if (!tr.querySelector('.l2-wf-badge')) {
        var st = getExpenseWorkflowStatus(exp);
        var stMeta = WORKFLOW_STATUSES[st] || WORKFLOW_STATUSES['submitted'];
        var wfb = document.createElement('span');
        wfb.className = 'badge l2-wf-badge ' + stMeta.badgeClass;
        wfb.innerHTML = stMeta.icon + ' ' + esc(stMeta.label);
        if (exp.l2RejectReason) wfb.title = 'Motif : ' + exp.l2RejectReason;
        if (catCell) catCell.parentNode.appendChild(wfb);
      }

      /* 3. Badges IA (Doublons & Anomalies) */
      if (!tr.querySelector('.l2-badge-dup')) {
        var dup = detectExpenseDuplicates(exp.date, exp.amount, exp.user, exp.id);
        if (dup) {
          var dbg = document.createElement('span');
          dbg.className = 'l2-badge-dup';
          dbg.innerHTML = '⚠️ Doublon';
          dbg.title = 'Même montant (' + fmtDH(dup.exp.amount) + ') le ' + dup.exp.date;
          if (catCell) catCell.parentNode.appendChild(dbg);
        }
      }

      var anomalies = detectExpenseAnomalies(exp);
      if (anomalies.length && !tr.querySelector('.l2-badge-anomaly')) {
        anomalies.forEach(function (a) {
          var abg = document.createElement('span');
          abg.className = 'l2-badge-anomaly';
          abg.textContent = a.code === 'amount_5000' ? '⚠️ >5k DH' : (a.code === 'no_justif' ? '⚠️ Justif' : '⚠️ >1 an');
          abg.title = a.text;
          if (catCell) catCell.parentNode.appendChild(abg);
        });
      }

      /* 4. Boutons d'actions Workflow & WhatsApp */
      if (actionCell && !tr.querySelector('.l2-wf-actions')) {
        var actionsDiv = document.createElement('div');
        actionsDiv.className = 'l2-wf-actions';

        var st = getExpenseWorkflowStatus(exp);
        if (admin) {
          if (st === 'submitted') {
            actionsDiv.innerHTML +=
              '<button type="button" class="l2-wf-btn l2-wf-btn-validate" onclick="window.l2ValidateExpense(' + exp.id + ')" title="Valider la dépense">✔️ Valider</button>' +
              '<button type="button" class="l2-wf-btn l2-wf-btn-reject" onclick="window.l2RejectExpense(' + exp.id + ')" title="Rejeter avec motif">❌ Rejeter</button>';
          } else if (st === 'validated') {
            actionsDiv.innerHTML +=
              '<button type="button" class="l2-wf-btn l2-wf-btn-refund" onclick="window.l2RefundExpense(' + exp.id + ')" title="Rembourser">💰 Rembourser</button>';
          }
        } else {
          if (st === 'draft' && exp.user === auditNowUser()) {
            actionsDiv.innerHTML +=
              '<button type="button" class="l2-wf-btn l2-wf-btn-submit" onclick="window.l2SubmitExpense(' + exp.id + ')" title="Soumettre au manager">📤 Soumettre</button>';
          }
        }
      }

      tr.dataset.l2Decorated = '1';
    });
  }

  var tbodyObserver = null;
  function observeTbody() {
    if (tbodyObserver || !('MutationObserver' in window)) return;
    tbodyObserver = new MutationObserver(function () {
      Array.prototype.forEach.call(document.querySelectorAll('#tbody tr[data-l2-decorated]'), function (r) {
        delete r.dataset.l2Decorated;
      });
      decorateExpenseRows();
    });
    var tbody = document.getElementById('tbody');
    if (tbody) {
      tbodyObserver.observe(tbody, { childList: true });
      decorateExpenseRows();
    } else {
      setTimeout(observeTbody, 800);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     HOOKS GLOBAUX ADDITIFS
     ═══════════════════════════════════════════════════════════════ */
  function initHooks() {
    /* dataAdd : enregistrement TVA + statut workflow initial + offline */
    wrapGlobal('dataAdd', {
      before: function (ctx) {
        var exp = ctx.args[0];
        if (!exp) return;
        var tvaChk = document.getElementById('l2TvaRecup');
        var tvaAmt = document.getElementById('l2TvaAmount');
        var tvaRate = document.getElementById('l2TvaRate');

        if (tvaChk && tvaChk.checked) {
          exp.tva = 'oui';
          exp.tvaAmount = parseFloat(tvaAmt ? tvaAmt.value : 0) || 0;
          exp.tvaRate = tvaRate ? tvaRate.value : '20';
        } else {
          exp.tva = 'non';
          exp.tvaAmount = 0;
        }

        if (!exp.l2Status) {
          exp.l2Status = adminTvaActive() ? 'validated' : 'submitted';
          exp.l2StatusAt = new Date().toISOString();
          exp.l2StatusBy = auditNowUser();
        }

        ctx._exp = JSON.parse(JSON.stringify(exp));
      },
      after: function (ctx) {
        if (ctx._exp) {
          queueOutboxAction('add', ctx._exp);
          saveExpensesToIdb(tvaData());
        }
      }
    });

    /* dataUpdate : persistance offline des modifications */
    wrapGlobal('dataUpdate', {
      before: function (ctx) {
        try { ctx._before = JSON.parse(JSON.stringify(findExpById(ctx.args[0]))); } catch (e) { ctx._before = null; }
      },
      after: function (ctx) {
        var updates = ctx.args[1] || {};
        queueOutboxAction('update', { id: ctx.args[0], updates: updates });
        saveExpensesToIdb(tvaData());
      }
    });

    /* dataDelete : capture avant suppression + offline */
    wrapGlobal('dataDelete', {
      before: function (ctx) {
        try { ctx._exp = JSON.parse(JSON.stringify(findExpById(ctx.args[0]))); } catch (e) { ctx._exp = null; }
      },
      after: function (ctx) {
        if (ctx._exp) {
          queueOutboxAction('delete', { id: ctx._exp.id });
          saveExpensesToIdb(tvaData());
        }
      }
    });

    /* dataLoad : persistance miroir dans IndexedDB */
    wrapGlobal('dataLoad', {
      after: function () {
        saveExpensesToIdb(tvaData());
        syncOutboxWithCloud();
      }
    });

    /* editRow : injection des valeurs TVA dans la modal d'édition */
    wrapGlobal('editRow', {
      after: function (ctx) {
        injectTvaEditField();
        var id = ctx.args[0];
        var exp = findExpById(id);
        var chk = document.getElementById('l2EditTvaRecup');
        var amt = document.getElementById('l2EditTvaAmount');
        var wrap = document.getElementById('l2EditTvaInputs');
        if (exp && chk && amt && wrap) {
          chk.checked = exp.tva === 'oui';
          amt.value = exp.tvaAmount != null ? exp.tvaAmount : '';
          wrap.style.display = chk.checked ? 'flex' : 'none';
        }
      }
    });

    /* renderAll : filtres combinés TVA et Workflow */
    wrapGlobal('renderAll', {
      before: function (ctx) {
        var fTva = document.getElementById('l2TvaFilter');
        var fWf = document.getElementById('l2WfFilter');
        var hasTva = fTva && fTva.value !== 'all' && adminTvaActive();
        var hasWf = fWf && fWf.value !== 'all';

        if (!hasTva && !hasWf) return;

        var dataAllOrig = window.dataAll;
        var wantTva = hasTva ? fTva.value : 'all';
        var wantWf = hasWf ? fWf.value : 'all';

        window.dataAll = function () {
          return dataAllOrig().filter(function (e) {
            if (wantTva !== 'all') {
              var isTva = e.tva === 'oui';
              if (wantTva === 'oui' && !isTva) return false;
              if (wantTva === 'non' && isTva) return false;
            }
            if (wantWf !== 'all') {
              var st = getExpenseWorkflowStatus(e);
              if (st !== wantWf) return false;
            }
            return true;
          });
        };
        ctx._restoreDataAll = function () { window.dataAll = dataAllOrig; };
      },
      after: function (ctx) {
        if (ctx._restoreDataAll) ctx._restoreDataAll();
        decorateExpenseRows();
      }
    });

    /* resetFilters : réinitialise aussi nos filtres additifs */
    wrapGlobal('resetFilters', {
      before: function () {
        var fTva = document.getElementById('l2TvaFilter');
        if (fTva) fTva.value = 'all';
        var fWf = document.getElementById('l2WfFilter');
        if (fWf) fWf.value = 'all';
      }
    });

    /* updateUserUI : rafraîchit visibilité des boutons et filtres */
    wrapGlobal('updateUserUI', {
      after: function () {
        refreshTvaVisibility();
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     API PUBLIQUE ET DÉMARRAGE DU LOT 2
     ═══════════════════════════════════════════════════════════════ */
  /* ═════════════════════════════════════════════════════
     FONCTIONNALITÉS 6 : ANALYTICS & AUDIT (ADMIN SEULEMENT)
     ═════════════════════════════════════════════════════ */
  function injectAnalyticsNav() {
    var navAnalytics = document.getElementById('nav-analytics');
    if (navAnalytics && isAdminNow()) {
      navAnalytics.style.display = '';
    }
    var bnavAnalytics = document.getElementById('bnav-analytics');
    if (bnavAnalytics && isAdminNow()) {
      bnavAnalytics.style.display = '';
    }
  }

  function injectAnalyticsTab() {
    injectAnalyticsNav();
  }

  function injectAuditNav() {
    var navAudit = document.getElementById('nav-audit');
    if (navAudit && isAdminNow()) {
      navAudit.style.display = '';
    }
    var bnavAudit = document.getElementById('bnav-audit');
    if (bnavAudit && isAdminNow()) {
      bnavAudit.style.display = '';
    }
  }

  function injectAuditTab() {
    injectAuditNav();
  }

  function renderAnalytics() {
    if (!isAdminNow()) {
      if (typeof window.toast === 'function') window.toast('Accès réservé à l\'administrateur.', 'err');
      if (typeof window.switchTab === 'function') window.switchTab('all');
      return;
    }
    var container = document.getElementById('analyticsDashboard');
    if (!container) return;

    var all = (typeof window.dataAll === 'function') ? window.dataAll() : [];
    var total = 0, remb = 0, nonRemb = 0;
    var byUser = {}, byCat = {}, byMonth = {};
    var tvaOui = 0, tvaTotal = 0;

    all.forEach(function (e) {
      var amt = parseFloat(e.amount) || 0;
      total += amt;
      if (e.rembourse) { remb += amt; } else { nonRemb += amt; }
      if (e.tva === 'oui') { tvaOui += parseFloat(e.tvaAmount) || 0; tvaTotal += amt; }
      byUser[e.user || 'Inconnu'] = (byUser[e.user || 'Inconnu'] || 0) + amt;
      byCat[e.cat || 'Autre'] = (byCat[e.cat || 'Autre'] || 0) + amt;
      var m = (e.date || '').substring(0, 7);
      if (m) byMonth[m] = (byMonth[m] || 0) + amt;
    });

    var html = '';
    html += '<div class="l2-analytics-grid">';
    html += '  <div class="l2-chart-card" style="grid-column:1/-1;"><div class="l2-chart-title">📊 Vue d\'ensemble</div>';
    html += '    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">';
    html += '      <div style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);padding:16px;border-radius:12px;border:1px solid #93c5fd;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><div style="background:#3b82f6;color:#fff;border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;">💰</div><div style="font-size:12px;color:#1e40af;font-weight:600;">TOTAL GÉNÉRAL</div></div><div style="font-size:24px;font-weight:800;color:#1e3a8a;">' + fmtDH(total) + '</div><div style="font-size:11px;color:#3b82f6;margin-top:4px;">' + all.length + ' dépense(s)</div></div>';
    html += '      <div style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);padding:16px;border-radius:12px;border:1px solid #86efac;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><div style="background:#22c55e;color:#fff;border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;">✅</div><div style="font-size:12px;color:#166534;font-weight:600;">FRAIS REMBOURSÉS</div></div><div style="font-size:24px;font-weight:800;color:#14532d;">' + fmtDH(remb) + '</div></div>';
    html += '      <div style="background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);padding:16px;border-radius:12px;border:1px solid #fecaca;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><div style="background:#ef4444;color:#fff;border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;">⏳</div><div style="font-size:12px;color:#991b1b;font-weight:600;">NON REMBOURSÉS</div></div><div style="font-size:24px;font-weight:800;color:#7f1d1d;">' + fmtDH(nonRemb) + '</div></div>';
    html += '      <div style="background:linear-gradient(135deg,#fefce8 0%,#fef3c7 100%);padding:16px;border-radius:12px;border:1px solid #fde68a;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><div style="background:#f59e0b;color:#fff;border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;">🧾</div><div style="font-size:12px;color:#92400e;font-weight:600;">TVA RÉCUPÉRABLE</div></div><div style="font-size:24px;font-weight:800;color:#78350f;">' + fmtDH(tvaOui) + '</div></div>';
    html += '    </div></div>';

    html += '  <div class="l2-chart-card"><div class="l2-chart-title">👥 Dépenses par collaborateur</div><div class="l2-chart-canvas-wrap"><canvas id="chartByUser"></canvas></div></div>';
    html += '  <div class="l2-chart-card"><div class="l2-chart-title">📋 Dépenses par catégorie</div><div class="l2-chart-canvas-wrap"><canvas id="chartByCat"></canvas></div></div>';
    html += '  <div class="l2-chart-card" style="grid-column:1/-1;"><div class="l2-chart-title">📈 Évolution mensuelle</div><div class="l2-chart-canvas-wrap" style="max-height:380px;"><canvas id="chartByMonth"></canvas></div></div>';
    html += '</div>';

    container.innerHTML = html;

    setTimeout(function () {
      try {
        if (typeof Chart === 'undefined') return;
        var labelsU = Object.keys(byUser).map(function (k) { return userLabel(k); });
        var dataU = Object.values(byUser);
        new Chart(document.getElementById('chartByUser'), { type: 'bar', data: { labels: labelsU, datasets: [{ label: 'Montant (DH)', data: dataU, backgroundColor: '#3b82f6' }] }, options: { responsive: true, plugins: { legend: { display: false } } } });

        var labelsC = Object.keys(byCat);
        var dataC = Object.values(byCat);
        new Chart(document.getElementById('chartByCat'), { type: 'doughnut', data: { labels: labelsC, datasets: [{ data: dataC, backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'] }] }, options: { responsive: true } });

        var labelsM = Object.keys(byMonth).sort();
        var dataM = labelsM.map(function (m) { return byMonth[m]; });
        new Chart(document.getElementById('chartByMonth'), { type: 'line', data: { labels: labelsM, datasets: [{ label: 'Montant (DH)', data: dataM, borderColor: '#10b981', tension: 0.3, fill: false }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
      } catch (e) { console.warn('[Analytics]', e); }
    }, 100);
  }

  function renderAudit() {
    if (!isAdminNow()) {
      if (typeof window.toast === 'function') window.toast('Accès réservé à l\'administrateur.', 'err');
      if (typeof window.switchTab === 'function') window.switchTab('all');
      return;
    }
    var container = document.getElementById('auditTrailContainer');
    if (!container) return;
    container.innerHTML = '<div class="l2a-filters"><input class="form-input" placeholder="Rechercher..." style="max-width:300px;"><div style="font-size:12px;color:var(--gray-500);">Journal d\'audit</div></div><div class="l2a-timeline"><div class="l2a-empty">Aucun événement récent</div></div>';
  }

  window.injectAnalyticsNav = injectAnalyticsNav;
  window.injectAnalyticsTab = injectAnalyticsTab;
  window.injectAuditNav = injectAuditNav;
  window.injectAuditTab = injectAuditTab;
  window.renderAnalytics = renderAnalytics;
  window.renderAudit = renderAudit;

  window.openTvaModal = openTvaModal;
  window.closeTvaModal = closeTvaModal;
  window.saveTvaChanges = saveTvaChanges;
  window.refreshTvaVisibility = refreshTvaVisibility;

  window.sendUnrefundedEmailReport = sendUnrefundedEmailReport;
  window.openWhatsAppNotification = openWhatsAppNotification;

  function bootLot2() {
    try {
      /* 1. TVA */
      injectTvaButton();
      injectTvaFilter();
      injectTvaSaisieField();
      injectTvaEditField();
      refreshTvaVisibility();

      /* 2. Workflow */
      injectWorkflowFilter();

      /* 3. Agent IA */
      injectAiAssistant();

      /* 4. Notifications */
      // Bouton Notifier Compta retiré

      /* 6. Analytics & Audit (admin seulement) */
      if (isAdminNow()) {
        injectAuditNav();
        injectAuditTab();
        injectAnalyticsNav();
        injectAnalyticsTab();
      }

      /* 6. Offline */
      injectNetworkStatusIndicator();
      openIndexedDb(function () { });

      /* Hooks et observation */
      initHooks();
      observeTbody();

      L2.modules.push('tva@v2', 'workflow@v1', 'ia@v1', 'notifs@v1', 'offline@v1');
      console.log('✅ [Lot 2] Les 5 fonctionnalités sont actives et prêtes.');
    } catch (e) {
      console.error('[Lot2] Erreur d\'initialisation', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootLot2);
  } else {
    bootLot2();
  }
})();
