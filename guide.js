/* ═══════════════════════════════════════════════════════════════
   GUIDE D'UTILISATION — guide.js (100% additif)
   Chargé APRÈS app.js (defer). N'utilise aucune fonction existante,
   ne redéfinit aucun ID/classe/fonction de l'application.
   Expose : openGuideModal(), closeGuideModal(), downloadGuidePDF()
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var GUIDE_INTRO =
    'Bienvenue dans l\'application de gestion des frais Eqnovia. ' +
    'Ce guide explique, étape par étape, chaque fonctionnalité : saisie, OCR, ' +
    'remboursement, historique, exports, ordres de mission, sauvegarde et administration. ' +
    'Cliquez sur une section ci-dessous pour l\'ouvrir.';

  /* ─────────────────────────────────────────────────────────────
     CONTENU DU GUIDE (source unique : rendu HTML + PDF)
     ───────────────────────────────────────────────────────────── */
  var GUIDE_SECTIONS = [
    {
      icon: '🔐',
      title: 'Connexion',
      lead: 'La première étape est la connexion sécurisée à l\'application.',
      items: [
        'Choisissez votre nom dans la liste « Utilisateur » (Administrateur, employé ou Comptable).',
        'Saisissez votre mot de passe (fourni par l\'administrateur).',
        'Cliquez sur l\'icône 👁️ à droite du champ pour afficher ou masquer le mot de passe.',
        'Cliquez sur « Se connecter » (ou appuyez sur Entrée).',
        'En cas d\'oubli, contactez l\'administrateur pour obtenir une réinitialisation.',
        'En mode local (sans Firebase), la vérification du mot de passe se fait sur l\'appareil.',
        'Utilisez « Déconnexion » en bas de la sidebar pour fermer votre session.'
      ],
      tip: 'Si le badge en haut affiche « Firebase » vous êtes en ligne ; « Local » signifie que les données restent sur cet appareil.'
    },
    {
      icon: '✏️',
      title: 'Saisie manuelle d\'une dépense',
      lead: 'La page « Saisie & OCR » permet d\'enregistrer une note de frais en quelques champs.',
      items: [
        'Date de la dépense (le jour même est proposé par défaut).',
        'Catégorie : transport, hébergement, repas, etc.',
        'Montant TTC : saisissez le montant toutes taxes comprises.',
        'Description : un libellé court et clair (ex. « Taxi aéroport »).',
        'Objet mission : le motif du déplacement ou de la dépense.',
        'Commentaires : informations utiles au valideur ou au comptable.',
        'Justificatif : importez une photo ou un PDF. Plusieurs fichiers sont acceptés, chaque fichier doit peser 5 Mo maximum.',
        'Cliquez enfin sur « Ajouter la dépense » : elle apparaît immédiatement dans l\'historique.'
      ],
      tip: 'Vérifiez toujours que le montant et la date correspondent exactement au justificatif importé.'
    },
    {
      icon: '📸',
      title: 'OCR — Lecture automatique d\'un justificatif',
      lead: 'L\'OCR lit une image ou un PDF et pré-remplit le formulaire à votre place.',
      items: [
        'Importez l\'image ou le PDF de la facture (photo nette, bien cadrée, sans reflet).',
        'Cliquez sur « Lire et extraire » : le texte est extrait automatiquement.',
        'Consultez l\'aperçu du texte reconnu pour contrôler la lecture.',
        'Cliquez sur « Remplir le formulaire » : montant, date, catégorie sont pré-remplis.',
        'Vérifiez chaque champ, corrigez si besoin, ajoutez le justificatif puis « Ajouter la dépense ».'
      ],
      tip: 'L\'OCR est un aide, pas un garant : une relecture visuelle de 10 secondes évite 90 % des erreurs.'
    },
    {
      icon: '💰',
      title: 'Remboursement',
      lead: 'Cette page suit l\'avancement des remboursements de toute l\'équipe.',
      items: [
        'Filtrez avec « Tous / Remboursés / Non remboursés » pour cibler l\'affichage.',
        'Filtrez également par personne pour ne voir que les frais d\'un collaborateur.',
        'Cochez « Remboursé » sur une ligne dès que le paiement est effectué.',
        'Un récapitulatif en haut de page affiche les montants dus et remboursés.',
        'La pastille « ! » sur le menu indique qu\'un remboursement est en attente.'
      ],
      tip: 'Seuls l\'administrateur et le comptable peuvent marquer une dépense comme remboursée.'
    },
    {
      icon: '📋',
      title: 'Historique des dépenses',
      lead: 'Toutes les dépenses enregistrées, vues sous plusieurs angles.',
      items: [
        'Onglets : « Toutes », « Par mois », « Par année », « Par trimestre » et « Comparaison ».',
        'Filtres disponibles : année, mois, catégorie, utilisateur, statut de remboursement et recherche libre.',
        'Cliquez sur un en-tête de colonne (date, montant…) pour trier ascendant / descendant.',
        'Chaque vue affiche ses totaux par groupe (mois, trimestre, catégorie).',
        'L\'onglet « Comparaison » confronte les périodes entre elles pour suivre les tendances.'
      ],
      tip: 'Les filtres se combinent : année + catégorie + utilisateur donne un rapport ultra-précis.'
    },
    {
      icon: '📤',
      title: 'Exports PDF et Excel',
      lead: 'Exportez vos données pour la comptabilité ou la hiérarchie.',
      items: [
        'PDF : génère un rapport mis en forme (jsPDF), colonnes triées et totaux inclus.',
        'Excel : génère un classeur (.xlsx via SheetJS) au format tabulaire pour tout traitement comptable.',
        'Lancez un export depuis les boutons de chaque page ou depuis « Exports » dans la sidebar.',
        'L\'export reflète les filtres active à ce moment : pensez à filtrer avant d\'exporter.'
      ],
      tip: 'Côté comptable, exportez en Excel pour un rapprochement bancaire rapide.'
    },
    {
      icon: '📝',
      title: 'Ordre de mission',
      lead: 'Créez et éditez une fiche officielle d\'ordre de mission (OM).',
      items: [
        'Remplissez le formulaire : numéro d\'OM, dates du début et de fin, collaborateur.',
        'Indiquez les lieux (départ, destination), le(s) moyen(s) de transport.',
        'Ajoutez le numéro de téléphone WhatsApp et les remarques éventuelles.',
        'Cliquez sur « Générer la fiche » puis « Imprimer / PDF » pour produire le document.',
        'L\'historique des ordres de mission créés figure en bas de la page.'
      ],
      tip: 'Un OM doit être généré avant le départ : il sert de justificatif pour les frais de la mission.'
    },
    {
      icon: '📋',
      title: 'Mes OM',
      lead: 'Chaque employé consulte les ordres de mission qui lui sont assignés.',
      items: [
        'L\'entrée « Mes OM » (Firebase) apparaît dans la barre de navigation quand des OM vous sont assignés.',
        'Vous consultez le détail, le statut et les dates de chacun de vos ordres de mission.',
        'Ces OM sont centralisés dans Firebase : ils sont identiques sur tous vos appareils.'
      ],
      tip: 'Aucune action n\'est requise si vous n\'avez pas d\'ordre de mission en cours.'
    },
    {
      icon: '💾',
      title: 'Sauvegarde des justificatifs (Backup)',
      lead: 'Vos justificatifs sont précieux : pensez à les sauvegarder.',
      items: [
        'Mode local : un bouton « Sauvegarder tous » crée une archive ZIP (JSZip) téléchargeable contenant tous les justificatifs.',
        'Mode Firebase : les justificatifs sont envoyés dans Firebase Storage, avec leur date et leur propriétaire.',
        'La page « Backup » est réservée à l\'administrateur.',
        'Conservez l\'archive ZIP sur un emplacement sûr (serveur, disque, cloud d\'entreprise).'
      ],
      tip: 'Réalisez la sauvegarde après chaque grosse vague de saisies (fin de mois).'
    },
    {
      icon: '👥',
      title: 'Utilisateurs (Administrateur)',
      lead: 'Gérez les comptes de l\'équipe depuis la section « Utilisateurs ».',
      items: [
        'Ajoutez un utilisateur : nom, mot de passe, rôle (employé, comptable, administrateur).',
        'La liste existante affiche chaque compte, ce qui permet de suivre qui a accès à quoi.',
        'En mode Firebase, le compte est également créé côté authentification.',
        'Les nouvelles personnes se connectent ensuite comme les autres (section 🔐 Connexion).'
      ],
      tip: 'Choisissez le rôle le plus restreint possible : les jours de contrôle du comptable et d\'admin sont distincts.'
    },
    {
      icon: '🏢',
      title: 'OM Global (Administrateur)',
      lead: 'Vue de direction de tous les ordres de mission de l\'entreprise.',
      items: [
        'La page « OM Global » liste tous les ordres de mission, quel que soit le collaborateur.',
        'Filtrez par année, mois, collaborateur ou statut.',
        'Exportez la liste en PDF ou en Excel reportez pour les réunions de pilotage.',
        'Vous pouvez consulter le détail de chaque OM depuis cette vue.'
      ],
      tip: 'Les OM visibles ici ne sont pas modifiables depuis cette vue ; passez par la page Ordre de mission.'
    },
    {
      icon: '📜',
      title: 'Conditions & politique',
      lead: 'Le cadre juridique avait toute son importance.',
      items: [
        'La section « Conditions » rassemble les CGU et la politique de confidentialité.',
        'Vous y trouvez le périmètre d\'usage, les responsabilités et les règles de conservation des données.',
        'En cas de doute, c\'est la référence à consulter avant toute utilisation hors du cadre prévu.'
      ],
      tip: 'Toute donnée saisie peut être consultée aux fins de contrôle interne : restez factuel et conforme.'
    },
    {
      icon: '📱',
      title: 'Mobile / PWA',
      lead: 'L\'application s\'installe sur mobile comme une vraie app.',
      items: [
        'Sur Chrome mobile : menu ⋮ puis « Installer l\'application » (ou bouton « Installer » proposé par le navigateur).',
        'Sur iOS : « Partager » puis « Sur l\'écran d\'accueil ».',
        'Une fois installée, l\'app s\'ouvre plein écran avec votre icône Eqnovia.',
        'Mode hors-ligne : le service worker conserve l\'application ; la saisie locale reste possible suivant le mode utilisé.',
        'Les notifications signalent notamment les rappels de remboursement et les évolutions des OM.'
      ],
      tip: 'L\'installation évite de retaper l\'adresse et accélère le lancement au quotidien.'
    },
    {
      icon: '❓',
      title: 'FAQ rapide',
      isFaq: true,
      faq: [
        { q: 'Où retrouver mes frais ?', a: 'Dans la sidebar, ouvrez « Historique » puis onglet « Toutes » ; utilisez le filtre utilisateur pour ne voir que les vôtres.' },
        { q: 'Comment scanner une facture ?', a: 'Page « Saisie & OCR » : importez la photo ou le PDF, cliquez « Lire et extraire », contrôlez le texte, puis « Remplir le formulaire ».' },
        { q: 'Pourquoi mon justificatif ne s\'ajoute pas ?', a: 'Vérifiez que le fichier fait moins de 5 Mo et que le format est accepté (image ou PDF). Recommencez l\'import si l\'aperçu est vide.' },
        { q: 'Comment savoir si je suis remboursé ?', a: 'Ouvrez « Remboursement », filtrez l\'affichage sur vos frais ; les lignes cochées « Remboursé » sont payées.' },
        { q: 'Je perds mon mot de passe, que faire ?', a: 'Contactez l\'administrateur pour une réinitialisation ; vous recevrez un nouveau mot de passe temporaire.' },
        { q: 'L\'application fonctionne-t-elle sans Internet ?', a: 'Oui en mode local l\'essentiel est conservé sur l\'appareil ; les données se synchronisent avec Firebase dès le retour de connexion.' },
        { q: 'Comment installer l\'application sur mon téléphone ?', a: 'Ouvrez le menu du navigateur puis « Installer l\'application » (Android/Chrome) ou « Sur l\'écran d\'accueil » (iOS/Safari).' },
        { q: 'Qui peut voir mes frais ?', a: 'L\'administrateur et le comptable accèdent à l\'ensemble des frais de l\'équipe pour le contrôle et le remboursement.' }
      ]
    }
  ];

  /* ─────────────────────────────────────────────────────────────
     RENDU HTML DE L'ACCORDÉON
     ───────────────────────────────────────────────────────────── */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderGuideContent() {
    var body = document.getElementById('guideBody');
    if (!body) return;

    var html = '<div class="guide-intro">' +
      '<span class="guide-intro-icon">📘</span><span>' + escapeHtml(GUIDE_INTRO) + '</span></div>' +
      '<div class="guide-accordion">';

    for (var i = 0; i < GUIDE_SECTIONS.length; i++) {
      var s = GUIDE_SECTIONS[i];
      var b = '<details class="guide-section"' + (i === 0 ? ' open' : '') + '>' +
        '<summary>' +
        '<span class="guide-sec-icon" aria-hidden="true">' + s.icon + '</span>' +
        '<span class="guide-sec-title">' + escapeHtml(s.title) + '</span>' +
        '<span class="guide-chevron" aria-hidden="true">▼</span>' +
        '</summary>' +
        '<div class="guide-sec-body">';

      if (s.isFaq) {
        b += '<ul>';
        for (var f = 0; f < s.faq.length; f++) {
          b += '<li><span class="guide-faq-q">' + escapeHtml(s.faq[f].q) + '</span> — ' + escapeHtml(s.faq[f].a) + '</li>';
        }
        b += '</ul>';
      } else {
        if (s.lead) b += '<p class="guide-lead">' + escapeHtml(s.lead) + '</p>';
        b += '<ul>';
        for (var j = 0; j < s.items.length; j++) b += '<li>' + escapeHtml(s.items[j]) + '</li>';
        b += '</ul>';
      }
      if (s.tip) b += '<div class="guide-tip"><span aria-hidden="true">💡</span><span>' + escapeHtml(s.tip) + '</span></div>';

      b += '</div></details>';
      html += b;
    }
    html += '</div>';
    body.innerHTML = html;
  }

  /* ─────────────────────────────────────────────────────────────
     OUVERTURE / FERMETURE DE LA MODAL
     ───────────────────────────────────────────────────────────── */
  function openGuideModal() {
    var m = document.getElementById('guideModal');
    if (!m) return;
    if (!m.dataset.rendered) {
      renderGuideContent();
      m.dataset.rendered = '1';
    }
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    var closeBtn = document.getElementById('guideCloseBtn');
    if (closeBtn) closeBtn.focus();
  }

  function closeGuideModal() {
    var m = document.getElementById('guideModal');
    if (!m) return;
    m.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* Clic sur l'overlay (hors de la modale) pour fermer */
  function bindGuideOverlayClick() {
    var m = document.getElementById('guideModal');
    if (!m || m.dataset.overlayBound) return;
    m.dataset.overlayBound = '1';
    m.addEventListener('click', function (e) {
      if (e.target === m) closeGuideModal();
    });
  }

  /* ─────────────────────────────────────────────────────────────
     PDF DU GUIDE (jsPDF + autoTable déjà chargés dans index.html)
     ───────────────────────────────────────────────────────────── */
  function downloadGuidePDF() {
    try {
      var jsPdf = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null;
      if (!jsPdf) {
        alert('La librairie PDF n\'est pas encore chargée. Réessayez dans un instant.');
        return;
      }
      var doc = new jsPdf({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      var pageW = doc.internal.pageSize.getWidth();
      var pageH = doc.internal.pageSize.getHeight();
      var M = { left: 48, right: 48, top: 56, bottom: 56 };
      var contentW = pageW - M.left - M.right;
      var y = M.top;

      /* Les émojis ne sont pas rendus par les polices standard jsPDF :
         on les retire du flux PDF (ils restent dans le HTML). */
      function stripEmoji(s) {
        return String(s).replace(/[^\u0000-\u00FF\u0152\u0153\u2013\u2018-\u2019\u201C-\u201D\u2022]/g, '').replace(/\s{2,}/g, ' ').trim();
      }

      function ensureSpace(needed) {
        if (y + needed > pageH - M.bottom) { doc.addPage(); y = M.top; }
      }

      /* ── Bandeau d'en-tête (1re page) ── */
      doc.setFillColor(11, 79, 158);
      doc.rect(0, 0, pageW, 78, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(21);
      doc.setTextColor(255, 255, 255);
      doc.text("GUIDE D'UTILISATION", M.left, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(203, 222, 255);
      doc.text('Application de gestion des notes de frais — Eqnovia', M.left, 60);
      var d = new Date();
      var dateStr = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Édition du ' + dateStr, pageW - M.right, 92, { align: 'right' });
      y = 110;

      /* Intro */
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      var introLines = doc.splitTextToSize(stripEmoji(GUIDE_INTRO), contentW);
      ensureSpace(introLines.length * 12 + 10);
      doc.text(introLines, M.left, y);
      y += introLines.length * 12 + 12;

      /* Sections : titres numérotés + barre d'accent bleue */
      for (var i = 0; i < GUIDE_SECTIONS.length; i++) {
        var s = GUIDE_SECTIONS[i];
        var num = ('0' + (i + 1)).slice(-2);
        var titleTxt = num + '  ' + stripEmoji(s.title);

        ensureSpace(70);

        /* Barre d'accent + titre */
        doc.setFillColor(11, 79, 158);
        doc.rect(M.left, y - 11, 3, 15, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12.5);
        doc.setTextColor(15, 23, 42);
        doc.text(titleTxt, M.left + 11, y + 1);
        /* Filet discret sous le titre */
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.6);
        doc.line(M.left, y + 9, pageW - M.right, y + 9);
        y += 22;

        if (s.isFaq) {
          var faqRows = [];
          for (var fa = 0; fa < s.faq.length; fa++) faqRows.push([stripEmoji(s.faq[fa].q), stripEmoji(s.faq[fa].a)]);
          if (typeof doc.autoTable === 'function') {
            doc.autoTable({
              head: [['Question', 'Réponse']],
              body: faqRows,
              startY: y,
              margin: { left: M.left, right: M.right, top: 90 },
              styles: { fontSize: 9, cellPadding: { top: 5, right: 6, bottom: 5, left: 6 }, font: 'helvetica', cellHeight: 12, lineHeight: 1.25 },
              headStyles: { fillColor: [11, 79, 158], textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
              alternateRowStyles: { fillColor: [246, 249, 253] },
              columnStyles: { 0: { cellWidth: 170, fontStyle: 'bold', textColor: [11, 79, 158] }, 1: { cellWidth: contentW - 170, textColor: [51, 65, 85] } },
              theme: 'grid',
              tableLineColor: [226, 232, 240],
              tableLineWidth: 0.5
            });
            y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 18;
          } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(11, 79, 158);
            for (var f2 = 0; f2 < s.faq.length; f2++) {
              var qLines = doc.splitTextToSize(stripEmoji(s.faq[f2].q) + ' :', contentW - 12);
              ensureSpace(qLines.length * 12 + 4);
              doc.text(qLines, M.left + 12, y);
              y += qLines.length * 12 + 1;
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(71, 85, 105);
              var aLines = doc.splitTextToSize(stripEmoji(s.faq[f2].a), contentW - 12);
              ensureSpace(aLines.length * 12 + 4);
              doc.text(aLines, M.left + 12, y);
              y += aLines.length * 12 + 5;
              doc.setTextColor(11, 79, 158);
            }
            y += 6;
          }
          continue;
        }

        if (s.lead) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9.5);
          doc.setTextColor(100, 116, 139);
          var leadLines = doc.splitTextToSize(stripEmoji(s.lead), contentW);
          ensureSpace(leadLines.length * 12 + 4);
          doc.text(leadLines, M.left, y);
          y += leadLines.length * 12 + 7;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        for (var k = 0; k < s.items.length; k++) {
          var lines = doc.splitTextToSize(stripEmoji(s.items[k]), contentW - 20);
          ensureSpace(lines.length * 12);
          var firstBase = y;
          /* Puce bleue alignée sur la 1re ligne */
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(11, 79, 158);
          doc.text('•', M.left + 6, firstBase);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
          for (var li = 0; li < lines.length; li++) {
            doc.text(lines[li], M.left + 20, firstBase + li * 12);
          }
          y = firstBase + lines.length * 12 + 3;
        }
        y += 2;

        if (s.tip) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          var tipLines = doc.splitTextToSize('Astuce : ' + stripEmoji(s.tip), contentW - 28);
          var tipH = tipLines.length * 11.5 + 13;
          ensureSpace(tipH + 8);
          doc.setFillColor(255, 249, 231);
          doc.setDrawColor(240, 220, 165);
          doc.setLineWidth(0.7);
          doc.roundedRect(M.left + 8, y, contentW - 8, tipH, 5, 5, 'FD');
          doc.setTextColor(146, 106, 10);
          for (var ti = 0; ti < tipLines.length; ti++) {
            doc.text(tipLines[ti], M.left + 22, y + 16 + ti * 11.5);
          }
          y += tipH + 10;
        }
        y += 12;
      }

      /* Pied de page « Eqnovia » sur toutes les pages */
      var total = doc.getNumberOfPages();
      for (var p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.6);
        doc.line(M.left, pageH - 34, pageW - M.right, pageH - 34);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("Eqnovia — Guide d'utilisation de l'application de frais", M.left, pageH - 22);
        var label = 'Page ' + p + ' / ' + total;
        doc.text(label, pageW - M.right, pageH - 22, { align: 'right' });
      }

      doc.save('guide-utilisation-eqnovia.pdf');
    } catch (err) {
      console.warn('downloadGuidePDF : échec de génération du PDF.', err);
      alert('Impossible de générer le PDF du guide pour le moment. Détails : ' + (err && err.message ? err.message : err));
    }
  }

  /* ─────────────────────────────────────────────────────────────
     BOUTON FLOTTANT "?" (mobile uniquement, créé par guide.js)
     ───────────────────────────────────────────────────────────── */
  function createGuideFab() {
    if (document.getElementById('guideFab')) return;
    var fab = document.createElement('button');
    fab.id = 'guideFab';
    fab.type = 'button';
    fab.className = 'guide-fab';
    fab.textContent = '?';
    fab.setAttribute('aria-label', 'Ouvrir le guide d\'utilisation');
    fab.setAttribute('title', "Guide d'utilisation");
    fab.addEventListener('click', openGuideModal);
    document.body.appendChild(fab);
  }

  /* ─────────────────────────────────────────────────────────────
     RACCOURCI CLAVIER « ? »  + Échap pour fermer
     ───────────────────────────────────────────────────────────── */
  function isTypingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      var guideOpen = document.getElementById('guideModal');
      var isOpen = !!(guideOpen && guideOpen.classList.contains('open'));

      if (e.key === 'Escape' && isOpen) {
        closeGuideModal();
        return;
      }
      if (e.key === '?' && !isTypingTarget(e.target) && !isOpen) {
        e.preventDefault();
        openGuideModal();
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     INITIALISATION (script defer : le DOM est prêt, app.js est chargé)
     ───────────────────────────────────────────────────────────── */
  function initGuide() {
    try {
      bindGuideOverlayClick();
      createGuideFab();
      bindKeyboardShortcuts();
    } catch (e) {
      console.warn('guide.js : initialisation inachevée.', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGuide);
  } else {
    initGuide();
  }

  /* API publique (utilisée par les onclick inline de index.html) */
  window.openGuideModal = openGuideModal;
  window.closeGuideModal = closeGuideModal;
  window.downloadGuidePDF = downloadGuidePDF;
})();
