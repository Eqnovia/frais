# 📋 Eqnovia — Notes de Frais

[![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)](https://firebase.google.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/)
[![Tesseract](https://img.shields.io/badge/Tesseract.js-9B59B6?style=for-the-badge&logo=tesseract&logoColor=white)](https://tesseract.projectnaptha.com/)
[![jsPDF](https://img.shields.io/badge/jsPDF-E74C3C?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)](https://github.com/parallax/jsPDF)
[![SheetJS](https://img.shields.io/badge/SheetJS-217346?style=for-the-badge&logo=microsoftexcel&logoColor=white)](https://sheetjs.com/)

---

## 🚀 Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| ✏️ **Saisie manuelle** | Enregistrez vos dépenses avec date, montant HT/TTC, catégorie et description |
| 📸 **OCR automatique** | Importez une photo de facture — Tesseract.js extrait la date, le montant et la description |
| 📋 **Historique complet** | Consultez toutes vos dépenses, triables par date, montant ou catégorie |
| 📅 **Vue mensuelle** | Groupez vos dépenses par mois avec totaux et graphiques |
| 📆 **Vue annuelle** | Bilan annuel avec répartition mensuelle et par catégorie |
| 📄 **Export PDF** | Générez un document PDF officiel de vos notes de frais |
| 📊 **Export Excel** | Exportez vos données au format .xlsx pour Excel |
| 🔒 **Stockage sécurisé** | Données sauvegardées sur Firebase Firestore (ou localStorage en mode hors-ligne) |
| 👤 **Profil employé** | Informations personnalisées (nom, prénom, département) |

---

## 🏗️ Architecture

```
note-de-frais/
├── index.html          # Application SPA
├── firebase.json       # Configuration Firebase Hosting
├── DEPLOIEMENT.md      # Guide de déploiement
├── GUIDE_GITHUB_DEPLOIEMENT.md  # Guide GitHub Pages
└── README.md           # Ce fichier
```

---

## 🛡️ Sécurité

| Mesure | Description |
|--------|-------------|
| **CSP** | Content Security Policy pour restreindre les sources de scripts et styles |
| **XSS Protection** | Échappement HTML (`esc()`), sanitization des entrées (`sanitizeInput()`) |
| **X-Frame-Options** | Empêche le clickjacking (`DENY`) |
| **X-Content-Type-Options** | Empêche le sniffing MIME (`nosniff`) |
| **Referrer Policy** | Politique de référencement stricte |
| **Validation serveur** | Vérification des montants et dates |
| **Sanitization** | Suppression des caractères dangereux `< > " '` |

⚠️ **Note** : En mode Firebase, les règles de sécurité Firestore doivent être configurées côté serveur.

---

## 🎨 Design System

| Élément | Spécification |
|---------|---------------|
| **Couleurs principales** | Bleu Eqnovia `#0B4F9E`, Orange `#F7931E` |
| **Typographie** | Inter (300–800) |
| **Composants** | Panels, badges, modals, toasts, bar charts |
| **Responsive** | Adapté mobile, tablette et desktop |

---

## ⚡ Démarrage rapide

### Option 1 : Ouvrir localement
```bash
# 1. Clonez ou téléchargez le projet
# 2. Ouvrez index.html dans votre navigateur
# L'application fonctionne en mode local (localStorage) sans configuration
```

### Option 2 : Build avec variables d'environnement
```bash
# 1. Copiez le fichier .env.example vers .env
cp .env.example .env

# 2. Remplissez vos valeurs Firebase
# 3. Générez le build
node build.js

# 4. Le fichier dist/index.html contient votre configuration injectée
```

### Option 3 : Déployer en ligne
| Option | Base de données | URL publique | Complexité |
|--------|----------------|--------------|------------|
| **Firebase** | ✅ Firestore (temps réel) | ✅ `.web.app` | Moyenne |
| **Netlify** | ❌ localStorage | ✅ Instant | Très facile |
| **GitHub Pages** | ❌ localStorage | ✅ `.github.io` | Facile |

📖 Consultez [DEPLOIEMENT.md](DEPLOIEMENT.md) pour les instructions détaillées.

### Option 4 : Déployer sur GitHub Pages
1. Créez un dépôt GitHub (ex: `notes-de-frais`)
2. Poussez le code :
   ```bash
   git remote add origin https://github.com/VOTRE_USERNAME/notes-de-frais.git
   git branch -M main
   git push -u origin main
   ```
3. Activez GitHub Pages dans les paramètres du dépôt (source : branche `main`, dossier `/root`)
4. L'application sera accessible sur `https://VOTRE_USERNAME.github.io/notes-de-frais/`

### 📲 Installer l'application sur mobile (PWA)
L'application est une **Progressive Web App (PWA)**. Après déploiement :

- **Android** : Ouvrez Chrome → menu → **"Ajouter à l'écran d'accueil"**
- **iPhone** : Ouvrez Safari → bouton Partager → **"Ajouter à l'écran d'accueil"**

Un bouton **"📲 Installer l'app"** apparaît également dans la barre supérieure lorsque l'installation est disponible.

---

## 📜 Conditions d'utilisation

- Destinée exclusivement aux employés d'Eqnovia
- Toute dépense doit être justifiée par un justificatif valide
- Les montants saisis doivent être exacts
- L'utilisateur est responsable de l'exactitude des informations
- Les données sont conservées 10 ans (durée légale comptable)

📌 Consultez la section **Conditions & Politique** dans l'application pour plus de détails.

---

## 🤝 Contribution

1. **Forkez** le projet
2. **Créez** une branche (`git checkout -b feature/ma-fonctionnalite`)
3. **Committez** (`git commit -m "feat: ajout de..."`)
4. **Pushez** (`git push origin feature/ma-fonctionnalite`)
5. **Ouvrez** une Pull Request

---

## 📄 Licence

© 2025 **Eqnovia** — Tous droits réservés.

Ce projet est la propriété d'Eqnovia. Toute reproduction ou distribution sans autorisation est interdite.

---

## 📞 Contact

| | |
|---|---|
| **📧 Email** | fbourzgui@eqnovia.ma |
| **📍 Adresse** | Eqnovia, Casablanca, Maroc |
| **🔗 Version** | v3.0 · Firebase + Local |

---

<p align="center">
  <sub>Eqnovia · Gestion intelligente des notes de frais</sub>
</p>
