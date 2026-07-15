# 📋 Eqnovia — Notes de Frais
## Documentation Complète du Projet

---

## 📌 Table des matières

1. [Présentation générale](#présentation-générale)
2. [Objectifs du projet](#objectifs-du-projet)
3. [Services proposés](#services-proposés)
4. [Cas d'usage (Use Cases)](#cas-dusage-use-cases)
5. [Architecture technique](#architecture-technique)
6. [Sécurité](#sécurité)
7. [Design System & Style](#design-system--style)
8. [Guide d'utilisation](#guide-dutilisation)
9. [Déploiement](#déploiement)
10. [Maintenance & Évolution](#maintenance--évolution)

---

## 🎯 Présentation générale

**Eqnovia — Notes de Frais** est une application web progressive (PWA) de gestion des notes de frais professionnels. Elle permet aux employés de saisir, consulter, filtrer et exporter leurs dépenses professionnelles de manière simple, rapide et sécurisée.

### Informations clés

| Élément | Valeur |
|---------|--------|
| **Nom** | Eqnovia — Notes de Frais |
| **Version** | v3.0 |
| **Type** | Application SPA (Single Page Application) |
| **Plateforme** | Web + PWA (mobile & desktop) |
| **Base de données** | Firebase Firestore (cloud) + localStorage (local) |
| **Langage** | JavaScript vanilla (ES6+) |
| **Frontend** | HTML5 + CSS3 + Tailwind CSS |
| **OCR** | Tesseract.js |
| **Exports** | jsPDF (PDF) + SheetJS (Excel) |
| **Hébergement** | Firebase Hosting / Netlify / GitHub Pages |

---

## 🎯 Objectifs du projet

### Objectif principal
Digitaliser et centraliser la gestion des notes de frais des employés d'Eqnovia, en remplaçant les processus manuels (papier, Excel dispersé) par une application unifiée, sécurisée et accessible.

### Objectifs spécifiques

1. **Saisie simplifiée** : Permettre aux employés d'enregistrer leurs dépenses en quelques clics
2. **Extraction automatique** : Utiliser l'OCR pour extraire les données depuis les factures/scans
3. **Traçabilité** : Conserver un historique complet et daté de toutes les dépenses
4. **Reporting** : Générer des bilans mensuels et annuels avec visualisations
5. **Export** : Produire des documents PDF et Excel conformes pour la comptabilité
6. **Multi-utilisateurs** : Gérer les accès par profil (employé / administrateur)
7. **Accessibilité** : Fonctionner en mode hors-ligne et sur mobile (PWA)
8. **Sécurité** : Protéger les données sensibles et respecter les normes comptables

---

## 🛎️ Services proposés

### 1. ✏️ Saisie manuelle de dépenses
- Formulaire complet : date, catégorie, montant TTC, description, mission, commentaires
- Catégories prédéfinies : Transport, Repas, Hébergement, Matériel, Communication, Formation, Autre
- Validation en temps réel des champs (date, montant)
- Ajout de justificatifs (images)

### 2. 📸 Reconnaissance OCR (Optical Character Recognition)
- Import de photos de factures/reçus
- Extraction automatique via Tesseract.js :
  - Date de la dépense
  - Montant TTC
  - Description
- Remplissage automatique du formulaire
- Support du français

### 3. 📋 Historique des dépenses
- Vue tabulaire complète de toutes les dépenses
- Tri par date ou par montant
- Filtres multiples :
  - Par année
  - Par mois
  - Par catégorie
  - Par utilisateur
  - Recherche textuelle
- Actions par ligne : modification, suppression, visualisation du justificatif

### 4. 📅 Vue mensuelle
- Groupement des dépenses par mois
- Totaux par période
- Graphique de répartition mensuelle
- Détail par dépense avec actions

### 5. 📆 Vue annuelle
- Bilan annuel consolidé
- Graphique de répartition mensuelle (bar chart)
- Répartition par catégorie
- Statistiques : total, nombre de dépenses, moyenne

### 6. 📄 Export PDF
- Document officiel avec en-tête Eqnovia
- Format paysage A4
- Tableau auto-généré avec toutes les colonnes
- Pied de page avec total
- Téléchargement automatique

### 7. 📊 Export Excel
- Fichier .xlsx compatible Microsoft Excel
- En-têtes formatés
- Largeurs de colonnes optimisées
- Ligne de total automatique

### 8. 👥 Gestion multi-utilisateurs
- Authentification par utilisateur/mot de passe
- Rôles : Administrateur et Employé
- Changement de session (admin uniquement)
- Ajout/modification/suppression d'utilisateurs par l'admin
- Isolation des données par utilisateur

### 9. 💾 Stockage double
- **Cloud** : Firebase Firestore (synchronisation temps réel)
- **Local** : localStorage (mode hors-ligne)
- Bascule automatique selon la disponibilité

### 10. 📲 PWA (Progressive Web App)
- Installation sur écran d'accueil (mobile & desktop)
- Fonctionnement hors-ligne
- Notification d'installation
- Expérience native

---

## 👤 Cas d'usage (Use Cases)

### UC-01 : Saisie d'une dépense (Employé)
**Acteur** : Employé (ex: Rachid, Soufiane, Ibrahime, Hamza)

**Préconditions** :
- L'employé est connecté
- La date est dans le passé (max 10 ans)

**Flux nominal** :
1. L'employé se connecte avec ses identifiants
2. Il accède à l'onglet "Saisie & OCR"
3. Il remplit le formulaire (date, catégorie, montant, description, mission)
4. Il peut ajouter un justificatif (photo)
5. Il clique sur "Ajouter la dépense"
6. Le système valide et enregistre
7. Un message de confirmation s'affiche
8. Les KPIs sont mis à jour

**Flux alternatif** :
- OCR : L'employé importe une photo → l'OCR extrait les données → le formulaire se remplit automatiquement

---

### UC-02 : Consultation de l'historique (Employé)
**Acteur** : Employé

**Flux nominal** :
1. L'employé accède à l'onglet "Toutes"
2. Il voit toutes SES dépenses (pas celles des autres)
3. Il peut filtrer par période, catégorie, recherche
4. Il peut trier par date ou montant
5. Il peut modifier ou supprimer ses propres dépenses

---

### UC-03 : Consultation globale (Administrateur)
**Acteur** : Administrateur

**Flux nominal** :
1. L'admin se connecte
2. Il accède à "Toutes" et voit TOUTES les dépenses de tous les utilisateurs
3. Il peut filtrer par utilisateur spécifique
4. Il peut modifier/supprimer toute dépense
5. Il peut changer de session pour se connecter en tant qu'autre utilisateur

---

### UC-04 : Export de notes de frais (Employé/Admin)
**Acteur** : Employé ou Administrateur

**Flux nominal** :
1. L'utilisateur applique les filtres souhaités
2. Il clique sur "PDF" ou "Excel"
3. Le fichier est généré et téléchargé
4. Le document contient les données filtrées

---

### UC-05 : Gestion des utilisateurs (Administrateur)
**Acteur** : Administrateur

**Flux nominal** :
1. L'admin clique sur "Utilisateurs" dans la section Gestion
2. La modale s'ouvre avec la liste des utilisateurs
3. L'admin peut :
   - **Ajouter** : saisir nom, mot de passe, rôle → cliquer sur "Ajouter"
   - **Modifier** : cliquer sur ✏️ → modifier le nom et/ou mot de passe
   - **Supprimer** : cliquer sur ✕ → confirmer la suppression
4. Les listes déroulantes sont mises à jour automatiquement

---

### UC-06 : Consultation des KPIs (Employé/Admin)
**Acteur** : Employé ou Administrateur

**Flux nominal** :
1. L'utilisateur consulte le tableau de bord
2. Il voit :
   - Total des dépenses
   - Nombre de dépenses
   - Total du mois en cours
3. Les données sont filtrées selon son profil

---

## 🏗️ Architecture technique

### Structure du projet

```
frais/
├── index.html          # Application SPA complète (HTML + CSS + JS)
├── firebase.json       # Configuration Firebase Hosting
├── build.js            # Script de build avec injection de variables d'env
├── .env.example        # Template des variables d'environnement
├── .gitignore          # Fichiers ignorés par Git
├── package.json        # Dépendances et scripts npm
├── sw.js               # Service Worker pour PWA
├── manifest.json       # Manifeste PWA
├── capacitor.config.json # Configuration Capacitor (mobile)
├── icon-192.png        # Icône PWA 192x192
├── icon-512.png        # Icône PWA 512x512
├── image.png           # Logo Eqnovia
└── README.md           # Documentation utilisateur
```

### Architecture applicative

```
┌─────────────────────────────────────────────┐
│                  NAVIGATEUR                  │
├─────────────────────────────────────────────┤
│  ┌─────────────┐    ┌───────────────────┐  │
│  │   LOGIN     │───▶│   APP PRINCIPALE  │  │
│  │   OVERLAY   │    │                   │  │
│  └─────────────┘    │  ┌─────────────┐  │  │
│                     │  │   SIDEBAR   │  │  │
│                     │  │ - Navigation│  │  │
│                     │  │ - User sel. │  │  │
│                     │  │ - Logout    │  │  │
│                     │  └─────────────┘  │  │
│                     │                   │  │
│                     │  ┌─────────────┐  │  │
│                     │  │   CONTENT   │  │  │
│                     │  │ - Saisie    │  │  │
│                     │  │ - Historique│  │  │
│                     │  │ - Stats     │  │  │
│                     │  │ - Exports   │  │  │
│                     │  └─────────────┘  │  │
│                     └───────────────────┘  │
└─────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────┐  ┌──────────────────┐
│   Firebase      │  │   localStorage   │
│   Firestore     │  │   (fallback)     │
│   (cloud)       │  │                  │
└─────────────────┘  └──────────────────┘
```

### Flux de données

```
Utilisateur → Formulaire → Validation → Data Layer
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              localStorage          Firebase Firestore      Cache mémoire
              (sauvegarde           (synchronisation        (lecture
               locale)               temps réel)             rapide)
```

### Modèle de données

#### Utilisateur (USERS)
```javascript
{
  userId: string,        // Clé unique (ex: "user1", "user5")
  password: string,      // Mot de passe (hashé en production)
  label: string,         // Nom complet affiché
  isAdmin: boolean       // Rôle : true = admin, false = employé
}
```

#### Dépense (Expense)
```javascript
{
  id: number,            // Identifiant unique (timestamp)
  date: string,          // Format ISO : YYYY-MM-DD
  desc: string,          // Description
  amount: number,        // Montant TTC en DH
  cat: string,           // Catégorie
  mission: string,       // Objet de la mission
  comment: string,       // Commentaires
  user: string,          // Référence à l'utilisateur
  justif: string,        // "Oui" ou "Non"
  justifData: string,    // Base64 de l'image justificatif
  justifName: string     // Nom du fichier justificatif
}
```

---

## 🔒 Sécurité

### 1. Authentification

| Aspect | Implémentation |
|--------|----------------|
| **Méthode** | Authentification par mot de passe (côté client) |
| **Rôles** | Admin / Employé |
| **Isolation** | Les employés ne voient que leurs propres dépenses |
| **Contrôle d'accès** | L'admin peut changer d'utilisateur, les employés non |

### 2. Protection des headers HTTP

| Header | Valeur | Protection |
|--------|--------|------------|
| `Content-Security-Policy` | `default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://www.gstatic.com; ...` | Restreint les sources de scripts, styles, images, connexions |
| `X-Frame-Options` | `DENY` | Empêche le clickjacking |
| `X-Content-Type-Options` | `nosniff` | Empêche le sniffing MIME |
| `X-XSS-Protection` | `1; mode=block` | Active la protection XSS du navigateur |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limite les informations de référent |

### 3. Sanitization des entrées

```javascript
// Échappement HTML pour prévenir les XSS
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&')
    .replace(/</g,'<')
    .replace(/>/g,'>')
    .replace(/"/g,'"')
    .replace(/'/g,''');
}

// Suppression des caractères dangereux
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>\"']/g, '').trim();
}
```

### 4. Validation des données

| Champ | Validation |
|-------|-----------|
| **Date** | Doit être dans le passé, max 10 ans en arrière |
| **Montant** | 0 < montant <= 10 000 000 DH |
| **Mot de passe** | Min 4 caractères (côté admin) |
| **Nom** | Sanitized, non vide |

### 5. Gestion des droits

| Action | Employé | Administrateur |
|--------|---------|----------------|
| Voir ses propres dépenses | ✅ | ✅ |
| Voir toutes les dépenses | ❌ | ✅ |
| Modifier ses propres dépenses | ✅ | ✅ |
| Modifier les dépenses des autres | ❌ | ✅ |
| Supprimer ses propres dépenses | ❌ | ✅ |
| Supprimer toutes les dépenses | ❌ | ✅ |
| Changer d'utilisateur | ❌ | ✅ |
| Gérer les utilisateurs | ❌ | ✅ |
| Exporter PDF/Excel | ✅ | ✅ |

### 6. Stockage sécurisé

- **localStorage** : Données chiffrées en base64 pour les justificatifs
- **Firebase Firestore** : Règles de sécurité à configurer côté serveur
- **Isolation** : Les données sont filtrées par `currentUser` avant affichage

### 7. Limitations & Recommandations

| Point | Recommandation |
|-------|----------------|
| **Mots de passe** | Pour une production, implémenter un hash (bcrypt) côté serveur |
| **Firebase Rules** | Configurer les règles Firestore pour restreindre l'accès par utilisateur |
| **HTTPS** | Toujours déployer en HTTPS (Firebase Hosting le fait automatiquement) |
| **Session** | Implémenter une expiration de session (actuellement persistante) |
| **Audit** | Ajouter un log des actions sensibles (modification, suppression) |

---

## 🎨 Design System & Style

### Charte graphique Eqnovia

#### Couleurs

| Couleur | Code | Usage |
|---------|------|-------|
| **Bleu Eqnovia** | `#0B4F9E` | Couleur principale, headers, boutons primaires |
| **Bleu clair** | `#1a6bbf` | Hover, états actifs |
| **Bleu pâle** | `#EBF3FB` | Fonds, badges admin |
| **Bleu moyen** | `#C8DFF5` | Bordures, séparateurs |
| **Orange Eqnovia** | `#F7931E` | Couleur secondaire, accents, logo |
| **Orange pâle** | `#FEF3E8` | Fonds d'alertes, badges |
| **Blanc** | `#FFFFFF` | Fonds principaux |
| **Gris 50** | `#F7F8FA` | Fonds alternatifs |
| **Gris 100** | `#EFF1F5` | Bordures légères |
| **Gris 200** | `#DDE1EA` | Bordures, séparateurs |
| **Gris 300** | `#BEC5D2` | Bordures, textes secondaires |
| **Gris 400** | `#8E97A8` | Placeholders, textes désactivés |
| **Gris 500** | `#636E82` | Labels, textes secondaires |
| **Gris 700** | `#353D4F` | Textes importants |
| **Gris 900** | `#1A2130` | Titres, textes principaux |
| **Vert** | `#18A76A` | Succès, validations |
| **Vert pâle** | `#E6F7F1` | Fonds de succès |
| **Rouge** | `#E03B3B` | Erreurs, suppressions, alertes |
| **Rouge pâle** | `#FDEAEA` | Fonds d'erreur |

#### Typographie

| Élément | Spécification |
|---------|---------------|
| **Police** | Inter (Google Fonts) |
| **Weights** | 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold) |
| **Base** | 14px |
| **Échelle** | 11px (labels), 12px (petits textes), 13px (corps), 14px (standard), 16px (sous-titres), 18px (titres), 24px+ (grands titres) |

#### Composants UI

| Composant | Description |
|-----------|-------------|
| **Panel** | Conteneur principal avec ombre légère et bordures arrondies |
| **Badge** | Pastille colorée pour catégories et statuts |
| **Modal** | Fenêtre modale pour confirmations et formulaires |
| **Toast** | Notification temporaire (succès, erreur, info) |
| **Button** | Styles : primary, ghost, danger, pdf, excel, orange |
| **Form Input** | Champs avec états focus et validation |
| **Select** | Listes déroulantes stylisées |
| **Avatar** | Cercle avec initiale de l'utilisateur |
| **User Badge** | Badge de l'utilisateur connecté (admin = bleu, user = gris) |
| **Bar Chart** | Graphique à barres verticales pour les statistiques |
| **Table** | Tableaux de données avec tri et actions |

#### Responsive Design

| Breakpoint | Largeur | Adaptation |
|------------|---------|------------|
| **Mobile** | < 640px | Sidebar en overlay, bottom nav, filtres réduits |
| **Tablette** | 640px - 1024px | Sidebar réduite, layout adapté |
| **Desktop** | > 1024px | Sidebar fixe, layout complet |

#### Animations

| Animation | Durée | Usage |
|-----------|-------|-------|
| **Toast** | 3.4s | Notification slide-in/out |
| **Modal** | 0.2s | Ouverture/fermeture |
| **Hover** | 0.15s | Boutons, liens, cartes |
| **Spinner** | 1s | Chargement |

---

## 📖 Guide d'utilisation

### Connexion

1. Ouvrir l'application
2. Sélectionner un utilisateur dans la liste
3. Saisir le mot de passe
4. Cliquer sur "Se connecter"

**Comptes par défaut :**

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| admin | eqnovia-2026 | Administrateur |
| user1 | rachid2026 | Employé |
| user2 | soufiane2026 | Employé |
| user3 | fatima2026 | Employé |
| user4 | larbi2026 | Employé |
| user5 | ibrahime2026 | Employé |
| user6 | hamza2026 | Employé |

### Saisie d'une dépense

1. Aller dans "Saisie & OCR"
2. Remplir le formulaire
3. (Optionnel) Ajouter un justificatif
4. Cliquer sur "Ajouter la dépense"

### OCR

1. Cliquer sur "Choisir une image"
2. Sélectionner une photo de facture
3. Cliquer sur "Lire et extraire"
4. Vérifier les données extraites
5. Cliquer sur "Remplir le formulaire"

### Consultation et filtres

1. Aller dans "Toutes" / "Par mois" / "Par année"
2. Utiliser les filtres en haut de page
3. Cliquer sur les en-têtes de colonnes pour trier

### Export

1. Appliquer les filtres souhaités
2. Cliquer sur "PDF" ou "Excel"
3. Le fichier se télécharge automatiquement

### Gestion des utilisateurs (Admin)

1. Se connecter en tant qu'admin
2. Cliquer sur "Utilisateurs" dans la section Gestion
3. Ajouter, modifier ou supprimer des utilisateurs

---

## 🚀 Déploiement

### Prérequis

- Node.js (pour le build)
- Compte Firebase (pour le cloud)
- Compte GitHub / Netlify (pour l'hébergement)

### Étapes de déploiement

1. **Configurer Firebase** :
   ```bash
   cp .env.example .env
   # Remplir les valeurs Firebase
   ```

2. **Générer le build** :
   ```bash
   node build.js
   ```

3. **Déployer** :
   ```bash
   firebase deploy
   ```

### Déploiement sans Firebase

- Utiliser Netlify ou GitHub Pages
- L'application fonctionne en mode localStorage uniquement

---

## 🔧 Maintenance & Évolution

### Maintenance courante

| Tâche | Fréquence |
|-------|-----------|
| Sauvegarde des données Firebase | Automatique |
| Mise à jour des dépendances | Trimestrielle |
| Vérification des règles Firestore | Mensuelle |
| Audit de sécurité | Semestrielle |

### Évolutions possibles

| Fonctionnalité | Priorité | Description |
|----------------|----------|-------------|
| **Hash des mots de passe** | Haute | Implémenter bcrypt côté serveur |
| **Règles Firestore** | Haute | Configurer les règles de sécurité serveur |
| **Notifications** | Moyenne | Alertes de dépenses, rappels |
| **Multi-devises** | Moyenne | Support EUR, USD en plus du MAD |
| **Approval workflow** | Moyenne | Validation des dépenses par un manager |
| **Statistiques avancées** | Basse | Graphiques interactifs, tendances |
| **API REST** | Basse | Intégration avec d'autres systèmes |
| **Scan QR** | Basse | Extraction depuis QR codes sur factures |

---

## 📞 Contact

| | |
|---|---|
| **📧 Email** | support@eqnovia.ma |
| **📍 Adresse** | Eqnovia, Casablanca, Maroc |
| **🔗 Version** | v3.0 · Firebase + Local |

---

<p align="center">
  <sub>Eqnovia · Gestion intelligente des notes de frais</sub>
</p>
