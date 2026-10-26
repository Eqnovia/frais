// Test hors-navigateur de downloadGuidePDF() de guide.js
const fs = require('fs');

process.on('uncaughtException', (e) => { console.error('UNCAUGHT:', e); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error('REJECTION:', e); process.exit(1); });
global.alert = (m) => { console.error('ALERT APPELÉ (échec) : ' + m); process.exit(1); };

// Stubs DOM minimaux : initialisation du guide no-op, API exposée sur window
global.document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; } };
global.window = {};
(0, eval)(fs.readFileSync('../guide.js', 'utf8'));

// jsPDF + autoTable, mêmes versions que les CDN de index.html
const { jsPDF } = require('jspdf');
global.window.jspdf = { jsPDF };
global.jsPDF = jsPDF;
const jat = require('jspdf-autotable');
const autoTableRegistration = (function () {
  return function () {};
})();
if (typeof jat === 'function') {
  // API fonctionnelle de jspdf-autotable v3.8 : autoTable(doc, options)
  jsPDF.API.autoTable = function (options) { jat(this, options); };
}

if (typeof window.downloadGuidePDF !== 'function') {
  console.error('API manquante : downloadGuidePDF non exposée');
  process.exit(1);
}
['openGuideModal', 'closeGuideModal'].forEach(k => {
  if (typeof window[k] !== 'function') { console.error('API manquante : ' + k); process.exit(1); }
});

window.downloadGuidePDF();

const f = 'guide-utilisation-eqnovia.pdf';
if (!fs.existsSync(f)) { console.error('PDF non généré'); process.exit(1); }
const size = fs.statSync(f).size;
console.log('FONCTIONS OK : openGuideModal, closeGuideModal, downloadGuidePDF');
console.log('PDF GÉNÉRÉ : ' + f + ' (' + size + ' octets)');
