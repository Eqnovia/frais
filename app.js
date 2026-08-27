'use strict';
// ════════════════════════════════════════════
// CONSTANTS & STATE
// ════════════════════════════════════════════
const STORAGE_KEY = 'eqnovia_expenses_v3';
const MONTHS_FR   = ['Janvier','Février','Mars','Avril','Mai','Juin',
                     'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_SHORT= ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

let sortCol = 'date', sortDir = -1;
let activeTab = 'saisie';
let cache = [];
let useFirebase = false;
let ocrText = '';
let currentUser = 'admin';
let isAdmin = true;
let isAuthenticated = false;

// ══ Firebase Auth state ══
let currentAuthUser = null;     // Firebase Auth user object or null
let authReady = false;          // True once auth state is initialized
let useFirebaseAuth = false;    // True if Firebase Auth is available and configured

const FIREBASE_AUTH_EMULATOR = false; // Set to true for local testing with emulator

// ════════════════════════════════════════════
// USERS CONFIG
// ════════════════════════════════════════════
// Comptes par défaut (utilisés au premier lancement et comme référence)
const DEFAULT_USERS = {
  admin: { password: 'eqnovia-2026', label: 'Administrateur', isAdmin: true, email: '', tel: '' },
  user1: { password: 'rachid2026', label: 'Rachid Bayed', isAdmin: false, email: 'rbayed@eqnovia.ma', tel: '0661285981' },
  user2: { password: 'soufiane2026', label: 'Soufiane Laraichi', isAdmin: false, email: 'slaraichi@eqnovia.ma', tel: '0661376108' },
  user3: { password: 'fatima2026', label: 'Bourzgui Fatima Zahra', isAdmin: false, email: 'fbourzgui@eqnovia.ma', tel: '0664549777' },
  user4: { password: 'larbi2026', label: 'Larbi Ramzi', isAdmin: false, email: 'lramzi@eqnovia.ma', tel: '0707088004' },
  user5: { password: 'ibrahime2026', label: 'Ibrahime', isAdmin: false, email: '', tel: '' },
  user6: { password: 'hamza2026', label: 'Hamza', isAdmin: false, email: '', tel: '' }
};

const USERS_STORAGE_KEY = 'eqnovia_users_v1';

// Charge les utilisateurs depuis le stockage local (persistance des créations/suppressions)
function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored && typeof stored === 'object') {
        // L'administrateur doit toujours exister et conserver ses privilèges
        stored.admin = {
          password: (stored.admin && stored.admin.password) || DEFAULT_USERS.admin.password,
          label: 'Administrateur',
          isAdmin: true,
          email: '',
          tel: ''
        };
        // Fusionner email/tel depuis DEFAULT_USERS pour les comptes existants
        for (const k of Object.keys(DEFAULT_USERS)) {
          if (stored[k]) {
            if (DEFAULT_USERS[k].email) stored[k].email = DEFAULT_USERS[k].email;
            if (DEFAULT_USERS[k].tel) stored[k].tel = DEFAULT_USERS[k].tel;
            if (!stored[k].label) stored[k].label = DEFAULT_USERS[k].label;
          }
        }
        return stored;
      }
    }
  } catch (e) {
    console.warn('Lecture des utilisateurs impossible, utilisation des valeurs par défaut.', e);
  }
  // Premier lancement : on utilise les comptes par défaut
  return JSON.parse(JSON.stringify(DEFAULT_USERS));
}

// Sauvegarde les utilisateurs dans le stockage local
function saveUsers() {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(USERS));
  } catch (e) {
    console.warn('Sauvegarde des utilisateurs impossible.', e);
  }
}

let USERS = loadUsers();
// Persiste les comptes par défaut dès le premier lancement
if (!localStorage.getItem(USERS_STORAGE_KEY)) saveUsers();

// Initialiser l'écouteur Firebase Auth au démarrage
initFirebaseAuthListener();

// ════════════════════════════════════════════
// SIDEBAR TOGGLE (MOBILE)
// ════════════════════════════════════════════
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const toggle = document.getElementById('menuToggle');
  if (sidebar && overlay) {
    const open = sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
    if (toggle) toggle.setAttribute('aria-expanded', open);
    if (open) {
      // Trap focus: move focus to sidebar when opened
      const firstNavItem = sidebar.querySelector('.nav-item');
      if (firstNavItem) firstNavItem.focus();
    } else {
      // Return focus to toggle button when closed
      if (toggle) toggle.focus();
    }
  }
}

// ════════════════════════════════════════════
// FIREBASE AUTH SERVICE
// ════════════════════════════════════════════

/**
 * Obtient l'email Firebase Auth pour un userId local (admin, user1, etc.)
 */
function getAuthEmail(userId) {
  const user = USERS[userId];
  if (!user) return '';
  // Utiliser l'email du profil si défini, sinon générer depuis le nom
  if (user.email) return user.email;
  // Fallback: userId@eqnovia.ma
  return userId + '@eqnovia.ma';
}

/**
 * Tente une connexion via Firebase Auth (email/password)
 * Retourne true si réussi, false si échec
 */
async function firebaseAuthSignIn(email, password) {
  if (!window.__auth || !window.__signInWithEmail) {
    console.warn('Firebase Auth non disponible');
    return false;
  }
  try {
    const userCredential = await window.__signInWithEmail(window.__auth, email, password);
    currentAuthUser = userCredential.user;
    useFirebaseAuth = true;
    console.log('✅ Firebase Auth connecté:', userCredential.user.uid);
    return true;
  } catch (error) {
    console.warn('❌ Firebase Auth échec:', error.code, error.message);
    currentAuthUser = null;
    useFirebaseAuth = false;
    return false;
  }
}

/**
 * Déconnexion Firebase Auth
 */
async function firebaseAuthSignOut() {
  if (!window.__auth || !window.__signOut) return;
  try {
    await window.__signOut(window.__auth);
    currentAuthUser = null;
    useFirebaseAuth = false;
    console.log('✅ Firebase Auth déconnecté');
  } catch (error) {
    console.warn('❌ Firebase Auth déconnexion échouée:', error);
  }
}

/**
 * Initialise l'écouteur d'état Firebase Auth
 */
function initFirebaseAuthListener() {
  if (!window.__auth || !window.__onAuthStateChanged) {
    authReady = true;
    return;
  }
  window.__onAuthStateChanged(window.__auth, (user) => {
    if (user) {
      currentAuthUser = user;
      useFirebaseAuth = true;
      console.log('🔑 Firebase Auth state: connecté', user.uid);
    } else {
      currentAuthUser = null;
      useFirebaseAuth = false;
      console.log('🔑 Firebase Auth state: déconnecté');
    }
    authReady = true;
  });
}

/**
 * Vérifie si le mode Firebase Auth est disponible
 */
function isFirebaseAuthAvailable() {
  return window.__fbReady && window.__auth && authReady;
}

/**
 * Obtient l'UID Firebase Auth actuel (ou null)
 */
function getAuthUid() {
  return (useFirebaseAuth && currentAuthUser) ? currentAuthUser.uid : null;
}

// Get Firebase Auth UID for a local username by querying user_profiles
async function getAuthUidForUser(localUsername) {
  if (!useFirebase || !window.__fs) return null;
  
  const user = USERS[localUsername];
  if (!user || !user.email) return null;
  
  try {
    const { collection, getDocs, query, where } = window.__fs;
    const q = query(collection(window.__db, 'user_profiles'), where('email', '==', user.email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id; // Document ID is the Firebase Auth UID
    }
  } catch (e) {
    console.warn('Failed to get auth UID for user:', e);
  }
  return null;
}

// ════════════════════════════════════════════
// SYNC USERS TO FIREBASE AUTH (Admin)
// ════════════════════════════════════════════

/**
 * Crée un utilisateur Firebase Auth via l'API REST (nécessite la clé API)
 * L'admin appelle cette fonction pour synchroniser les comptes locaux
 */
async function createFirebaseAuthUser(userId, email, password) {
  if (!window.__createAuthUser) {
    console.warn('Firebase Auth createUser non disponible');
    return { success: false, error: 'SDK non disponible' };
  }
  try {
    // createUserWithEmailAndPassword crée ET connecte l'utilisateur.
    // On doit donc reconnecter l'admin après la création.
    const adminEmail = getAuthEmail('admin');
    const adminPassword = USERS.admin ? USERS.admin.password : '';
    
    // Créer le nouvel utilisateur
    const credential = await window.__createAuthUser(window.__auth, email, password);
    
    // Déconnecter le nouvel utilisateur et reconnecter l'admin
    await window.__signOut(window.__auth);
    
    if (adminEmail && adminPassword) {
      await window.__signInWithEmail(window.__auth, adminEmail, adminPassword);
    }
    
    return { success: true, uid: credential.user.uid };
  } catch (error) {
    console.error('❌ Création Firebase Auth échouée:', error.code, error.message);
    return { success: false, error: error.code };
  }
}

/**
 * Synchronise tous les utilisateurs locaux vers Firebase Auth
 * Appelé par l'admin depuis l'interface
 */
async function seedFirebaseAuthUsers() {
  if (!isAdmin) {
    return toast('Seul l\'administrateur peut synchroniser les utilisateurs.', 'err');
  }
  if (!isFirebaseAuthAvailable()) {
    return toast('Firebase Auth n\'est pas disponible. Vérifiez la configuration.', 'err');
  }
  
  const adminEmail = getAuthEmail('admin');
  const adminPassword = USERS.admin ? USERS.admin.password : '';
  
  if (!adminEmail || !adminPassword) {
    return toast('Email ou mot de passe administrateur manquant.', 'err');
  }
  
  // S'assurer que l'admin est connecté à Firebase Auth
  if (!useFirebaseAuth || !currentAuthUser) {
    let ok = await firebaseAuthSignIn(adminEmail, adminPassword);
    
    if (!ok) {
      // L'admin n'existe peut-être pas dans Firebase Auth, essayer de le créer
      console.warn('Admin Firebase Auth échec, tentative de création...');
      try {
        await window.__createAuthUser(window.__auth, adminEmail, adminPassword);
        // Déconnecter le nouvel utilisateur et reconnecter l'admin
        await window.__signOut(window.__auth);
        ok = await firebaseAuthSignIn(adminEmail, adminPassword);
      } catch (error) {
        console.error('❌ Création admin Firebase Auth échouée:', error.code, error.message);
        if (error.code === 'auth/email-already-in-use') {
          return toast('Impossible de connecter l\'admin à Firebase Auth. L\'email existe déjà avec un autre mot de passe.', 'err');
        }
        return toast('Impossible de connecter l\'admin à Firebase Auth. Vérifiez les identifiants.', 'err');
      }
    }
    
    if (!ok) {
      return toast('Impossible de connecter l\'admin à Firebase Auth. Vérifiez les identifiants.', 'err');
    }
  }
  
  toast('⏳ Synchronisation des utilisateurs Firebase Auth...', 'info');
  
  const results = [];
  const userEntries = Object.entries(USERS).filter(([id]) => id !== 'admin');
  
  for (const [userId, userData] of userEntries) {
    const email = getAuthEmail(userId);
    const password = userData.password;
    
    if (!email || !password) continue;
    
    const result = await createFirebaseAuthUser(userId, email, password);
    results.push({ userId, email, success: result.success, error: result.error });
    
    if (result.success) {
      console.log(`✅ Utilisateur Firebase Auth créé: ${email}`);
    } else if (result.error === 'auth/email-already-in-use') {
      console.log(`ℹ️ Utilisateur existe déjà: ${email}`);
      results[results.length - 1].success = true; // C'est normal
    }
  }
  
  // Reconnecter l'admin si nécessaire
  if (!useFirebaseAuth || !currentAuthUser) {
    await firebaseAuthSignIn(adminEmail, adminPassword);
  }
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  toast(`✅ Synchronisation terminée : ${successCount}/${totalCount} utilisateurs`, successCount > 0 ? 'ok' : 'err');
  
  if (successCount < totalCount) {
    console.warn('Échecs de création:', results.filter(r => !r.success));
  }
  
  return results;
}

// ════════════════════════════════════════════
// LOGIN / LOGOUT
// ════════════════════════════════════════════

async function login() {
  const pwd = document.getElementById('loginPassword').value.trim();
  const user = document.getElementById('loginUser').value;
  
  if (!USERS[user]) {
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
    toast('❌ Utilisateur inconnu', 'err');
    return;
  }
  
  // Sauvegarder l'utilisateur sélectionné en cache
  try { localStorage.setItem('eqnovia_lastUser', user); } catch(e) {}
  
  // Essayer Firebase Auth si disponible
  if (isFirebaseAuthAvailable()) {
    const email = getAuthEmail(user);
    if (email) {
      const fbOk = await firebaseAuthSignIn(email, pwd);
      if (fbOk) {
        completeLogin(user);
        return;
      }
      console.warn('Firebase Auth échoué, tentative locale...');
    }
  }
  
  // Fallback : authentification locale
  if (USERS[user].password === pwd) {
    completeLogin(user);
    if (!isFirebaseAuthAvailable()) {
      toast('ℹ️ Firebase non disponible — Mode local activé', 'info');
    }
  } else {
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
    toast('❌ Mot de passe incorrect', 'err');
  }
}

function completeLogin(user) {
  isAuthenticated = true;
  currentUser = user;
  isAdmin = USERS[user].isAdmin;
  
  document.getElementById('loginOverlay').classList.add('hidden');
  document.querySelectorAll('#appContent').forEach(el => el.style.display = '');
  
  document.getElementById('userSelector').value = user;
  updateUserUI();
  
  // Initialize bottom nav active state
  TABS.forEach(id => {
    document.getElementById(`bnav-${id}`)?.classList.toggle('active', id === activeTab);
  });
  
  const modeText = useFirebaseAuth ? '☁️ Cloud' : '💻 Local';
  toast(`✅ Connexion réussie ! Bienvenue ${USERS[user].label} (${modeText})`, 'ok');
  init();
}

async function logout() {
  if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
    isAuthenticated = false;
    
    // Déconnexion Firebase Auth si actif
    if (useFirebaseAuth) {
      await firebaseAuthSignOut();
    }
    
    document.querySelectorAll('#appContent').forEach(el => el.style.display = 'none');
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').style.display = 'none';
    // Close sidebar on mobile
    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('open');
    // Reset bottom nav active state
    TABS.forEach(id => {
      document.getElementById(`bnav-${id}`)?.classList.remove('active');
    });
    toast('👋 Déconnexion réussie', 'info');
  }
}

document.getElementById('loginPassword').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') login();
});

// ════════════════════════════════════════════
// USER MANAGEMENT
// ════════════════════════════════════════════
function switchUser(userId) {
  if (!isAdmin) {
    toast('Seul l\'administrateur peut changer d\'utilisateur.', 'err');
    document.getElementById('userSelector').value = currentUser;
    return;
  }
  currentUser = userId;
  isAdmin = USERS[userId].isAdmin;
  updateUserUI();
  updateKPIs();
  renderAll();
  renderMonthly();
  renderYearly();
  toast('👤 Changement vers ' + USERS[userId].label, 'info');
}

function updateUserUI() {
  const badge = document.getElementById('userBadge');
  const avatar = document.getElementById('avatarDisplay');
  const userInfo = USERS[currentUser];
  
  badge.textContent = userInfo.label;
  badge.className = 'user-badge ' + (isAdmin ? 'admin' : 'user');
  
  const first = userInfo.label.substring(0, 1);
  avatar.textContent = first;
  
  const adminOnly = document.querySelectorAll('#adminOnlyLabel, #adminUsersBtn, #adminOMBtn, #tab-admin-om, #nav-mission, #tab-mission, #bnav-mission, #nav-trimestre, #tab-trimestre, #bnav-trimestre, #nav-comparison, #tab-comparison, #bnav-comparison, #adminOnlyBackupLabel, #nav-backup, #tab-backup, #bnav-backup, #adminOnlyInfoLabel, #nav-policy, #tab-policy, #bnav-policy');
  adminOnly.forEach(el => el.style.display = isAdmin ? '' : 'none');
  
  // Show user missions tab for non-admin users
  const userMissionsTab = document.getElementById('tab-user-missions');
  const userMissionsNav = document.getElementById('nav-user-missions');
  const userMissionsBnav = document.getElementById('bnav-user-missions');
  if (userMissionsTab) userMissionsTab.style.display = isAdmin ? 'none' : '';
  if (userMissionsNav) userMissionsNav.style.display = isAdmin ? 'none' : '';
  if (userMissionsBnav) userMissionsBnav.style.display = isAdmin ? 'none' : '';
  
  // Show/hide dashboard mission orders container
  const dashboardMOContainer = document.getElementById('dashboardMOContainer');
  if (dashboardMOContainer) dashboardMOContainer.style.display = isAdmin ? 'none' : '';
  
  const filterUser = document.getElementById('filterUser');
  if (filterUser) {
    filterUser.style.display = isAdmin ? '' : 'none';
  }
  
  const filterMonthUser = document.getElementById('filterMonthUser');
  if (filterMonthUser) {
    filterMonthUser.style.display = isAdmin ? '' : 'none';
  }
  
  // Populate assignedTo dropdown for mission orders
  populateAssignedToDropdown();
}

// Populate the omEmploye dropdown with available users
function populateAssignedToDropdown() {
  // Populate omEmploye (collaborator name)
  const omEmployeSelect = document.getElementById('omEmploye');
  if (omEmployeSelect) {
    omEmployeSelect.innerHTML = '<option value="">-- Sélectionner un membre --</option>';
    Object.entries(USERS).forEach(([key, u]) => {
      if (key === 'admin') return; // Skip admin
      const option = document.createElement('option');
      option.value = u.label;
      option.textContent = u.label;
      omEmployeSelect.appendChild(option);
    });
  }
}

// Update the mode status indicator in the top bar
function updateModeStatus() {
  const modeStatus = document.getElementById('modeStatus');
  const modeStatusText = document.getElementById('modeStatusText');
  if (!modeStatus || !modeStatusText) return;
  
  if (useFirebase) {
    modeStatus.className = 'db-status db-online';
    modeStatus.querySelector('span:first-child').textContent = '☁️';
    modeStatusText.textContent = 'Cloud';
  } else {
    modeStatus.className = 'db-status db-local';
    modeStatus.querySelector('span:first-child').textContent = '💻';
    modeStatusText.textContent = 'Local';
  }
}

// ════════════════════════════════════════════
// USER MANAGEMENT (Admin)
// ════════════════════════════════════════════
function openUserManager() {
  if (!isAdmin) {
    return toast('Seul l\'administrateur peut gérer les utilisateurs.', 'err');
  }
  renderUsersList();
  document.getElementById('userModal').classList.add('open');
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('open');
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  } else {
    const el = document.getElementById('modal');
    if (el) el.classList.remove('open');
  }
}

document.getElementById('userModal').addEventListener('click', e => {
  if (e.target === document.getElementById('userModal')) closeUserModal();
});

function renderUsersList() {
  const container = document.getElementById('usersList');
  const users = Object.entries(USERS).filter(([key]) => key !== 'admin');
  
  if (!users.length) {
    container.innerHTML = '<p style="color:var(--gray-400);font-size:13px;text-align:center;padding:20px;">Aucun utilisateur.</p>';
    return;
  }
  
  const fbAuthAvailable = isFirebaseAuthAvailable();
  
  container.innerHTML = users.map(([key, u]) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);margin-bottom:8px;background:var(--white);">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <div style="width:32px;height:32px;border-radius:50%;background:${u.isAdmin ? 'var(--eq-blue-pale)' : 'var(--gray-100)'};color:${u.isAdmin ? 'var(--eq-blue)' : 'var(--gray-700)'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">
          ${u.label.substring(0,1).toUpperCase()}
        </div>
        <div style="min-width:0;flex:1;">
          <div style="font-size:13px;font-weight:600;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(u.label)}</div>
          <div style="font-size:11px;color:var(--gray-400);">${u.isAdmin ? 'Administrateur' : 'Utilisateur'} ${u.email ? '• ' + esc(u.email) : ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        ${fbAuthAvailable ? `<button class="btn-icon" onclick="seedFirebaseAuthUsers()" title="Sync Firebase Auth" style="width:28px;height:28px;font-size:12px;color:var(--eq-blue);">☁️</button>` : ''}
        <button class="btn-icon edit" onclick="editUser('${key}')" title="Modifier" style="width:28px;height:28px;font-size:12px;">✏️</button>
        ${key !== 'admin' ? `<button class="btn-icon" onclick="deleteUser('${key}')" title="Supprimer" style="width:28px;height:28px;font-size:12px;color:var(--red);">✕</button>` : ''}
      </div>
    </div>
  `).join('');
}

function addNewUser() {
  const nameInput = document.getElementById('newUserName');
  const pwdInput = document.getElementById('newUserPassword');
  const roleInput = document.getElementById('newUserRole');
  
  const name = sanitizeInput(nameInput.value);
  const pwd = pwdInput.value.trim();
  const isAdminRole = roleInput.value === 'admin';
  
  if (!name) return toast('Veuillez saisir un nom.', 'err');
  if (!pwd) return toast('Veuillez saisir un mot de passe.', 'err');
  if (pwd.length < 4) return toast('Le mot de passe doit contenir au moins 4 caractères.', 'err');
  
  // Generate unique key
  const existingKeys = Object.keys(USERS).filter(k => k.startsWith('user'));
  const maxNum = existingKeys.reduce((max, k) => {
    const num = parseInt(k.replace('user', ''), 10);
    return num > max ? num : max;
  }, 0);
  const newKey = 'user' + (maxNum + 1);
  
  USERS[newKey] = {
    password: pwd,
    label: name,
    isAdmin: isAdminRole
  };

  saveUsers();

  nameInput.value = '';
  pwdInput.value = '';
  roleInput.value = 'user';

  renderUsersList();
  updateUserSelector();
  updateLoginUserSelect();
  toast('✅ Utilisateur ajouté : ' + name, 'ok');
}

function editUser(key) {
  const user = USERS[key];
  if (!user) return;
  
  const newName = prompt('Nouveau nom pour ' + user.label + ' :', user.label);
  if (newName === null) return;
  
  const sanitizedName = sanitizeInput(newName);
  if (!sanitizedName) return toast('Le nom ne peut pas être vide.', 'err');
  
  const newPwd = prompt('Nouveau mot de passe (laisser vide pour conserver l\'ancien) :', '');
  if (newPwd === null) return;
  
  USERS[key].label = sanitizedName;
  if (newPwd.trim()) {
    if (newPwd.trim().length < 4) return toast('Le mot de passe doit contenir au moins 4 caractères.', 'err');
    USERS[key].password = newPwd.trim();
  }

  saveUsers();

  renderUsersList();
  updateUserUI();
  updateLoginUserSelect();
  toast('✅ Utilisateur modifié : ' + sanitizedName, 'ok');
}

function deleteUser(key) {
  const user = USERS[key];
  if (!user) return;
  
  showModal('Supprimer l\'utilisateur', 'Voulez-vous vraiment supprimer l\'utilisateur "' + user.label + '" ? Cette action est irréversible.', async () => {
    delete USERS[key];
    saveUsers();
    renderUsersList();
    updateUserSelector();
    updateLoginUserSelect();
    
    // If deleted user was current, switch to admin
    if (currentUser === key) {
      currentUser = 'admin';
      isAdmin = true;
      updateUserUI();
    }
    
    toast('🗑️ Utilisateur supprimé.', 'info');
  });
}

function updateUserSelector() {
  const sel = document.getElementById('userSelector');
  if (!sel) return;
  
  const currentVal = sel.value;
  sel.innerHTML = '<option value="admin"> Admin</option>' +
    Object.entries(USERS)
      .filter(([k]) => k !== 'admin')
      .map(([k, u]) => `<option value="${k}">👤 ${esc(u.label)}</option>`)
      .join('');
  
  if (Object.keys(USERS).includes(currentVal)) {
    sel.value = currentVal;
  }
}

// Met à jour la liste déroulante de connexion avec les utilisateurs persistés
function updateLoginUserSelect() {
  const sel = document.getElementById('loginUser');
  if (!sel) return;

  const currentVal = sel.value;
  sel.innerHTML = Object.entries(USERS)
    .map(([k, u]) => `<option value="${k}">${u.isAdmin ? 'Administrateur' : esc(u.label)}</option>`)
    .join('');

  if (USERS[currentVal]) sel.value = currentVal;
}

function getUserExpenses(data) {
  if (isAdmin) return data;
  return data.filter(e => e.user === currentUser);
}

// ════════════════════════════════════════════
// FIREBASE BRIDGE
// ════════════════════════════════════════════
async function fbAdd(expense) {
  if (!useFirebase) return;
  try {
    const { collection, addDoc, serverTimestamp } = window.__fs;
    await addDoc(collection(window.__db, 'expenses'), {
      ...expense,
      _authUid: getAuthUid(),
      createdAt: serverTimestamp(),
      createdBy: currentUser,
      modifiedBy: currentUser,
      modifiedAt: serverTimestamp()
    });
  } catch(e) { console.warn('FB add failed', e); }
}

async function fbUpdate(id, updates) {
  if (!useFirebase) return;
  try {
    const { collection, getDocs, doc, query, where, updateDoc, serverTimestamp } = window.__fs;
    const q = query(collection(window.__db, 'expenses'), where('id', '==', id));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(doc(window.__db, 'expenses', d.id), {
        ...updates,
        modifiedBy: currentUser,
        modifiedAt: serverTimestamp()
      });
    }
  } catch(e) { console.warn('FB update failed', e); }
}

async function fbDelete(id) {
  if (!useFirebase) return;
  try {
    const { collection, getDocs, deleteDoc, doc, query, where } = window.__fs;
    const q = query(collection(window.__db, 'expenses'), where('id', '==', id));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(window.__db, 'expenses', d.id));
    }
  } catch(e) { console.warn('FB delete failed', e); }
}

async function fbLoad() {
  if (!useFirebase) return null;
  try {
    const { collection, getDocs, query, orderBy, where } = window.__fs;
    // Si Firebase Auth est actif, filtrer par auth_uid pour l'isolation
    let q;
    if (isFirebaseAuthAvailable() && useFirebaseAuth && currentAuthUser) {
      if (isAdmin) {
        // Admin voit tout
        q = query(collection(window.__db,'expenses'), orderBy('createdAt','asc'));
      } else {
        // Utilisateur ne voit que ses propres documents
        q = query(collection(window.__db,'expenses'),
          where('_authUid', '==', currentAuthUser.uid),
          orderBy('createdAt','asc'));
      }
    } else {
      q = query(collection(window.__db,'expenses'), orderBy('createdAt','asc'));
    }
    const snap = await getDocs(q);
    const arr  = [];
    snap.forEach(d => arr.push({ ...d.data() }));
    return arr;
  } catch(e) { console.warn('FB load failed', e); return null; }
}

// ════════════════════════════════════════════
// FIREBASE — ORDRES DE MISSION (legacy)
// ════════════════════════════════════════════
async function fbAddOM(om) {
  if (!useFirebase) return;
  try {
    const { collection, addDoc, serverTimestamp } = window.__fs;
    await addDoc(collection(window.__db, 'om_history'), {
      ...om,
      _authUid: getAuthUid(),
      _savedAt: serverTimestamp()
    });
  } catch(e) { console.warn('FB OM add failed', e); }
}

async function fbDeleteOM(localId) {
  if (!useFirebase) return;
  try {
    const { collection, getDocs, deleteDoc, doc, query, where } = window.__fs;
    const q = query(collection(window.__db, 'om_history'), where('_localId', '==', localId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(window.__db, 'om_history', d.id));
    }
  } catch(e) { console.warn('FB OM delete failed', e); }
}

async function fbLoadOM() {
  if (!useFirebase) return null;
  try {
    const { collection, getDocs, query, orderBy } = window.__fs;
    const q = query(collection(window.__db, 'om_history'), orderBy('_savedAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ _firebaseId: d.id, ...d.data() }));
  } catch(e) { console.warn('FB OM load failed', e); return null; }
}

// ════════════════════════════════════════════
// FIREBASE — MISSION ORDERS (nouveau système)
// ════════════════════════════════════════════
async function fbAddMissionOrder(mo) {
  if (!useFirebase) return null;
  try {
    const { collection, addDoc, serverTimestamp } = window.__fs;
    const docRef = await addDoc(collection(window.__db, 'mission_orders'), {
      ...mo,
      _authUid: getAuthUid(),
      createdAt: serverTimestamp(),
      modifiedAt: serverTimestamp()
    });
    return docRef.id;
  } catch(e) { console.warn('FB mission_order add failed', e); return null; }
}

async function fbUpdateMissionOrder(docId, updates) {
  if (!useFirebase) return;
  try {
    const { doc, updateDoc, serverTimestamp } = window.__fs;
    await updateDoc(doc(window.__db, 'mission_orders', docId), {
      ...updates,
      modifiedBy: currentUser,
      modifiedAt: serverTimestamp()
    });
  } catch(e) { console.warn('FB mission_order update failed', e); }
}

async function fbDeleteMissionOrder(docId) {
  if (!useFirebase) return;
  try {
    const { deleteDoc, doc } = window.__fs;
    await deleteDoc(doc(window.__db, 'mission_orders', docId));
  } catch(e) { console.warn('FB mission_order delete failed', e); }
}

async function fbLoadMissionOrders() {
  if (!useFirebase) return null;
  try {
    const { collection, getDocs, query, orderBy, where } = window.__fs;
    let q;
    if (isAdmin) {
      // Admin voit tous les OM
      q = query(collection(window.__db, 'mission_orders'), orderBy('createdAt', 'desc'));
    } else {
      // Utilisateur voit seulement ses OM assignées
      const authUid = getAuthUid();
      if (authUid) {
        q = query(collection(window.__db, 'mission_orders'), where('assignedToAuthUid', '==', authUid), orderBy('createdAt', 'desc'));
      } else {
        // Fallback: filter by local username
        q = query(collection(window.__db, 'mission_orders'), where('assignedTo', '==', currentUser), orderBy('createdAt', 'desc'));
      }
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ _firebaseId: d.id, ...d.data() }));
  } catch(e) { console.warn('FB mission_orders load failed', e); return null; }
}

async function fbLoadMissionOrdersForUser(userId) {
  if (!useFirebase) return null;
  try {
    const { collection, getDocs, query, orderBy, where } = window.__fs;
    // Try to find by assignedToAuthUid first
    let q = query(collection(window.__db, 'mission_orders'), where('assignedToAuthUid', '==', userId), orderBy('createdAt', 'desc'));
    let snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ _firebaseId: d.id, ...d.data() }));
    }
    // Fallback: try by assignedTo (local username)
    // We need to find the local username for this Firebase UID
    const userProfile = await findUserProfileByAuthUid(userId);
    if (userProfile && userProfile.email) {
      const localUser = Object.entries(USERS).find(([k, u]) => u.email === userProfile.email);
      if (localUser) {
        q = query(collection(window.__db, 'mission_orders'), where('assignedTo', '==', localUser[0]), orderBy('createdAt', 'desc'));
        snap = await getDocs(q);
        return snap.docs.map(d => ({ _firebaseId: d.id, ...d.data() }));
      }
    }
    return [];
  } catch(e) { console.warn('FB mission_orders load for user failed', e); return null; }
}

// Find user profile by Firebase Auth UID
async function findUserProfileByAuthUid(authUid) {
  if (!useFirebase || !window.__fs) return null;
  try {
    const { doc, getDoc } = window.__fs;
    const docRef = doc(window.__db, 'user_profiles', authUid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch(e) {
    console.warn('Failed to find user profile:', e);
  }
  return null;
}

// ════════════════════════════════════════════
// LOCAL STORAGE
// ════════════════════════════════════════════
function lsLoad() { 
  try { 
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch(e) { 
    console.warn('localStorage read failed:', e);
    return []; 
  }
}

function lsSave(d) { 
  try { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); 
  } catch(e) { 
    console.warn('localStorage save failed:', e);
  }
}

// ════════════════════════════════════════════
// DATA LAYER
// ════════════════════════════════════════════
async function dataLoad() {
  if (useFirebase) {
    const fb = await fbLoad();
    if (fb !== null) {
      cache = fb;
      try { lsSave(cache); } catch(e) {}
      return;
    }
  }
  cache = lsLoad();
}

async function dataAdd(exp) {
  exp.createdBy = currentUser;
  exp.createdAt = new Date().toISOString();
  exp.modifiedBy = currentUser;
  exp.modifiedAt = new Date().toISOString();
  cache.push(exp);
  try { lsSave(cache); } catch(e) {}
  await fbAdd(exp);
}

async function dataUpdate(id, updates) {
  const idx = cache.findIndex(e => e.id === id);
  if (idx === -1) return;
  cache[idx] = { ...cache[idx], ...updates, modifiedBy: currentUser, modifiedAt: new Date().toISOString() };
  try { lsSave(cache); } catch(e) {}
  await fbUpdate(id, updates);
}

async function dataDelete(id) {
  const exp = cache.find(e => e.id === id);
  if (exp) {
    exp.deletedBy = currentUser;
    exp.deletedAt = new Date().toISOString();
  }
  cache = cache.filter(e => e.id !== id);
  try { lsSave(cache); } catch(e) {}
  await fbDelete(id);
}

function dataAll() { return [...cache]; }

// ════════════════════════════════════════════
// MISSION ORDERS DATA LAYER
// ════════════════════════════════════════════
let missionOrdersCache = [];
let userMissionOrdersCache = [];

async function dataLoadMissionOrders() {
  if (useFirebase) {
    const fb = await fbLoadMissionOrders();
    if (fb !== null) {
      // Merge Firebase data with local data (Firebase wins on conflicts)
      const localData = missionOrdersCache;
      const fbIds = new Set(fb.map(o => o._firebaseId).filter(Boolean));
      const merged = [...fb];
      let changed = false;
      for (const local of localData) {
        if (!fbIds.has(local._firebaseId)) {
          // Local item not in Firebase, add it
          merged.push(local);
          changed = true;
        }
      }
      missionOrdersCache = merged;
      if (changed) {
        try { localStorage.setItem('eqnovia_mission_orders', JSON.stringify(missionOrdersCache)); } catch(e) {}
      }
      return;
    }
  }
  // Fallback: load from localStorage
  try {
    const stored = localStorage.getItem('eqnovia_mission_orders');
    missionOrdersCache = stored ? JSON.parse(stored) : [];
  } catch(e) {
    missionOrdersCache = [];
  }
}

async function dataLoadUserMissionOrders() {
  if (useFirebase) {
    const authUid = getAuthUid();
    if (authUid) {
      const fb = await fbLoadMissionOrdersForUser(authUid);
      if (fb !== null) {
        // Merge Firebase data with local cache to include any unsynced items
        const localData = dataUserMissionOrders();
        const fbIds = new Set(fb.map(o => o._firebaseId).filter(Boolean));
        const merged = [...fb];
        let changed = false;
        for (const local of localData) {
          if (!fbIds.has(local._firebaseId) && !merged.find(m => m._localId === local._localId)) {
            merged.push(local);
            changed = true;
          }
        }
        userMissionOrdersCache = merged;
        if (changed) {
          // Update missionOrdersCache with merged data
          missionOrdersCache = [...merged];
          try { localStorage.setItem('eqnovia_mission_orders', JSON.stringify(missionOrdersCache)); } catch(e) {}
        }
        return;
      }
    }
  }
  // Fallback: filter from local cache using the unified function
  userMissionOrdersCache = dataUserMissionOrders();
}

async function dataAddMissionOrder(mo) {
  mo.createdBy = currentUser;
  mo.createdAt = new Date().toISOString();
  mo.modifiedBy = currentUser;
  mo.modifiedAt = new Date().toISOString();
  missionOrdersCache.push(mo);
  try { localStorage.setItem('eqnovia_mission_orders', JSON.stringify(missionOrdersCache)); } catch(e) {}
  
  const fbId = await fbAddMissionOrder(mo);
  if (fbId) {
    mo._firebaseId = fbId;
    // Update local storage with firebase ID
    try { localStorage.setItem('eqnovia_mission_orders', JSON.stringify(missionOrdersCache)); } catch(e) {}
  }
}

async function dataUpdateMissionOrder(docId, updates) {
  const idx = missionOrdersCache.findIndex(mo => mo._firebaseId === docId || mo._localId === docId);
  if (idx === -1) return;
  missionOrdersCache[idx] = { ...missionOrdersCache[idx], ...updates, modifiedBy: currentUser, modifiedAt: new Date().toISOString() };
  try { localStorage.setItem('eqnovia_mission_orders', JSON.stringify(missionOrdersCache)); } catch(e) {}
  await fbUpdateMissionOrder(docId, updates);
}

async function dataDeleteMissionOrder(docId) {
  const idx = missionOrdersCache.findIndex(mo => mo._firebaseId === docId || mo._localId === docId);
  if (idx >= 0) {
    missionOrdersCache[idx].deletedBy = currentUser;
    missionOrdersCache[idx].deletedAt = new Date().toISOString();
  }
  missionOrdersCache = missionOrdersCache.filter(mo => mo._firebaseId !== docId && mo._localId !== docId);
  try { localStorage.setItem('eqnovia_mission_orders', JSON.stringify(missionOrdersCache)); } catch(e) {}
  await fbDeleteMissionOrder(docId);
}

function dataAllMissionOrders() { return [...missionOrdersCache]; }

function dataUserMissionOrders() {
  if (isAdmin) return [...missionOrdersCache];
  const authUid = getAuthUid();
  return missionOrdersCache.filter(mo => {
    // Check by local username (for local mode)
    if (mo.assignedTo === currentUser) return true;
    // Check by Firebase Auth UID (for Firebase mode)
    if (authUid && mo.assignedToAuthUid === authUid) return true;
    return false;
  });
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function fmtDH(n) {
  return n.toLocaleString('fr-MA', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' DH';
}
function fmtDate(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d} ${MONTHS_FR[parseInt(m,10)-1].substring(0,3)}. ${y}`;
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function today() { return new Date().toISOString().split('T')[0]; }
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>\"']/g, '').trim();
}
function validateAmount(val) {
  const n = parseFloat(val);
  return !isNaN(n) && n >= 0 && n <= 10000000;
}

function validateDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
  return !isNaN(d.getTime()) && d <= now && d >= tenYearsAgo;
}

// ════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════
function toast(msg, type='ok') {
  const t=document.getElementById('toast'),
        icon=document.getElementById('toastIcon'),
        msgEl=document.getElementById('toastMsg'),
        bar=document.getElementById('toastBar');
  icon.textContent={'ok':'✓','err':'✕','info':'ℹ'}[type]||'✓';
  icon.className=`toast-icon ${type}`;
  msgEl.textContent=msg;
  t.className='toast show'+(type==='err'?' err':'');
  bar.style.animation='none'; void bar.offsetWidth; bar.style.animation='';
  clearTimeout(t._tid);
  t._tid=setTimeout(()=>t.classList.remove('show'),3400);
}

// ════════════════════════════════════════════
// EMAILJS — NOTIFICATIONS EMAIL
// ════════════════════════════════════════════
const EMAILJS_CONFIG = {
  publicKey: '61_cDBW62XgV1dpqN',
  serviceID: 'service_265zocr',
  templateID: 'template_xcl',
};

// Initialiser EmailJS au chargement
try { emailjs.init(EMAILJS_CONFIG.publicKey); } catch(e) { /* EmailJS non disponible */ }

function cleanPhone(p) {
  return (p || '').replace(/[\s\.\-\/\\()]/g, '');
}

// ══ Trouver l'email d'un collaborateur depuis USERS ══
function findUserEmail(employeName) {
  if (!employeName || employeName === '—') return '';
  const name = employeName.toLowerCase().trim();
  for (const k of Object.keys(USERS)) {
    const u = USERS[k];
    if (u.label && u.label.toLowerCase().trim() === name) {
      return u.email || '';
    }
  }
  // Fallback: recherche partielle
  for (const k of Object.keys(USERS)) {
    const u = USERS[k];
    if (u.label && name.includes(u.label.toLowerCase().trim().split(' ')[0])) {
      return u.email || '';
    }
  }
  return '';
}

function notifyOMByWhatsApp(om, status, comment) {
  const phone = cleanPhone(om.tel || '');
  if (!phone || phone === '—' || phone.length < 6) return null;
  
  const statusLabel = {approved:'✅ Approuvé', rejected:'❌ Rejeté', pending:'⏳ En attente'}[status] || status;
  const message = `Eqnovia - Ordre de mission ${om.numero || 'N/A'}\n\nBonjour ${om.employe || 'Collaborateur'},\n\nVotre ordre de mission N° ${om.numero} a été ${statusLabel}.${comment ? `\n\nMessage : ${comment}` : ''}\n\nDocument : ${om.date || ''} | ${om.objet || ''}\nÉquipe Eqnovia`;
  
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function notifyOMByEmail(om, status, comment) {
  if (!window.emailjs || EMAILJS_CONFIG.serviceID.includes('xxxxxxx')) {
    console.warn('EmailJS non configuré — modifiez EMAILJS_CONFIG avec vos IDs');
    return;
  }
  
  const statusLabel = {approved:'Approuvé ✅', rejected:'Rejeté ❌', pending:'En attente ⏳'}[status] || status;
  
  const recipient = om.email || findUserEmail(om.employe) || '';
  if (!recipient) {
    console.warn('📧 Aucun email trouvé pour', om.employe);
    toast('⚠️ Aucun email trouvé pour ' + (om.employe || 'ce collaborateur'), 'err');
    return;
  }
  emailjs.send(EMAILJS_CONFIG.serviceID, EMAILJS_CONFIG.templateID, {
    numero: om.numero || 'N/A',
    employe: om.employe || 'Collaborateur',
    status: status,
    status_label: statusLabel,
    comment: comment || '—',
    date: om.date || new Date().toLocaleDateString('fr-FR'),
    objet: om.objet || '—',
    depart: om.depart || '—',
    arrivee: om.arrivee || '—',
    transport: om.transport || '—',
    to_email: recipient
  })
  .then(() => {
    console.log('📧 Email envoyé avec succès à', recipient);
    toast('📧 Email envoyé à ' + (om.employe || 'collaborateur'), 'ok');
  })
  .catch(err => {
    console.warn('📧 Échec envoi email:', err);
    toast('❌ Échec envoi email à ' + (om.employe || 'collaborateur'), 'err');
  });
}

// ════════════════════════════════════════════
// JUSTIFICATIF PREVIEW
// ════════════════════════════════════════════
// ══ GENERIC JUSTIFICATIF PREVIEW (supports prefix-based ID lookup) ══
function previewJustificatifFor(prefix) {
  return function(event) {
    const files = event.target.files;
    const preview = document.getElementById(prefix + 'Preview');
    const previewImg = document.getElementById(prefix + 'PreviewImg');
    const fileName = document.getElementById(prefix + 'FileName');
    const clearBtn = document.getElementById(prefix + 'ClearBtn');
    if (!files || files.length === 0) { preview.style.display='none'; fileName.textContent=''; clearBtn.style.display='none'; return; }
    
    const imgFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imgFiles.length > 0) {
      // Show preview of the first image + count
      const first = imgFiles[0];
      fileName.textContent = `📄 ${files.length} fichier(s) sélectionné(s) — Aperçu: ${first.name} (${(first.size/1024).toFixed(1)} Ko)`;
      const reader = new FileReader();
      reader.onload = (e) => { previewImg.src=e.target.result; preview.style.display=''; };
      reader.readAsDataURL(first);
    } else {
      fileName.textContent = `📄 ${files.length} fichier(s) sélectionné(s)`;
      preview.style.display='none';
      previewImg.src='';
    }
    clearBtn.style.display = '';
  };
}

function clearJustificatifFor(prefix) {
  document.getElementById(prefix + 'Input').value='';
  document.getElementById(prefix + 'Preview').style.display='none';
  document.getElementById(prefix + 'PreviewImg').src='';
  document.getElementById(prefix + 'FileName').textContent='';
  document.getElementById(prefix + 'ClearBtn').style.display='none';
}

// ══ Specific wrappers using the generic functions ══
const previewJustificatif = previewJustificatifFor('justif');
function clearJustificatif() { clearJustificatifFor('justif'); }
const previewEditJustificatif = previewJustificatifFor('editJustif');
function clearEditJustificatif() { clearJustificatifFor('editJustif'); }

// ════════════════════════════════════════════
// MODAL
// ════════════════════════════════════════════
function showModal(title,msg,cb){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalMsg').textContent=msg;
  document.getElementById('modalOk').onclick=()=>{closeModal();cb&&cb();};
  document.getElementById('modal').classList.add('open');
}
document.getElementById('modal').addEventListener('click',e=>{
  if(e.target===document.getElementById('modal')) closeModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    // Close sidebar overlay if open
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && sidebar.classList.contains('open')) {
      toggleSidebar();
    }
    // Close any open modal
    ['modal','editModal','justifModal','userModal'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.classList.contains('open')) {
        if (id === 'modal') closeModal();
        if (id === 'editModal') closeEditModal();
        if (id === 'justifModal') closeJustifModal();
        if (id === 'userModal') closeUserModal();
      }
    });
  }
});

// ════════════════════════════════════════════
// MULTI-JUSTIFICATIF HELPERS
// ════════════════════════════════════════════

/**
 * Retourne un tableau de fichiers justificatif pour une dépense.
 * Gère la rétrocompatibilité avec l'ancien format mono-fichier (justifData).
 */
function getJustifFiles(exp) {
  if (exp.justifFiles && Array.isArray(exp.justifFiles) && exp.justifFiles.length > 0) {
    return exp.justifFiles;
  }
  // Backward compat: old single-file format
  const url = exp.justifStorageUrl || exp.justifData;
  if (url) {
    return [{
      data: exp.justifData,
      name: exp.justifName || 'Justificatif',
      storageUrl: exp.justifStorageUrl,
      storagePath: exp.justifStoragePath
    }];
  }
  return [];
}

function countJustif(exp) {
  return getJustifFiles(exp).length;
}

function hasJustif(exp) {
  return countJustif(exp) > 0;
}

// ════════════════════════════════════════════
// JUSTIFICATIF MODAL
// ════════════════════════════════════════════
function closeJustifModal() {
  document.getElementById('justifModal').classList.remove('open');
}

document.getElementById('justifModal').addEventListener('click', e => {
  if (e.target === document.getElementById('justifModal')) closeJustifModal();
});

function viewJustificatif(id) {
  const exp = cache.find(e => e.id === id);
  if (!exp) return toast('Dépense introuvable.', 'err');
  
  const body = document.getElementById('justifBody');
  const files = getJustifFiles(exp);
  
  if (files.length > 0) {
    let html = '<div class="justif-gallery" style="display:flex;flex-direction:column;gap:12px;align-items:center;">';
    files.forEach((f, idx) => {
      const url = f.storageUrl || f.data;
      if (!url) return;
      html += `<div class="justif-gallery-item" style="width:100%;text-align:center;">
        <img src="${url}" alt="Justificatif ${idx+1}" style="max-width:100%;border-radius:8px;border:1px solid var(--gray-200);max-height:400px;object-fit:contain;cursor:pointer;" onclick="window.open('${url}','_blank')" title="Cliquer pour agrandir"/>
        <p style="margin-top:6px;font-size:11px;color:var(--gray-400);">
          📎 ${esc(f.name || 'Justificatif ' + (idx+1))}
          ${f.storageUrl ? ' <span style="color:var(--eq-blue);">☁️</span>' : ''}
          ${files.length > 1 ? '<span style="color:var(--gray-300);"> — ' + (idx+1) + '/' + files.length + '</span>' : ''}
        </p>
      </div>`;
    });
    html += '</div>';
    body.innerHTML = html;
  } else {
    body.innerHTML = `<p style="color:var(--gray-400);font-size:14px;">📭 Aucun justificatif pour cette dépense.</p>`;
  }
  
  document.getElementById('justifModal').classList.add('open');
}

// ════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════
const TABS = ['saisie','all','monthly','yearly','trimestre','comparison','mission','admin-om','user-missions','policy','backup'];
function switchTab(t) {
  activeTab = t;
  TABS.forEach(id=>{
    const tabContent = document.getElementById(`tab-content-${id}`);
    if (tabContent) tabContent.style.display = id===t?'block':'none';
    const tabBtn = document.getElementById(`tab-${id}`);
    tabBtn?.classList.toggle('active', id===t);
    if (tabBtn) tabBtn.setAttribute('aria-selected', id===t ? 'true' : 'false');
    document.getElementById(`nav-${id}`)?.classList.toggle('active', id===t);
    document.getElementById(`bnav-${id}`)?.classList.toggle('active', id===t);
    // Show/hide mobile section headers
    document.querySelectorAll(`.mobile-section-header`).forEach(el => el.style.display = 'none');
    const header = document.querySelector(`#tab-content-${t} .mobile-section-header`);
    if (header) header.style.display = 'flex';
  });
  if (t==='all')        renderAll();
  if (t==='monthly')    renderMonthly();
  if (t==='yearly')     renderYearly();
  if (t==='trimestre')  renderTrimester();
  if (t==='comparison') renderComparison();
  if (t==='admin-om')   loadAdminOM();
  if (t==='user-missions') renderUserMissionOrders();
  if (t==='saisie')     renderDashboardMissionOrders();
  if (t==='backup')     renderBackupStatus();
}

// ════════════════════════════════════════════
// ORDRE DE MISSION
// ════════════════════════════════════════════
function getOMValue(id) {
  return sanitizeInput(document.getElementById(id).value);
}

function generateMissionOrder() {
  const numero  = getOMValue('omNumero');
  const date    = document.getElementById('omDate').value;
  const employe = getOMValue('omEmploye');
  const objet   = getOMValue('omObjet');

  if (!numero || !date || !employe || !objet) {
    toast('⚠️ Veuillez remplir les champs obligatoires (N°, date, collaborateur, objet).', 'error');
    return;
  }

  const depart    = getOMValue('omDepart') || '—';
  const arrivee   = getOMValue('omArrivee') || '—';
  const debut     = document.getElementById('omDebut').value || '—';
  const fin       = document.getElementById('omFin').value || '—';
  const transport = document.getElementById('omTransport').value;
  const remarques = getOMValue('omRemarques') || '—';
  const telephone = getOMValue('omTel') || '—';

  const fiche = document.getElementById('omFiche');
  fiche.innerHTML = `
    <div class="om-header">
      <div class="om-brand"><img src="logo.PNG" alt="Eqnovia" class="om-logo"/></div>
      <div class="om-title">ORDRE DE MISSION<small>N° ${esc(numero)}</small></div>
    </div>
    <div class="om-grid">
      <div class="om-field"><span class="om-label">Date d'émission</span><span class="om-value">${esc(date)}</span></div>
      <div class="om-field"><span class="om-label">Collaborateur</span><span class="om-value">${esc(employe)}</span></div>
      <div class="om-field"><span class="om-label">Lieu de départ</span><span class="om-value">${esc(depart)}</span></div>
      <div class="om-field"><span class="om-label">Lieu de destination</span><span class="om-value">${esc(arrivee)}</span></div>
      <div class="om-field"><span class="om-label">Date de début</span><span class="om-value">${esc(debut)}</span></div>
      <div class="om-field"><span class="om-label">Date de fin</span><span class="om-value">${esc(fin)}</span></div>
      <div class="om-field"><span class="om-label">Mode de transport</span><span class="om-value">${esc(transport)}</span></div>
      <div class="om-field"><span class="om-label">📱 Téléphone</span><span class="om-value om-phone-print">${esc(telephone)}</span></div>
    </div>
    <div class="om-objet">
      <span class="om-label">Objet de la mission</span>
      <span class="om-value">${esc(objet)}</span>
    </div>
    <div class="om-field full" style="margin-bottom:14px;">
      <span class="om-label">Remarques / instructions</span>
      <span class="om-value" style="font-weight:500;white-space:pre-wrap;">${esc(remarques)}</span>
    </div>
    <div class="om-sign">
      <div class="om-sign-box"><div class="om-sign-line">Le collaborateur</div></div>
      <div class="om-sign-box"><div class="om-sign-line">Le responsable</div></div>
    </div>
    <div class="om-footer">Document généré par Eqnovia — Notes de Frais • ${esc(numero)}</div>

  `;

  // Look up status & comment from history (if saved)
  const history = loadOMHistory();
  const saved = history.find(h => h.numero === numero && h.employe === employe);
  const status = (saved && saved._status) || 'pending';
  const comment = (saved && saved._comment) || '';
  
  const statusHtml = {
    approved: '<span class="status-badge approved">✅ Approuvé</span>',
    rejected: '<span class="status-badge rejected">❌ Rejeté</span>',
    pending: '<span class="status-badge pending">⏳ En attente de validation</span>'
  }[status] || '<span class="status-badge pending">⏳ En attente de validation</span>';
  
  // Append status after the sign section
  fiche.innerHTML += `
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--gray-200);text-align:center;">
      <div style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Statut de la mission</div>
      ${statusHtml}
      ${comment ? `<div style="margin-top:8px;padding:8px 14px;background:var(--gray-50);border-radius:var(--radius-md);font-size:11px;color:var(--gray-500);text-align:left;border-left:3px solid ${status === 'approved' ? 'var(--green)' : status === 'rejected' ? 'var(--red)' : 'var(--gray-300)'};"><strong>Message de l'administration :</strong><br>${esc(comment)}</div>` : ''}
      ${telephone && telephone !== '—' ? `<div style="margin-top:10px;" class="no-print"><a class="btn btn-primary" href="https://wa.me/${cleanPhone(telephone)}?text=${encodeURIComponent('Eqnovia - Ordre de mission N° ' + numero + '\n\nCollaborateur : ' + employe + '\nDate : ' + date + '\nTrajet : ' + depart + ' → ' + arrivee + '\nObjet : ' + objet + '\nTransport : ' + transport + '\n' + (remarques !== '—' ? 'Remarques : ' + remarques : ''))}" target="_blank" style="text-decoration:none;font-size:12px;padding:6px 16px;">💬 Envoyer par WhatsApp</a></div>` : ''}
    </div>
  `;

  document.getElementById('omPrintBtn').disabled = false;
  toast('✅ Fiche d\'ordre de mission générée.', 'success');
}

function resetMissionForm() {
  ['omNumero','omDate','omEmploye','omDepart','omArrivee','omDebut','omFin','omObjet','omTel','omRemarques'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('omTransport').value = 'Voiture';
  document.getElementById('omFiche').innerHTML =
    '<p style="color:var(--gray-400);font-size:13px;text-align:center;padding:40px 0;">🗒️ Remplissez le formulaire et cliquez sur « Générer la fiche » pour afficher la fiche d\'ordre de mission.</p>';
  document.getElementById('omPrintBtn').disabled = true;
}

function printMissionOrder() {
  if (document.getElementById('omPrintBtn').disabled) return;
  window.print();
}

// ════════════════════════════════════════════════════
// ORDRE DE MISSION — SAUVEGARDE & HISTORIQUE
// ════════════════════════════════════════════════════
const OM_STORAGE_KEY = 'eqnovia_om_history';

function loadOMHistory() {
  try { return JSON.parse(localStorage.getItem(OM_STORAGE_KEY)) || []; } catch(e) { return []; }
}
function saveOMHistory(history) {
  // Mark + sync last new item to Firebase BEFORE saving to localStorage
  const last = history[history.length - 1];
  if (useFirebase && last && !last._syncedToFB) {
    last._syncedToFB = true;
    last._localId = last._localId || (Date.now() + '_' + history.length);
    fbAddOM(last);
  }
  localStorage.setItem(OM_STORAGE_KEY, JSON.stringify(history));
}

function renderOMHistory() {
  const history = loadOMHistory();
  const container = document.getElementById('omHistoryList');
  if (!container) return;
  if (!history.length) {
    container.innerHTML = '<p style="font-size:12px;color:var(--gray-400);padding:8px 0;">Aucun ordre de mission enregistré.</p>';
    return;
  }
  container.innerHTML = history.slice().reverse().map((om, i) => {
    const idx = history.length - 1 - i;
    const s = om._status || 'pending';
    const statusIcon = {approved:'✅', rejected:'❌', pending:'⏳'}[s] || '⏳';
    const statusCls = {approved:'approved', rejected:'rejected', pending:'pending'}[s] || 'pending';
    return `
    <div class="om-history-item">
      <div>
        <div class="om-h-num">${esc(om.numero)}</div>
        <div class="om-h-employe">${esc(om.employe)}</div>
        <div class="om-h-date" style="margin-top:2px;">${esc(om.date)}</div>
      </div>
      <div style="text-align:right;">
        <span class="status-badge ${statusCls}" style="font-size:9px;padding:1px 8px;">${statusIcon} ${s === 'approved' ? 'Approuvé' : s === 'rejected' ? 'Rejeté' : 'En attente'}</span>
      </div>
      <div class="om-h-actions">
        <button class="om-h-action view" onclick="event.stopPropagation();viewOM(${idx})" title="Consulter">👁️</button>
        <button class="om-h-action edit" onclick="event.stopPropagation();editOM(${idx})" title="Modifier">✏️</button>
        <button class="om-h-action pdf" onclick="event.stopPropagation();exportSingleOMPDF(${idx})" title="Télécharger PDF">📄</button>
        <button class="om-h-action del" onclick="event.stopPropagation();deleteOM(${idx})" title="Supprimer">✕</button>
      </div>
    </div>`;
  }).join('');
}

function editOM(index) {
  const history = loadOMHistory();
  const om = history[index];
  if (!om) return toast('Ordre de mission introuvable.', 'err');
  
  // Load data into the form fields
  document.getElementById('omNumero').value = om.numero || '';
  document.getElementById('omDate').value = om.date || '';
  document.getElementById('omEmploye').value = om.employe || '';
  document.getElementById('omDepart').value = om.depart || '';
  document.getElementById('omArrivee').value = om.arrivee || '';
  document.getElementById('omDebut').value = om.debut || '';
  document.getElementById('omFin').value = om.fin || '';
  document.getElementById('omTransport').value = om.transport || 'Voiture';
  document.getElementById('omObjet').value = om.objet || '';
  document.getElementById('omTel').value = om.tel || '';
  document.getElementById('omRemarques').value = om.remarques || '';
  
  // Switch to the mission tab
  switchTab('mission');
  // Scroll to the top of the OM panel
  document.getElementById('omNumero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('✏️ Ordre de mission chargé dans le formulaire.', 'ok');
}

function viewOM(index) {
  const history = loadOMHistory();
  const om = history[index];
  if (!om) return toast('Ordre de mission introuvable.', 'err');
  
  // Load into form, generate the fiche, and scroll to it
  editOM(index);
  generateMissionOrder();
  document.getElementById('omFiche')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('👁️ Fiche affichée.', 'ok');
}

function exportSingleOMPDF(index) {
  const history = loadOMHistory();
  const om = history[index];
  if (!om) return toast('Ordre de mission introuvable.', 'err');
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Logo
    try { doc.addImage('logo.PNG', 'PNG', 14, 10, 30, 10); } catch(e) { /* fallback */ }
    
    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`ORDRE DE MISSION N° ${om.numero || 'N/A'}`, 105, 22, { align: 'center' });
    
    // Separator
    doc.setDrawColor(11, 79, 158);
    doc.setLineWidth(0.8);
    doc.line(14, 27, 196, 27);
    
    // Info box
    const leftX = 18;
    let y = 33;
    doc.setFontSize(10);
    
    const fields = [
      ['Date d\'émission', om.date || '—'],
      ['Collaborateur', om.employe || '—'],
      ['Lieu de départ', om.depart || '—'],
      ['Lieu de destination', om.arrivee || '—'],
      ['Date de début', om.debut || '—'],
      ['Date de fin', om.fin || '—'],
      ['Mode de transport', om.transport || '—'],
      ['Téléphone', om.tel || '—'],
    ];
    
    fields.forEach(([label, value], fi) => {
      const col = fi % 2;
      const row = Math.floor(fi / 2);
      const x = col === 0 ? leftX : 105;
      const yy = y + row * 8;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168);
      doc.text(label.toUpperCase(), x, yy);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(53, 61, 79);
      doc.text(value, x, yy + 4);
      
      // Underline
      doc.setDrawColor(221, 225, 234);
      doc.setLineWidth(0.3);
      doc.line(x, yy + 5.5, col === 0 ? 100 : 196, yy + 5.5);
    });
    
    const objY = y + Math.ceil(fields.length / 2) * 8 + 6;
    
    // Object box
    doc.setFillColor(235, 243, 251);
    doc.setDrawColor(200, 223, 245);
    doc.roundedRect(leftX - 2, objY, 176, 16, 2, 2, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(11, 79, 158);
    doc.text('OBJET DE LA MISSION', leftX + 2, objY + 5);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(53, 61, 79);
    doc.text(om.objet || '—', leftX + 2, objY + 12);
    
    // Remarks
    let lines;
    if (om.remarques && om.remarques !== '—') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168);
      doc.text('REMARQUES / INSTRUCTIONS', leftX, objY + 23);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(53, 61, 79);
      lines = doc.splitTextToSize(om.remarques, 175);
      doc.text(lines, leftX, objY + 30);
    }
    
    // Status
    const statusLabel = {approved:'APPROUVÉ ✅', rejected:'REJETÉ ❌', pending:'EN ATTENTE ⏳'}[om._status] || 'EN ATTENTE';
    const linesHeight = (om.remarques && om.remarques !== '—' && lines) ? lines.length * 4 : 0;
    const statusY = objY + (om.remarques && om.remarques !== '—' ? 34 + linesHeight : 28);
    
    doc.setDrawColor(221, 225, 234);
    doc.setLineWidth(0.5);
    doc.line(leftX, statusY, 196, statusY);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(142, 151, 168);
    doc.text('STATUT', 105, statusY + 7, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(11, 79, 158);
    doc.text(statusLabel, 105, statusY + 14, { align: 'center' });
    
    // Comment
    let commentLines;
    if (om._comment) {
      doc.setFontSize(9);
      doc.setTextColor(99, 110, 130);
      commentLines = doc.splitTextToSize(`Message : ${om._comment}`, 170);
      doc.text(commentLines, 105, statusY + 21, { align: 'center' });
    }
    
    // Signature section
    const commentHeight = (om._comment && commentLines) ? commentLines.length * 4 : 0;
    const sigY = statusY + (om._comment ? 26 + commentHeight : 22);
    doc.setDrawColor(142, 151, 168);
    doc.setLineWidth(0.3);
    
    // Left signature line
    doc.line(30, sigY + 12, 85, sigY + 12);
    doc.setFontSize(8);
    doc.setTextColor(142, 151, 168);
    doc.text('Le collaborateur', 57.5, sigY + 17, { align: 'center' });
    
    // Right signature line
    doc.setLineWidth(0.3);
    doc.line(110, sigY + 12, 165, sigY + 12);
    doc.text('Le responsable', 137.5, sigY + 17, { align: 'center' });
    
    // Footer
    const footerY = 285;
    doc.setDrawColor(221, 225, 234);
    doc.setLineWidth(0.3);
    doc.line(14, footerY, 196, footerY);
    doc.setFontSize(7);
    doc.setTextColor(142, 151, 168);
    doc.text(`Document généré par Eqnovia — Notes de Frais • ${om.numero || 'N/A'}`, 105, footerY + 5, { align: 'center' });
    doc.text(`Date: ${om.date || '—'}`, 105, footerY + 10, { align: 'center' });
    
    doc.save(`Ordre_Mission_${om.numero || 'sans_numero'}.pdf`);
    toast('📄 PDF téléchargé.', 'ok');
  } catch (e) {
    console.warn('PDF export failed:', e);
    toast('❌ Erreur lors de la création du PDF.', 'err');
  }
}

function deleteOM(index) {
  const history = loadOMHistory();
  const removed = history.splice(index, 1)[0];
  saveOMHistory(history);
  // Also delete from Firebase if it was synced
  if (useFirebase && removed && removed._localId) {
    fbDeleteOM(removed._localId);
  }
  renderOMHistory();
  toast('🗑️ Ordre de mission supprimé.', 'ok');
}


// Override generateMissionOrder to save history
const _origGenerate = generateMissionOrder;
generateMissionOrder = async function() {
  _origGenerate();
  // Only save if generation succeeded (print button enabled = fiche generated)
  if (document.getElementById('omPrintBtn').disabled) return;
  const history = loadOMHistory();
  const employeName = document.getElementById('omEmploye').value;
  history.push({
    numero: document.getElementById('omNumero').value,
    date: document.getElementById('omDate').value,
    employe: employeName,
    depart: document.getElementById('omDepart').value,
    arrivee: document.getElementById('omArrivee').value,
    debut: document.getElementById('omDebut').value,
    fin: document.getElementById('omFin').value,
    transport: document.getElementById('omTransport').value,
    objet: document.getElementById('omObjet').value,
    remarques: document.getElementById('omRemarques').value,
    email: findUserEmail(employeName),
    tel: document.getElementById('omTel').value
  });
  saveOMHistory(history);
  renderOMHistory();

  // Also save to missionOrdersCache (new system) so it appears in "My OM"
  const mo = {
    numero: document.getElementById('omNumero').value,
    date: document.getElementById('omDate').value,
    employe: employeName,
    depart: document.getElementById('omDepart').value || '—',
    arrivee: document.getElementById('omArrivee').value || '—',
    debut: document.getElementById('omDebut').value || '—',
    fin: document.getElementById('omFin').value || '—',
    transport: document.getElementById('omTransport').value,
    objet: document.getElementById('omObjet').value,
    remarques: document.getElementById('omRemarques').value || '—',
    tel: document.getElementById('omTel').value || '—',
    status: 'pending',
    _localId: 'om_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  };

  // Find the local user key for the selected employee
  const localUserKey = Object.entries(USERS).find(([k, u]) => u.label === employeName);
  if (localUserKey) {
    mo.assignedTo = localUserKey[0];
  }

  // Get Firebase Auth UID for the assigned user
  if (useFirebase && mo.assignedTo) {
    const authUid = await getAuthUidForUser(mo.assignedTo);
    if (authUid) {
      mo.assignedToAuthUid = authUid;
    }
  }

  // Set creator's auth UID so they can also see the OM in their list
  const currentAuthUid = getAuthUid();
  if (currentAuthUid) {
    mo._authUid = currentAuthUid;
  }

  missionOrdersCache.push(mo);
  try { localStorage.setItem('eqnovia_mission_orders', JSON.stringify(missionOrdersCache)); } catch(e) {}

  // Sync to Firebase
  if (useFirebase) {
    const fbId = await fbAddMissionOrder(mo);
    if (fbId) {
      mo._firebaseId = fbId;
      try { localStorage.setItem('eqnovia_mission_orders', JSON.stringify(missionOrdersCache)); } catch(e) {}
    }
  }

  // Refresh user mission orders display
  renderDashboardMissionOrders();
  renderUserMissionOrders();
};

function loadUserMissionOrders() {
  renderUserMissionOrders();
}

function exportUserMissionsPDF() {
  const data = dataUserMissionOrders();
  if (!data.length) {
    toast('Aucun ordre de mission à exporter.', 'err');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l','mm','a4');
  
  // Header with Eqnovia logo
  try { doc.addImage('logo.PNG', 'PNG', 20, 12, 16, 12); } catch(e) { /* fallback */ }
  doc.setFontSize(8); doc.setTextColor(247,147,30); doc.setFont(undefined,'normal');
  doc.text('Notes de Frais', 38, 22);
  doc.setFontSize(14); doc.setTextColor(53,61,79); doc.setFont(undefined,'bold');
  doc.text('Mes ordres de mission', 148, 20, {align:'center'});
  doc.setFontSize(8); doc.setTextColor(142,151,168);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${data.length} OM`, 148, 26, {align:'center'});
  doc.setDrawColor(11,79,158); doc.line(20, 30, 290, 30);

  // Build table
  const rows = data.slice().reverse().map(mo => [
    mo.numero || '—',
    mo.employe || '—',
    mo.date || '—',
    (mo.depart||'') + ' → ' + (mo.arrivee||''),
    (mo.objet||'').substring(0,30),
    mo.transport || '—',
    {approved:'✅ Approuvé', rejected:'❌ Rejeté', pending:'⏳ En attente'}[mo.status] || 'En attente'
  ]);

  doc.autoTable({
    startY: 35, head: [['N° OM','Collaborateur','Date','Trajet','Objet','Transport','Statut']],
    body: rows, margin: {left:15, right:15},
    theme: 'grid', headStyles: {fillColor: [11,79,158], fontSize:7},
    bodyStyles: {fontSize:6}, styles: {cellPadding:2},
    didDrawPage: (d) => { /* footer handled below */ }
  });

  const fy = doc.lastAutoTable.finalY + 6;
  doc.setDrawColor(200); doc.line(15, fy, 280, fy);
  doc.setFontSize(7); doc.setTextColor(142,151,168);
  doc.text('eqnovia · Notes de Frais · Mes ordres de mission', 148, fy + 4, {align:'center'});
  doc.save(`mes_om_${new Date().toISOString().split('T')[0]}.pdf`);
  toast('📄 Export PDF de mes OM téléchargé !');
}

function viewAdminMO(docId) {
  const mo = missionOrdersCache.find(m => m._firebaseId === docId || m._localId === docId);
  if (!mo) return toast('Ordre de mission introuvable.', 'err');
  
  // Generate the fiche in the mission tab
  document.getElementById('omNumero').value = mo.numero || '';
  document.getElementById('omDate').value = mo.date || '';
  document.getElementById('omEmploye').value = mo.employe || '';
  document.getElementById('omDepart').value = mo.depart || '';
  document.getElementById('omArrivee').value = mo.arrivee || '';
  document.getElementById('omDebut').value = mo.debut || '';
  document.getElementById('omFin').value = mo.fin || '';
  document.getElementById('omTransport').value = mo.transport || 'Voiture';
  document.getElementById('omObjet').value = mo.objet || '';
  document.getElementById('omTel').value = mo.tel || '';
  document.getElementById('omRemarques').value = mo.remarques || '';
  
  switchTab('mission');
  generateMissionOrder();
  document.getElementById('omFiche')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('👁️ Fiche affichée.', 'ok');
}

function exportAdminOMPDF(docId) {
  const mo = missionOrdersCache.find(m => m._firebaseId === docId || m._localId === docId);
  if (!mo) return toast('Ordre de mission introuvable.', 'err');
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Logo
    try { doc.addImage('logo.PNG', 'PNG', 14, 10, 30, 10); } catch(e) { /* fallback */ }
    
    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`ORDRE DE MISSION N° ${mo.numero || 'N/A'}`, 105, 22, { align: 'center' });
    
    // Separator
    doc.setDrawColor(11, 79, 158);
    doc.setLineWidth(0.8);
    doc.line(14, 27, 196, 27);
    
    // Info box
    const leftX = 18;
    let y = 33;
    doc.setFontSize(10);
    
    const fields = [
      ['Date d\'émission', mo.date || '—'],
      ['Collaborateur', mo.employe || '—'],
      ['Assigné à', USERS[mo.assignedTo] ? USERS[mo.assignedTo].label : (mo.assignedTo || '—')],
      ['Lieu de départ', mo.depart || '—'],
      ['Lieu de destination', mo.arrivee || '—'],
      ['Date de début', mo.debut || '—'],
      ['Date de fin', mo.fin || '—'],
      ['Mode de transport', mo.transport || '—'],
      ['Téléphone', mo.tel || '—'],
    ];
    
    fields.forEach(([label, value], fi) => {
      const col = fi % 2;
      const row = Math.floor(fi / 2);
      const x = col === 0 ? leftX : 105;
      const yy = y + row * 8;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168);
      doc.text(label.toUpperCase(), x, yy);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(53, 61, 79);
      doc.text(value, x, yy + 4);
      
      // Underline
      doc.setDrawColor(221, 225, 234);
      doc.setLineWidth(0.3);
      doc.line(x, yy + 5.5, col === 0 ? 100 : 196, yy + 5.5);
    });
    
    const objY = y + Math.ceil(fields.length / 2) * 8 + 6;
    
    // Object box
    doc.setFillColor(235, 243, 251);
    doc.setDrawColor(200, 223, 245);
    doc.roundedRect(leftX - 2, objY, 176, 16, 2, 2, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(11, 79, 158);
    doc.text('OBJET DE LA MISSION', leftX + 2, objY + 5);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(53, 61, 79);
    doc.text(mo.objet || '—', leftX + 2, objY + 12);
    
    // Remarks
    let lines;
    if (mo.remarques && mo.remarques !== '—') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168);
      doc.text('REMARQUES / INSTRUCTIONS', leftX, objY + 23);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(53, 61, 79);
      lines = doc.splitTextToSize(mo.remarques, 175);
      doc.text(lines, leftX, objY + 30);
    }
    
    // Status
    const statusLabel = {approved:'APPROUVÉ ✅', rejected:'REJETÉ ❌', pending:'EN ATTENTE ⏳'}[mo.status] || 'EN ATTENTE';
    const linesHeight = (mo.remarques && mo.remarques !== '—' && lines) ? lines.length * 4 : 0;
    const statusY = objY + (mo.remarques && mo.remarques !== '—' ? 34 + linesHeight : 28);
    
    doc.setDrawColor(221, 225, 234);
    doc.setLineWidth(0.5);
    doc.line(leftX, statusY, 196, statusY);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(142, 151, 168);
    doc.text('STATUT', 105, statusY + 7, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(11, 79, 158);
    doc.text(statusLabel, 105, statusY + 14, { align: 'center' });
    
    // Comment
    let commentLines;
    if (mo.comment) {
      doc.setFontSize(9);
      doc.setTextColor(99, 110, 130);
      commentLines = doc.splitTextToSize(`Message : ${mo.comment}`, 170);
      doc.text(commentLines, 105, statusY + 21, { align: 'center' });
    }
    
    // Signature section
    const commentHeight = (mo.comment && commentLines) ? commentLines.length * 4 : 0;
    const sigY = statusY + (mo.comment ? 26 + commentHeight : 22);
    doc.setDrawColor(142, 151, 168);
    doc.setLineWidth(0.3);
    
    // Left signature line
    doc.line(30, sigY + 12, 85, sigY + 12);
    doc.setFontSize(8);
    doc.setTextColor(142, 151, 168);
    doc.text('Le collaborateur', 57.5, sigY + 17, { align: 'center' });
    
    // Right signature line
    doc.setLineWidth(0.3);
    doc.line(110, sigY + 12, 165, sigY + 12);
    doc.text('Le responsable', 137.5, sigY + 17, { align: 'center' });
    
    // Footer
    const footerY = 285;
    doc.setDrawColor(221, 225, 234);
    doc.setLineWidth(0.3);
    doc.line(14, footerY, 196, footerY);
    doc.setFontSize(7);
    doc.setTextColor(142, 151, 168);
    doc.text(`Document généré par Eqnovia — Notes de Frais • ${mo.numero || 'N/A'}`, 105, footerY + 5, { align: 'center' });
    doc.text(`Date: ${mo.date || '—'}`, 105, footerY + 10, { align: 'center' });
    
    doc.save(`Ordre_Mission_${mo.numero || 'sans_numero'}.pdf`);
    toast('📄 PDF téléchargé.', 'ok');
  } catch (e) {
    console.warn('PDF export failed:', e);
    toast('❌ Erreur lors de la création du PDF.', 'err');
  }
}

// ════════════════════════════════════════════
// MISSION ORDERS — USER DASHBOARD
// ════════════════════════════════════════════
function renderUserMissionOrders() {
  const data = dataUserMissionOrders();
  const container = document.getElementById('userMOList');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>Aucun ordre de mission</h3><p>Vous n\'avez aucun ordre de mission assigné pour le moment.</p></div>';
    return;
  }

  container.innerHTML = data.slice().reverse().map(mo => {
    const statusClass = {approved: 'approved', rejected: 'rejected', pending: 'pending'}[mo.status] || 'pending';
    const statusIcon = {approved: '✅', rejected: '❌', pending: '⏳'}[mo.status] || '⏳';
    const statusLabel = {approved: 'Approuvé', rejected: 'Rejeté', pending: 'En attente'}[mo.status] || 'En attente';
    
    return `
    <div class="om-history-item">
      <div style="flex:1;min-width:0;">
        <div class="om-h-num">${esc(mo.numero)}</div>
        <div class="om-h-employe">${esc(mo.employe)}</div>
        <div class="om-h-date" style="margin-top:2px;">${esc(mo.date)}</div>
        <div style="font-size:10px;color:var(--gray-400);margin-top:2px;">${esc(mo.depart || '...')} → ${esc(mo.arrivee || '...')}</div>
      </div>
      <div style="text-align:right;">
        <span class="status-badge ${statusClass}" style="font-size:9px;padding:1px 8px;">${statusIcon} ${statusLabel}</span>
      </div>
      <div class="om-h-actions">
        <button class="om-h-action view" onclick="viewUserMO('${mo._firebaseId || mo._localId}')" title="Consulter">👁️</button>
        <button class="om-h-action pdf" onclick="exportUserOMPDF('${mo._firebaseId || mo._localId}')" title="Télécharger PDF">📄</button>
        <button class="om-h-action" onclick="sendUserMOByEmail('${mo._firebaseId || mo._localId}')" title="Envoyer par Email" style="background:var(--eq-blue-pale);color:var(--eq-blue);">📧</button>
        ${navigator.share ? `<button class="om-h-action" onclick="shareMOByWebShare('${mo._firebaseId || mo._localId}')" title="Partager" style="background:var(--gray-100);color:var(--gray-600);">📤</button>` : ''}
        ${mo.tel && mo.tel !== '—' && mo.tel.length > 5 ? `<button class="om-h-action" onclick="sendUserMOByWhatsApp('${mo._firebaseId || mo._localId}')" title="WhatsApp" style="background:var(--green-pale);color:var(--green);">💬</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
// MISSION ORDERS — DASHBOARD (USER HOME)
// ════════════════════════════════════════════
function renderDashboardMissionOrders() {
  if (isAdmin) return; // Admin doesn't see this in dashboard
  
  const data = dataUserMissionOrders();
  const container = document.getElementById('dashboardMOList');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>Aucun ordre de mission</h3><p>Vous n\'avez aucun ordre de mission assigné pour le moment.</p></div>';
    return;
  }

  container.innerHTML = data.slice().reverse().map(mo => {
    const statusClass = {approved: 'approved', rejected: 'rejected', pending: 'pending'}[mo.status] || 'pending';
    const statusIcon = {approved: '✅', rejected: '❌', pending: '⏳'}[mo.status] || '⏳';
    const statusLabel = {approved: 'Approuvé', rejected: 'Rejeté', pending: 'En attente'}[mo.status] || 'En attente';
    
    return `
    <div class="om-history-item">
      <div style="flex:1;min-width:0;">
        <div class="om-h-num">${esc(mo.numero)}</div>
        <div class="om-h-employe">${esc(mo.employe)}</div>
        <div class="om-h-date" style="margin-top:2px;">${esc(mo.date)}</div>
        <div style="font-size:10px;color:var(--gray-400);margin-top:2px;">${esc(mo.depart || '...')} → ${esc(mo.arrivee || '...')}</div>
      </div>
      <div style="text-align:right;">
        <span class="status-badge ${statusClass}" style="font-size:9px;padding:1px 8px;">${statusIcon} ${statusLabel}</span>
      </div>
      <div class="om-h-actions">
        <button class="om-h-action view" onclick="viewUserMO('${mo._firebaseId || mo._localId}')" title="Consulter">👁️</button>
        <button class="om-h-action pdf" onclick="exportUserOMPDF('${mo._firebaseId || mo._localId}')" title="Télécharger PDF">📄</button>
        <button class="om-h-action" onclick="sendUserMOByEmail('${mo._firebaseId || mo._localId}')" title="Envoyer par Email" style="background:var(--eq-blue-pale);color:var(--eq-blue);">📧</button>
        ${navigator.share ? `<button class="om-h-action" onclick="shareMOByWebShare('${mo._firebaseId || mo._localId}')" title="Partager" style="background:var(--gray-100);color:var(--gray-600);">📤</button>` : ''}
        ${mo.tel && mo.tel !== '—' && mo.tel.length > 5 ? `<button class="om-h-action" onclick="sendUserMOByWhatsApp('${mo._firebaseId || mo._localId}')" title="WhatsApp" style="background:var(--green-pale);color:var(--green);">💬</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function viewUserMO(docId) {
  const mo = missionOrdersCache.find(m => m._firebaseId === docId || m._localId === docId);
  if (!mo) return toast('Ordre de mission introuvable.', 'err');
  
  document.getElementById('omNumero').value = mo.numero || '';
  document.getElementById('omDate').value = mo.date || '';
  document.getElementById('omEmploye').value = mo.employe || '';
  document.getElementById('omDepart').value = mo.depart || '';
  document.getElementById('omArrivee').value = mo.arrivee || '';
  document.getElementById('omDebut').value = mo.debut || '';
  document.getElementById('omFin').value = mo.fin || '';
  document.getElementById('omTransport').value = mo.transport || 'Voiture';
  document.getElementById('omObjet').value = mo.objet || '';
  document.getElementById('omTel').value = mo.tel || '';
  document.getElementById('omRemarques').value = mo.remarques || '';
  
  switchTab('mission');
  generateMissionOrder();
  document.getElementById('omFiche')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('👁️ Fiche affichée.', 'ok');
}

function exportUserOMPDF(docId) {
  const mo = missionOrdersCache.find(m => m._firebaseId === docId || m._localId === docId);
  if (!mo) return toast('Ordre de mission introuvable.', 'err');
  
  // Reuse the same PDF export function
  exportSingleOMPDFByData(mo);
}

function exportSingleOMPDFByData(mo) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Logo
    try { doc.addImage('logo.PNG', 'PNG', 14, 10, 30, 10); } catch(e) { /* fallback */ }
    
    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`ORDRE DE MISSION N° ${mo.numero || 'N/A'}`, 105, 22, { align: 'center' });
    
    // Separator
    doc.setDrawColor(11, 79, 158);
    doc.setLineWidth(0.8);
    doc.line(14, 27, 196, 27);
    
    // Info box
    const leftX = 18;
    let y = 33;
    doc.setFontSize(10);
    
    const fields = [
      ['Date d\'émission', mo.date || '—'],
      ['Collaborateur', mo.employe || '—'],
      ['Lieu de départ', mo.depart || '—'],
      ['Lieu de destination', mo.arrivee || '—'],
      ['Date de début', mo.debut || '—'],
      ['Date de fin', mo.fin || '—'],
      ['Mode de transport', mo.transport || '—'],
      ['Téléphone', mo.tel || '—'],
    ];
    
    fields.forEach(([label, value], fi) => {
      const col = fi % 2;
      const row = Math.floor(fi / 2);
      const x = col === 0 ? leftX : 105;
      const yy = y + row * 8;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168);
      doc.text(label.toUpperCase(), x, yy);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(53, 61, 79);
      doc.text(value, x, yy + 4);
      
      // Underline
      doc.setDrawColor(221, 225, 234);
      doc.setLineWidth(0.3);
      doc.line(x, yy + 5.5, col === 0 ? 100 : 196, yy + 5.5);
    });
    
    const objY = y + Math.ceil(fields.length / 2) * 8 + 6;
    
    // Object box
    doc.setFillColor(235, 243, 251);
    doc.setDrawColor(200, 223, 245);
    doc.roundedRect(leftX - 2, objY, 176, 16, 2, 2, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(11, 79, 158);
    doc.text('OBJET DE LA MISSION', leftX + 2, objY + 5);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(53, 61, 79);
    doc.text(mo.objet || '—', leftX + 2, objY + 12);
    
    // Remarks
    let lines;
    if (mo.remarques && mo.remarques !== '—') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168);
      doc.text('REMARQUES / INSTRUCTIONS', leftX, objY + 23);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(53, 61, 79);
      lines = doc.splitTextToSize(mo.remarques, 175);
      doc.text(lines, leftX, objY + 30);
    }
    
    // Status
    const statusLabel = {approved:'APPROUVÉ ✅', rejected:'REJETÉ ❌', pending:'EN ATTENTE ⏳'}[mo.status] || 'EN ATTENTE';
    const linesHeight = (mo.remarques && mo.remarques !== '—' && lines) ? lines.length * 4 : 0;
    const statusY = objY + (mo.remarques && mo.remarques !== '—' ? 34 + linesHeight : 28);
    
    doc.setDrawColor(221, 225, 234);
    doc.setLineWidth(0.5);
    doc.line(leftX, statusY, 196, statusY);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(142, 151, 168);
    doc.text('STATUT', 105, statusY + 7, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(11, 79, 158);
    doc.text(statusLabel, 105, statusY + 14, { align: 'center' });
    
    // Comment
    let commentLines;
    if (mo.comment) {
      doc.setFontSize(9);
      doc.setTextColor(99, 110, 130);
      commentLines = doc.splitTextToSize(`Message : ${mo.comment}`, 170);
      doc.text(commentLines, 105, statusY + 21, { align: 'center' });
    }
    
    // Signature section
    const commentHeight = (mo.comment && commentLines) ? commentLines.length * 4 : 0;
    const sigY = statusY + (mo.comment ? 26 + commentHeight : 22);
    doc.setDrawColor(142, 151, 168);
    doc.setLineWidth(0.3);
    
    // Left signature line
    doc.line(30, sigY + 12, 85, sigY + 12);
    doc.setFontSize(8);
    doc.setTextColor(142, 151, 168);
    doc.text('Le collaborateur', 57.5, sigY + 17, { align: 'center' });
    
    // Right signature line
    doc.setLineWidth(0.3);
    doc.line(110, sigY + 12, 165, sigY + 12);
    doc.text('Le responsable', 137.5, sigY + 17, { align: 'center' });
    
    // Footer
    const footerY = 285;
    doc.setDrawColor(221, 225, 234);
    doc.setLineWidth(0.3);
    doc.line(14, footerY, 196, footerY);
    doc.setFontSize(7);
    doc.setTextColor(142, 151, 168);
    doc.text(`Document généré par Eqnovia — Notes de Frais • ${mo.numero || 'N/A'}`, 105, footerY + 5, { align: 'center' });
    doc.text(`Date: ${mo.date || '—'}`, 105, footerY + 10, { align: 'center' });
    
    doc.save(`Ordre_Mission_${mo.numero || 'sans_numero'}.pdf`);
    toast('📄 PDF téléchargé.', 'ok');
  } catch (e) {
    console.warn('PDF export failed:', e);
    toast('❌ Erreur lors de la création du PDF.', 'err');
  }
}

// ════════════════════════════════════════════
// MISSION ORDERS — EMAIL & WHATSAPP
// ════════════════════════════════════════════
async function sendMOByEmail(docId) {
  const mo = missionOrdersCache.find(m => m._firebaseId === docId || m._localId === docId);
  if (!mo) return toast('Ordre de mission introuvable.', 'err');
  
  const assignedUser = USERS[mo.assignedTo];
  const recipientEmail = assignedUser ? assignedUser.email : '';
  
  if (!recipientEmail) {
    return toast('Aucune adresse email trouvée pour ce collaborateur.', 'err');
  }
  
  // Try to send PDF via EmailJS if available
  if (window.emailjs && EMAILJS_CONFIG.serviceID && !EMAILJS_CONFIG.serviceID.includes('xxxxxxx')) {
    try {
      // Generate PDF as base64
      const pdfBase64 = await generatePDFBase64(mo);
      
      await emailjs.send(EMAILJS_CONFIG.serviceID, EMAILJS_CONFIG.templateID, {
        to_email: recipientEmail,
        to_name: mo.employe || 'Collaborateur',
        numero: mo.numero || 'N/A',
        date: mo.date || '—',
        employe: mo.employe || '—',
        depart: mo.depart || '—',
        arrivee: mo.arrivee || '—',
        debut: mo.debut || '—',
        fin: mo.fin || '—',
        objet: mo.objet || '—',
        transport: mo.transport || '—',
        remarques: mo.remarques && mo.remarques !== '—' ? mo.remarques : '',
        comment: mo.comment || '',
        subject: `Ordre de mission N° ${mo.numero} — Eqnovia`,
        pdf_attachment: pdfBase64,
        pdf_filename: `Ordre_Mission_${mo.numero || 'sans_numero'}.pdf`
      });
      toast('📧 Email avec PDF envoyé avec succès !', 'ok');
      return;
    } catch (e) {
      console.warn('EmailJS PDF send failed, falling back to mailto:', e);
    }
  }
  
  // Fallback: open email client with text
  const subject = `Ordre de mission N° ${mo.numero} — Eqnovia`;
  const body = `Bonjour ${mo.employe},\n\nVeuillez trouver ci-joint votre ordre de mission N° ${mo.numero}.\n\nDétails :\n- Date d'émission : ${mo.date}\n- Lieu de départ : ${mo.depart}\n- Lieu de destination : ${mo.arrivee}\n- Date de début : ${mo.debut}\n- Date de fin : ${mo.fin}\n- Objet : ${mo.objet}\n- Mode de transport : ${mo.transport}\n\n${mo.remarques && mo.remarques !== '—' ? 'Remarques : ' + mo.remarques : ''}\n\nCordialement,\nL'administration Eqnovia`;
  
  window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  toast('📧 Ouverture du client email...', 'ok');
}

async function sendUserMOByEmail(docId) {
  const mo = missionOrdersCache.find(m => m._firebaseId === docId || m._localId === docId);
  if (!mo) return toast('Ordre de mission introuvable.', 'err');
  
  const assignedUser = USERS[mo.assignedTo];
  const recipientEmail = assignedUser ? assignedUser.email : '';
  
  if (!recipientEmail) {
    return toast('Aucune adresse email trouvée pour ce collaborateur.', 'err');
  }
  
  // Try to send PDF via EmailJS if available
  if (window.emailjs && EMAILJS_CONFIG.serviceID && !EMAILJS_CONFIG.serviceID.includes('xxxxxxx')) {
    try {
      // Generate PDF as base64
      const pdfBase64 = await generatePDFBase64(mo);
      
      await emailjs.send(EMAILJS_CONFIG.serviceID, EMAILJS_CONFIG.templateID, {
        to_email: recipientEmail,
        to_name: mo.employe || 'Collaborateur',
        numero: mo.numero || 'N/A',
        date: mo.date || '—',
        employe: mo.employe || '—',
        depart: mo.depart || '—',
        arrivee: mo.arrivee || '—',
        debut: mo.debut || '—',
        fin: mo.fin || '—',
        objet: mo.objet || '—',
        transport: mo.transport || '—',
        remarques: mo.remarques && mo.remarques !== '—' ? mo.remarques : '',
        comment: mo.comment || '',
        subject: `Mon ordre de mission N° ${mo.numero} — Eqnovia`,
        pdf_attachment: pdfBase64,
        pdf_filename: `Ordre_Mission_${mo.numero || 'sans_numero'}.pdf`
      });
      toast('📧 Email avec PDF envoyé avec succès !', 'ok');
      return;
    } catch (e) {
      console.warn('EmailJS PDF send failed, falling back to mailto:', e);
    }
  }
  
  // Fallback: open email client with text
  const subject = `Mon ordre de mission N° ${mo.numero} — Eqnovia`;
  const body = `Bonjour ${mo.employe},\n\nVeuillez trouver ci-joint votre ordre de mission N° ${mo.numero}.\n\nDétails :\n- Date d'émission : ${mo.date}\n- Lieu de départ : ${mo.depart}\n- Lieu de destination : ${mo.arrivee}\n- Date de début : ${mo.debut}\n- Date de fin : ${mo.fin}\n- Objet : ${mo.objet}\n- Mode de transport : ${mo.transport}\n\n${mo.remarques && mo.remarques !== '—' ? 'Remarques : ' + mo.remarques : ''}\n\nCordialement,\nL'administration Eqnovia`;
  
  window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  toast('📧 Ouverture du client email...', 'ok');
}

// Generate PDF as base64 string for email attachment
async function generatePDFBase64(mo) {
  return new Promise((resolve, reject) => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // Logo
      try { doc.addImage('logo.PNG', 'PNG', 14, 10, 30, 10); } catch(e) { /* fallback */ }
      
      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`ORDRE DE MISSION N° ${mo.numero || 'N/A'}`, 105, 22, { align: 'center' });
      
      // Separator
      doc.setDrawColor(11, 79, 158);
      doc.setLineWidth(0.8);
      doc.line(14, 27, 196, 27);
      
      // Info box
      const leftX = 18;
      let y = 33;
      doc.setFontSize(10);
      
      const fields = [
        ['Date d\'émission', mo.date || '—'],
        ['Collaborateur', mo.employe || '—'],
        ['Lieu de départ', mo.depart || '—'],
        ['Lieu de destination', mo.arrivee || '—'],
        ['Date de début', mo.debut || '—'],
        ['Date de fin', mo.fin || '—'],
        ['Mode de transport', mo.transport || '—'],
        ['Téléphone', mo.tel || '—'],
      ];
      
      fields.forEach(([label, value], fi) => {
        const col = fi % 2;
        const row = Math.floor(fi / 2);
        const x = col === 0 ? leftX : 105;
        const yy = y + row * 8;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(142, 151, 168);
        doc.text(label.toUpperCase(), x, yy);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(53, 61, 79);
        doc.text(value, x, yy + 4);
        
        // Underline
        doc.setDrawColor(221, 225, 234);
        doc.setLineWidth(0.3);
        doc.line(x, yy + 5.5, col === 0 ? 100 : 196, yy + 5.5);
      });
      
      const objY = y + Math.ceil(fields.length / 2) * 8 + 6;
      
      // Object box
      doc.setFillColor(235, 243, 251);
      doc.setDrawColor(200, 223, 245);
      doc.roundedRect(leftX - 2, objY, 176, 16, 2, 2, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(11, 79, 158);
      doc.text('OBJET DE LA MISSION', leftX + 2, objY + 5);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(53, 61, 79);
      doc.text(mo.objet || '—', leftX + 2, objY + 12);
      
      // Remarks
      let lines;
      if (mo.remarques && mo.remarques !== '—') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(142, 151, 168);
        doc.text('REMARQUES / INSTRUCTIONS', leftX, objY + 23);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(53, 61, 79);
        lines = doc.splitTextToSize(mo.remarques, 175);
        doc.text(lines, leftX, objY + 30);
      }
      
      // Status
      const statusLabel = {approved:'APPROUVÉ ✅', rejected:'REJETÉ ❌', pending:'EN ATTENTE ⏳'}[mo.status] || 'EN ATTENTE';
      const linesHeight = (mo.remarques && mo.remarques !== '—' && lines) ? lines.length * 4 : 0;
      const statusY = objY + (mo.remarques && mo.remarques !== '—' ? 34 + linesHeight : 28);
      
      doc.setDrawColor(221, 225, 234);
      doc.setLineWidth(0.5);
      doc.line(leftX, statusY, 196, statusY);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(142, 151, 168);
      doc.text('STATUT', 105, statusY + 7, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setTextColor(11, 79, 158);
      doc.text(statusLabel, 105, statusY + 14, { align: 'center' });
      
      // Comment
      let commentLines;
      if (mo.comment) {
        doc.setFontSize(9);
        doc.setTextColor(99, 110, 130);
        commentLines = doc.splitTextToSize(`Message : ${mo.comment}`, 170);
        doc.text(commentLines, 105, statusY + 21, { align: 'center' });
      }
      
      // Signature section
      const commentHeight = (mo.comment && commentLines) ? commentLines.length * 4 : 0;
      const sigY = statusY + (mo.comment ? 26 + commentHeight : 22);
      doc.setDrawColor(142, 151, 168);
      doc.setLineWidth(0.3);
      
      // Left signature line
      doc.line(30, sigY + 12, 85, sigY + 12);
      doc.setFontSize(8);
      doc.setTextColor(142, 151, 168);
      doc.text('Le collaborateur', 57.5, sigY + 17, { align: 'center' });
      
      // Right signature line
      doc.setLineWidth(0.3);
      doc.line(110, sigY + 12, 165, sigY + 12);
      doc.text('Le responsable', 137.5, sigY + 17, { align: 'center' });
      
      // Footer
      const footerY = 285;
      doc.setDrawColor(221, 225, 234);
      doc.setLineWidth(0.3);
      doc.line(14, footerY, 196, footerY);
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168);
      doc.text(`Document généré par Eqnovia — Notes de Frais • ${mo.numero || 'N/A'}`, 105, footerY + 5, { align: 'center' });
      doc.text(`Date: ${mo.date || '—'}`, 105, footerY + 10, { align: 'center' });
      
      // Convert to base64
      const pdfOutput = doc.output('arraybuffer');
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfOutput)));
      resolve(base64);
    } catch (e) {
      console.warn('PDF base64 generation failed:', e);
      reject(e);
    }
  });
}

// Share PDF via Web Share API (mobile)
async function shareMOByWebShare(docId) {
  const mo = missionOrdersCache.find(m => m._firebaseId === docId || m._localId === docId);
  if (!mo) return toast('Ordre de mission introuvable.', 'err');
  
  if (!navigator.share) {
    return toast('Le partage n\'est pas supporté sur ce navigateur. Utilisez le bouton PDF pour télécharger.', 'err');
  }
  
  try {
    // Generate PDF blob
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Logo
    try { doc.addImage('logo.PNG', 'PNG', 14, 10, 30, 10); } catch(e) { /* fallback */ }
    
    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`ORDRE DE MISSION N° ${mo.numero || 'N/A'}`, 105, 22, { align: 'center' });
    
    // Separator
    doc.setDrawColor(11, 79, 158);
    doc.setLineWidth(0.8);
    doc.line(14, 27, 196, 27);
    
    // Info box
    const leftX = 18;
    let y = 33;
    doc.setFontSize(10);
    
    const fields = [
      ['Date d\'émission', mo.date || '—'],
      ['Collaborateur', mo.employe || '—'],
      ['Lieu de départ', mo.depart || '—'],
      ['Lieu de destination', mo.arrivee || '—'],
      ['Date de début', mo.debut || '—'],
      ['Date de fin', mo.fin || '—'],
      ['Mode de transport', mo.transport || '—'],
      ['Téléphone', mo.tel || '—'],
    ];
    
    fields.forEach(([label, value], fi) => {
      const col = fi % 2;
      const row = Math.floor(fi / 2);
      const x = col === 0 ? leftX : 105;
      const yy = y + row * 8;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168);
      doc.text(label.toUpperCase(), x, yy);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(53, 61, 79);
      doc.text(value, x, yy + 4);
      
      doc.setDrawColor(221, 225, 234);
      doc.setLineWidth(0.3);
      doc.line(x, yy + 5.5, col === 0 ? 100 : 196, yy + 5.5);
    });
    
    const objY = y + Math.ceil(fields.length / 2) * 8 + 6;
    
    doc.setFillColor(235, 243, 251);
    doc.setDrawColor(200, 223, 245);
    doc.roundedRect(leftX - 2, objY, 176, 16, 2, 2, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(11, 79, 158);
    doc.text('OBJET DE LA MISSION', leftX + 2, objY + 5);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(53, 61, 79);
    doc.text(mo.objet || '—', leftX + 2, objY + 12);
    
    let lines;
    if (mo.remarques && mo.remarques !== '—') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168);
      doc.text('REMARQUES / INSTRUCTIONS', leftX, objY + 23);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(53, 61, 79);
      lines = doc.splitTextToSize(mo.remarques, 175);
      doc.text(lines, leftX, objY + 30);
    }
    
    const statusLabel = {approved:'APPROUVÉ ✅', rejected:'REJETÉ ❌', pending:'EN ATTENTE ⏳'}[mo.status] || 'EN ATTENTE';
    const linesHeight = (mo.remarques && mo.remarques !== '—' && lines) ? lines.length * 4 : 0;
    const statusY = objY + (mo.remarques && mo.remarques !== '—' ? 34 + linesHeight : 28);
    
    doc.setDrawColor(221, 225, 234);
    doc.setLineWidth(0.5);
    doc.line(leftX, statusY, 196, statusY);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(142, 151, 168);
    doc.text('STATUT', 105, statusY + 7, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(11, 79, 158);
    doc.text(statusLabel, 105, statusY + 14, { align: 'center' });
    
    let commentLines;
    if (mo.comment) {
      doc.setFontSize(9);
      doc.setTextColor(99, 110, 130);
      commentLines = doc.splitTextToSize(`Message : ${mo.comment}`, 170);
      doc.text(commentLines, 105, statusY + 21, { align: 'center' });
    }
    
    const commentHeight = (mo.comment && commentLines) ? commentLines.length * 4 : 0;
    const sigY = statusY + (mo.comment ? 26 + commentHeight : 22);
    doc.setDrawColor(142, 151, 168);
    doc.setLineWidth(0.3);
    
    doc.line(30, sigY + 12, 85, sigY + 12);
    doc.setFontSize(8);
    doc.setTextColor(142, 151, 168);
    doc.text('Le collaborateur', 57.5, sigY + 17, { align: 'center' });
    
    doc.setLineWidth(0.3);
    doc.line(110, sigY + 12, 165, sigY + 12);
    doc.text('Le responsable', 137.5, sigY + 17, { align: 'center' });
    
    const footerY = 285;
    doc.setDrawColor(221, 225, 234);
    doc.setLineWidth(0.3);
    doc.line(14, footerY, 196, footerY);
    doc.setFontSize(7);
    doc.setTextColor(142, 151, 168);
    doc.text(`Document généré par Eqnovia — Notes de Frais • ${mo.numero || 'N/A'}`, 105, footerY + 5, { align: 'center' });
    doc.text(`Date: ${mo.date || '—'}`, 105, footerY + 10, { align: 'center' });
    
    // Get PDF blob
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], `Ordre_Mission_${mo.numero || 'sans_numero'}.pdf`, { type: 'application/pdf' });
    
    // Use Web Share API
    await navigator.share({
      title: `Ordre de mission N° ${mo.numero}`,
      text: `Ordre de mission N° ${mo.numero} — ${mo.employe}\nDu ${mo.debut} au ${mo.fin}\n${mo.depart} → ${mo.arrivee}`,
      files: [pdfFile]
    });
    
    toast('📤 Ordre de mission partagé avec succès !', 'ok');
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.warn('Web Share failed:', e);
      toast('❌ Erreur lors du partage.', 'err');
    }
  }
}

function sendMOByWhatsApp(docId) {
  const mo = missionOrdersCache.find(m => m._firebaseId === docId || m._localId === docId);
  if (!mo) return toast('Ordre de mission introuvable.', 'err');
  
  if (!mo.tel || mo.tel === '—' || mo.tel.length < 5) {
    return toast('Numéro de téléphone non renseigné pour cet ordre de mission.', 'err');
  }
  
  const message = `Eqnovia - Ordre de mission N° ${mo.numero}\n\nCollaborateur : ${mo.employe}\nDate : ${mo.date}\nTrajet : ${mo.depart} → ${mo.arrivee}\nObjet : ${mo.objet}\nTransport : ${mo.transport}\n${mo.remarques !== '—' ? 'Remarques : ' + mo.remarques : ''}`;
  
  const waUrl = `https://wa.me/${cleanPhone(mo.tel)}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  toast('💬 Ouverture de WhatsApp...', 'ok');
}

function sendUserMOByWhatsApp(docId) {
  const mo = missionOrdersCache.find(m => m._firebaseId === docId || m._localId === docId);
  if (!mo) return toast('Ordre de mission introuvable.', 'err');
  
  if (!mo.tel || mo.tel === '—' || mo.tel.length < 5) {
    return toast('Numéro de téléphone non renseigné pour cet ordre de mission.', 'err');
  }
  
  const message = `Eqnovia - Ordre de mission N° ${mo.numero}\n\nCollaborateur : ${mo.employe}\nDate : ${mo.date}\nTrajet : ${mo.depart} → ${mo.arrivee}\nObjet : ${mo.objet}\nTransport : ${mo.transport}\n${mo.remarques !== '—' ? 'Remarques : ' + mo.remarques : ''}`;
  
  const waUrl = `https://wa.me/${cleanPhone(mo.tel)}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  toast('💬 Ouverture de WhatsApp...', 'ok');
}

// ════════════════════════════════════════════
// ADD EXPENSE
// ════════════════════════════════════════════
async function addExpense() {
  const date    = document.getElementById('dateInput').value;
  const desc    = sanitizeInput(document.getElementById('descInput').value);
  const amount  = parseFloat(document.getElementById('amountInput').value);
  const cat     = document.getElementById('catInput').value;
  const mission = sanitizeInput(document.getElementById('missionInput').value);
  const comment = sanitizeInput(document.getElementById('commentInput').value);
  const justifFile = document.getElementById('justifInput');

  if (!date)                    return toast('Veuillez saisir une date.','err');
  if (!desc)                    return toast('Veuillez saisir une description.','err');
  if (!validateDate(date))      return toast('Date invalide (doit être dans le passé et <= 10 ans).','err');
  if (!validateAmount(amount))  return toast('Montant TTC invalide (0 < montant <= 10 000 000).','err');

  const btn = document.getElementById('addBtn');
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Enregistrement…';

  // Process multiple justificatif files
  let justifFiles = [];
  let justifData = null;
  let justifName = '';
  let justifStorageUrl = null;
  let justifStoragePath = null;

  if (justifFile.files && justifFile.files.length > 0) {
    for (let fi = 0; fi < justifFile.files.length; fi++) {
      const file = justifFile.files[fi];
      if (!file.type.startsWith('image/')) continue;
      try {
        const reader = new FileReader();
        const data = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        const fileEntry = {
          data: data,
          name: file.name,
          storageUrl: null,
          storagePath: null
        };
        
        // Upload to Firebase Storage if available
        if (window.__storage && window.__fbReady) {
          try {
            const ext = file.name.split('.').pop() || 'jpg';
            const fileName = `frais/${Date.now()}_${currentUser}_${file.name.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
            const storageRef = window.__storageRef(window.__storage, fileName);
            await window.__uploadBytes(storageRef, file);
            fileEntry.storageUrl = await window.__getDownloadURL(storageRef);
            fileEntry.storagePath = fileName;
          } catch (e) {
            console.warn('Firebase Storage upload failed for ' + file.name + ', using local base64:', e);
          }
        }
        
        justifFiles.push(fileEntry);
      } catch (e) {
        console.warn('Error reading justificatif ' + file.name + ':', e);
      }
    }
    
    // Keep backward compat single-file refs
    if (justifFiles.length > 0) {
      justifData = justifFiles[0].data;
      justifName = justifFiles[0].name;
      justifStorageUrl = justifFiles[0].storageUrl;
      justifStoragePath = justifFiles[0].storagePath;
    }
  }

  const exp = { 
    id: Date.now(), 
    date, 
    desc, 
    amount, 
    cat, 
    mission: mission || '',
    comment, 
    user: currentUser,
    justif: justifFiles.length > 0 ? 'Oui' : 'Non',
    justifData: justifData || null,
    justifName: justifName || null,
    justifStorageUrl: justifStorageUrl,
    justifStoragePath: justifStoragePath,
    justifFiles: justifFiles.length > 0 ? justifFiles : null
  };
  await dataAdd(exp);

  btn.disabled=false; btn.innerHTML='➕ Ajouter la dépense';
  
  document.getElementById('descInput').value='';
  document.getElementById('amountInput').value='';
  document.getElementById('missionInput').value='';
  document.getElementById('commentInput').value='';
  document.getElementById('justifInput').value='';
  
  updateKPIs();
  if (activeTab!=='saisie') switchTab(activeTab); else renderAll();
  toast('Dépense enregistrée dans la base de données ✔');
}

// ════════════════════════════════════════════
// EDIT
// ════════════════════════════════════════════
let editingId = null;

function editRow(id) {
  const exp = cache.find(e => e.id === id);
  if (!exp) return toast('Dépense introuvable.', 'err');
  
  if (!isAdmin && exp.user !== currentUser) {
    return toast('Vous ne pouvez modifier que vos propres dépenses.', 'err');
  }
  
  editingId = id;
  document.getElementById('editDate').value    = exp.date;
  document.getElementById('editAmount').value  = exp.amount;
  document.getElementById('editDesc').value    = exp.desc;
  document.getElementById('editCat').value     = exp.cat || 'Autre';
  document.getElementById('editMission').value = exp.mission || '';
  document.getElementById('editComment').value = exp.comment || '';
  
  // Show current justificatif info (multi-file support)
  const justifCurrent = document.getElementById('editJustifCurrent');
  const files = getJustifFiles(exp);
  if (files.length > 0) {
    justifCurrent.innerHTML = `📎 Justificatifs : <strong>${files.length} fichier(s)</strong> — <span style="cursor:pointer;color:var(--eq-blue);text-decoration:underline;" onclick="viewJustificatif(${id})">👁️ Voir</span> <span style="font-size:10px;color:var(--gray-400);">(les nouveaux fichiers s'ajoutent aux existants)</span>`;
  } else {
    justifCurrent.innerHTML = '📭 Aucun justificatif — Vous pouvez en ajouter ci-dessous.';
  }
  
  // Clear justificatif file input and preview
  clearEditJustificatif();
  
  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  clearEditJustificatif();
  document.getElementById('editModal').classList.remove('open');
  editingId = null;
}

document.getElementById('editModal').addEventListener('click', e => {
  if (e.target === document.getElementById('editModal')) closeEditModal();
});

async function saveEdit() {
  if (editingId === null) return;
  
  const idx = cache.findIndex(e => e.id === editingId);
  if (idx === -1) return toast('Dépense introuvable.', 'err');
  
  if (!isAdmin && cache[idx].user !== currentUser) {
    return toast('Vous ne pouvez modifier que vos propres dépenses.', 'err');
  }
  
  const date    = document.getElementById('editDate').value;
  const desc    = sanitizeInput(document.getElementById('editDesc').value);
  const amount  = parseFloat(document.getElementById('editAmount').value);
  const cat     = document.getElementById('editCat').value;
  const mission = sanitizeInput(document.getElementById('editMission').value);
  const comment = sanitizeInput(document.getElementById('editComment').value);

  if (!date)                    return toast('Veuillez saisir une date.', 'err');
  if (!desc)                    return toast('Veuillez saisir une description.', 'err');
  if (!validateDate(date))      return toast('Date invalide (doit être dans le passé et <= 10 ans).', 'err');
  if (!validateAmount(amount))  return toast('Montant TTC invalide (0 < montant <= 10 000 000).', 'err');

  const btn = document.getElementById('editSaveBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Enregistrement…';

  // Handle multi-justificatif upload
  const editJustifFile = document.getElementById('editJustifInput');
  let justifUpdates = {};
  
  if (editJustifFile.files && editJustifFile.files.length > 0) {
    let newFiles = [];
    let hasNonImage = false;
    
    for (let fi = 0; fi < editJustifFile.files.length; fi++) {
      const file = editJustifFile.files[fi];
      if (!file.type.startsWith('image/')) { hasNonImage = true; continue; }
      try {
        const reader = new FileReader();
        const data = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        const fileEntry = {
          data: data,
          name: file.name,
          storageUrl: null,
          storagePath: null
        };
        
        // Upload to Firebase Storage if available
        if (window.__storage && window.__fbReady) {
          try {
            const ext = file.name.split('.').pop() || 'jpg';
            const fileName = `frais/${Date.now()}_${currentUser}_${file.name.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
            const storageRef = window.__storageRef(window.__storage, fileName);
            await window.__uploadBytes(storageRef, file);
            fileEntry.storageUrl = await window.__getDownloadURL(storageRef);
            fileEntry.storagePath = fileName;
          } catch (e) {
            console.warn('Firebase Storage upload failed for ' + file.name + ':', e);
          }
        }
        
        newFiles.push(fileEntry);
      } catch (e) {
        console.warn('Error reading justificatif ' + file.name + ' in edit:', e);
      }
    }
    
    if (hasNonImage) {
      toast('Certains fichiers non-images ont été ignorés.', 'info');
    }
    
    if (newFiles.length > 0) {
      // Merge with existing files (new ones first)
      const exp = cache.find(e => e.id === editingId);
      const existingFiles = exp ? getJustifFiles(exp) : [];
      const mergedFiles = [...newFiles, ...existingFiles];
      
      justifUpdates.justifFiles = mergedFiles;
      justifUpdates.justif = 'Oui';
      justifUpdates.justifData = mergedFiles[0].data;
      justifUpdates.justifName = mergedFiles[0].name;
      justifUpdates.justifStorageUrl = mergedFiles[0].storageUrl;
      justifUpdates.justifStoragePath = mergedFiles[0].storagePath;
    }
  }

  const updates = { date, desc, amount, cat, mission, comment, ...justifUpdates };
  await dataUpdate(editingId, updates);

  btn.disabled = false; btn.innerHTML = '💾 Enregistrer les modifications';
  closeEditModal();
  updateKPIs();
  if (activeTab === 'monthly') renderMonthly();
  else if (activeTab === 'yearly') renderYearly();
  else renderAll();
  toast('Dépense modifiée avec succès ✔');
}

// ════════════════════════════════════════════
// DELETE
// ════════════════════════════════════════════
function deleteRow(id) {
  const exp = cache.find(e => e.id === id);
  if (!exp) return toast('Dépense introuvable.', 'err');
  
  if (!isAdmin) {
    return toast('Seul l\'administrateur peut supprimer des dépenses.', 'err');
  }
  
  showModal('Supprimer la dépense','Cette action est irréversible. Continuer ?', async()=>{
    await dataDelete(id);
    updateKPIs();
    if (activeTab==='monthly') renderMonthly();
    else if (activeTab==='yearly') renderYearly();
    else renderAll();
    toast('Dépense supprimée.');
  });
}

// ════════════════════════════════════════════
// CLEAR ALL
// ════════════════════════════════════════════
function confirmClear(){
  if (!isAdmin) {
    return toast('Seul l\'administrateur peut effacer toutes les données.', 'err');
  }
  showModal('⚠️ Supprimer tout','Toutes les dépenses seront effacées de la base de données. Continuer ?', async()=>{
    if (useFirebase) {
      try {
        const { collection, getDocs, deleteDoc, doc } = window.__fs;
        const snap = await getDocs(collection(window.__db,'expenses'));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(window.__db,'expenses',d.id))));
      } catch(e){ console.warn(e); }
    }
    cache=[];
    try { lsSave([]); } catch(e) {}
    updateKPIs();
    renderAll(); renderMonthly(); renderYearly();
    toast('Toutes les dépenses ont été supprimées.');
  });
}

// ════════════════════════════════════════════
// GLOBAL SEARCH
// ════════════════════════════════════════════
function handleGlobalSearch(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    if (activeTab !== 'all') switchTab('all');
    resetFilters();
    return;
  }
  if (activeTab !== 'all') switchTab('all');
  document.getElementById('filterSearch').value = q;
  renderAll();
}

// ════════════════════════════════════════════
// KPIs
// ════════════════════════════════════════════
function updateKPIs() {
  const all   = dataAll();
  const userData = getUserExpenses(all);
  const now   = new Date();
  const ym    = now.toISOString().substring(0,7);
  const mData = userData.filter(e=>e.date.startsWith(ym));
  const total = userData.reduce((s,e)=>s+e.amount,0);

  document.getElementById('kpiTotal').textContent      = fmtDH(total);
  document.getElementById('kpiCount').textContent      = userData.length + ' dépense(s)';
  document.getElementById('kpiMonth').textContent      = fmtDH(mData.reduce((s,e)=>s+e.amount,0));
  document.getElementById('kpiMonthLabel').textContent = MONTHS_FR[now.getMonth()] + ' ' + now.getFullYear();
}

// ════════════════════════════════════════════
// SORT
// ════════════════════════════════════════════
function sortBy(col){
  if(sortCol===col) sortDir*=-1; else{sortCol=col;sortDir=-1;}
  renderAll();
}

// ════════════════════════════════════════════
// RENDER ALL
// ════════════════════════════════════════════
function renderAll() {
  const allData = dataAll();
  const data = getUserExpenses(allData);
  const yearF   = document.getElementById('filterYear').value;
  const monthF  = document.getElementById('filterMonth').value;
  const catF    = document.getElementById('filterCat').value;
  const userF   = document.getElementById('filterUser').value;
  const search  = (document.getElementById('filterSearch').value||'').toLowerCase();

  const years = [...new Set(allData.map(e=>e.date.substring(0,4)))].sort().reverse();
  const ySel  = document.getElementById('filterYear');
  const yVal  = ySel.value;
  ySel.innerHTML='<option value="all">📅 Toutes années</option>';
  years.forEach(y=>{const o=document.createElement('option');o.value=y;o.textContent=y;ySel.appendChild(o);});
  if(years.includes(yVal)) ySel.value=yVal;

  const userSel = document.getElementById('filterUser');
  const userVal = userSel.value;
  const userOptions = isAdmin ? Object.keys(USERS) : [currentUser];
  userSel.innerHTML='<option value="all">👤 Tous</option>';
  userOptions.forEach(u=>{
    const o=document.createElement('option');
    o.value=u;
    o.textContent=USERS[u].label;
    userSel.appendChild(o);
  });
  if(userOptions.includes(userVal)) userSel.value=userVal;

  let rows = data.filter(e=>{
    const y=e.date.substring(0,4), m=e.date.substring(5,7);
    const userMatch = userF==='all' || e.user === userF;
    return (yearF==='all'||y===yearF)
        && (monthF==='all'||m===monthF)
        && (catF==='all'||(e.cat||'Autre')===catF)
        && userMatch
        && (!search||e.desc.toLowerCase().includes(search)||(e.cat||'').toLowerCase().includes(search)||(e.mission||'').toLowerCase().includes(search));
  }).sort((a,b)=>{
    if(sortCol==='amount') return (a.amount-b.amount)*sortDir;
    return a.date.localeCompare(b.date)*sortDir;
  });

  const tbody=document.getElementById('tbody');

  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="12"><div class="empty-state"><div class="empty-icon">🗂️</div><h3>Aucune dépense trouvée</h3><p>Ajustez vos filtres ou saisissez une nouvelle dépense.</p></div></td></tr>`;
    document.getElementById('grandTotal').innerHTML='💰 Total : <strong>0,00 DH</strong>';
    document.getElementById('rowCount').textContent='0 ligne(s)';
    return;
  }

  let total=0, html='';
  rows.forEach((e,i)=>{
    total+=e.amount;

    const jCount = countJustif(e);
    const justifBadge = jCount > 0 
      ? `<span class="badge badge-justif" onclick="viewJustificatif(${e.id})" title="Voir les justificatifs">📎 ${jCount}</span>`
      : `<span class="badge badge-no">❌ Non</span>`;
    
    const userLabel = USERS[e.user] ? USERS[e.user].label : e.user;
    const createdByLabel = e.createdBy ? (USERS[e.createdBy] ? USERS[e.createdBy].label : e.createdBy) : '—';
    const modifiedByLabel = e.modifiedBy ? (USERS[e.modifiedBy] ? USERS[e.modifiedBy].label : e.modifiedBy) : '—';
    const isOwner = e.user === currentUser;
    const canEdit = isAdmin || isOwner;
    const canDelete = isAdmin;

    html+=`<tr>
      <td style="color:var(--gray-400);font-size:11px;">${i+1}</td>
      <td class="td-date">${fmtDate(e.date)}</td>
      <td class="td-desc"><span title="${esc(e.desc)}">${esc(e.desc)}</span></td>
      <td><span class="badge badge-cat">${esc(e.cat||'Autre')}</span></td>
      <td class="td-amount">${fmtDH(e.amount)}</td>
      <td class="td-desc"><span title="${esc(e.mission || '')}">${esc(e.mission || '—')}</span></td>
      <td class="td-desc"><span title="${esc(e.comment || '')}">${esc(e.comment || '—')}</span></td>
      <td class="td-user"><span class="badge badge-user">${esc(userLabel)}</span></td>
      <td>${justifBadge}</td>
      <td class="td-user"><span class="badge badge-user">${esc(createdByLabel)}</span></td>
      <td class="td-user"><span class="badge badge-user">${esc(modifiedByLabel)}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon edit ${!canEdit ? 'disabled' : ''}" onclick="${canEdit ? 'editRow('+e.id+')' : ''}" title="${canEdit ? 'Modifier' : 'Non autorisé'}">✏️</button>
        <button class="btn-icon ${!canDelete ? 'disabled' : ''}" onclick="${canDelete ? 'deleteRow('+e.id+')' : ''}" title="${canDelete ? 'Supprimer' : 'Non autorisé'}">✕</button>
      </div></td>
    </tr>`;
  });
  tbody.innerHTML=html;
  document.getElementById('grandTotal').innerHTML=`💰 Total TTC : <strong>${fmtDH(total)}</strong>`;
  document.getElementById('rowCount').textContent=rows.length+' ligne(s) — Total TTC : '+fmtDH(total);
}

function resetFilters(){
  ['filterYear','filterMonth','filterCat','filterUser'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.value='all';
  });
  document.getElementById('filterSearch').value='';
  renderAll();
}

// ════════════════════════════════════════════
// RENDER MONTHLY
// ════════════════════════════════════════════
function renderMonthly() {
  const allData = dataAll();
  const data = getUserExpenses(allData);
  const yearF  = document.getElementById('filterYearMonth').value;
  const userF  = document.getElementById('filterMonthUser')?.value || 'all';

  const years=[...new Set(allData.map(e=>e.date.substring(0,4)))].sort().reverse();
  const ySel=document.getElementById('filterYearMonth');
  const yVal=ySel.value;
  ySel.innerHTML='<option value="all">Toutes années</option>';
  years.forEach(y=>{const o=document.createElement('option');o.value=y;o.textContent=y;ySel.appendChild(o);});
  if(years.includes(yVal)) ySel.value=yVal;

  // Populate user filter dynamically
  const userSel = document.getElementById('filterMonthUser');
  const userVal = userSel?.value || 'all';
  if (userSel && isAdmin) {
    userSel.innerHTML = '<option value="all">👤 Tous</option>' +
      Object.keys(USERS).map(u => `<option value="${u}">${u === 'admin' ? 'Admin' : esc(USERS[u].label)}</option>`).join('');
    if (Object.keys(USERS).includes(userVal)) userSel.value = userVal;
  }

  let filtered = data.filter(e=> yearF==='all'||e.date.substring(0,4)===yearF);
  
  if (!isAdmin) {
    filtered = filtered.filter(e => e.user === currentUser);
  } else if (userF !== 'all') {
    filtered = filtered.filter(e => e.user === userF);
  }

  const groups={};
  filtered.forEach(e=>{
    const key=e.date.substring(0,7);
    if(!groups[key]) groups[key]=[];
    groups[key].push(e);
  });

  const keys=Object.keys(groups).sort().reverse();
  const container=document.getElementById('monthlyGroups');

  if(!keys.length){
    container.innerHTML=`<div class="panel"><div class="empty-state"><div class="empty-icon">📭</div><h3>Aucune dépense</h3><p>Aucune dépense enregistrée pour cette période.</p></div></div>`;
    return;
  }

  container.innerHTML = keys.map(key=>{
    const [y,m]=key.split('-');
    const label=`${MONTHS_FR[parseInt(m,10)-1]} ${y}`;
    const items=groups[key].sort((a,b)=>b.date.localeCompare(a.date));
    const total=items.reduce((s,e)=>s+e.amount,0);
    
    const rows=items.map((e,i)=>{
      const jCount = countJustif(e);
      const justifBadge = jCount > 0 
        ? `<span class="badge badge-justif" onclick="viewJustificatif(${e.id})" title="Voir les justificatifs">📎 ${jCount}</span>`
        : `<span class="badge badge-no">❌ Non</span>`;
      const userLabel = USERS[e.user] ? USERS[e.user].label : e.user;
      const createdByLabel = e.createdBy ? (USERS[e.createdBy] ? USERS[e.createdBy].label : e.createdBy) : '—';
      const modifiedByLabel = e.modifiedBy ? (USERS[e.modifiedBy] ? USERS[e.modifiedBy].label : e.modifiedBy) : '—';
      const isOwner = e.user === currentUser;
      const canEdit = isAdmin || isOwner;
      const canDelete = isAdmin;
      
      return `<tr>
        <td style="color:var(--gray-400);font-size:11px;padding:8px 12px;">${i+1}</td>
        <td class="td-date" style="padding:8px 12px;">${fmtDate(e.date)}</td>
        <td class="td-desc" style="padding:8px 12px;"><span title="${esc(e.desc)}">${esc(e.desc)}</span></td>
        <td style="padding:8px 12px;"><span class="badge badge-cat">${esc(e.cat||'Autre')}</span></td>
        <td class="td-amount" style="padding:8px 12px;">${fmtDH(e.amount)}</td>
        <td class="td-desc" style="padding:8px 12px;"><span title="${esc(e.mission || '')}">${esc(e.mission || '—')}</span></td>
        <td class="td-desc" style="padding:8px 12px;"><span title="${esc(e.comment || '')}">${esc(e.comment || '—')}</span></td>
        <td class="td-user" style="padding:8px 12px;"><span class="badge badge-user">${esc(userLabel)}</span></td>
        <td style="padding:8px 12px;">${justifBadge}</td>
        <td class="td-user" style="padding:8px 12px;"><span class="badge badge-user">${esc(createdByLabel)}</span></td>
        <td class="td-user" style="padding:8px 12px;"><span class="badge badge-user">${esc(modifiedByLabel)}</span></td>
        <td style="padding:8px 12px;"><div class="action-btns">
          <button class="btn-icon edit ${!canEdit ? 'disabled' : ''}" onclick="${canEdit ? 'editRow('+e.id+')' : ''}" title="${canEdit ? 'Modifier' : 'Non autorisé'}">✏️</button>
          <button class="btn-icon ${!canDelete ? 'disabled' : ''}" onclick="${canDelete ? 'deleteRow('+e.id+')' : ''}" title="${canDelete ? 'Supprimer' : 'Non autorisé'}">✕</button>
        </div></td>
      </tr>`;
    }).join('');

    return `<div class="history-group">
      <div class="history-group-header" onclick="toggleGroup('${key}')">
        <div class="history-group-title">
          <span style="font-size:18px;">📅</span>
          <span>${label}</span>
          <span style="font-size:11px;color:var(--gray-400);font-weight:500;">${items.length} dépense(s)</span>
        </div>
        <div class="history-group-badge">
          <span class="group-total">${fmtDH(total)}</span>
          <span class="group-toggle" id="toggle-${key}">▼</span>
        </div>
      </div>
      <div class="history-group-body open" id="body-${key}">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>#</th><th>Date</th><th>Description</th><th>Type</th>
              <th>Total</th><th>Mission</th><th>Commentaires</th><th>User</th><th>Justif</th><th>Créé par</th><th>Modifié par</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;padding:10px 16px;background:var(--gray-50);border-top:1px solid var(--gray-100);gap:12px;">
          <div class="total-amount">💰 Total TTC : <strong>${fmtDH(total)}</strong></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleGroup(key){
  const body=document.getElementById(`body-${key}`);
  const tog=document.getElementById(`toggle-${key}`);
  body.classList.toggle('open');
  tog.classList.toggle('open');
}

// ════════════════════════════════════════════
// RENDER YEARLY
// ════════════════════════════════════════════
function renderYearly() {
  const allData = dataAll();
  const data = getUserExpenses(allData);
  const groups={};
  data.forEach(e=>{
    const y=e.date.substring(0,4);
    if(!groups[y]) groups[y]={total:0, count:0, byMonth:{}, byCat:{}, users:new Set()};
    groups[y].total+=e.amount;
    groups[y].count++;
    groups[y].users.add(e.user);
    const m=parseInt(e.date.substring(5,7),10)-1;
    groups[y].byMonth[m]=(groups[y].byMonth[m]||0)+e.amount;
    const c=e.cat||'Autre';
    groups[y].byCat[c]=(groups[y].byCat[c]||0)+e.amount;
  });

  const years=Object.keys(groups).sort().reverse();
  const container=document.getElementById('yearlyGroups');

  if(!years.length){
    container.innerHTML=`<div class="panel"><div class="empty-state"><div class="empty-icon">📭</div><h3>Aucune dépense</h3><p>Aucune dépense enregistrée.</p></div></div>`;
    return;
  }

  container.innerHTML=years.map(y=>{
    const g=groups[y];
    const vals=Object.values(g.byMonth);
    const maxVal=Math.max(...vals,1);
    const bars=Array.from({length:12},(_,i)=>{
      const v=g.byMonth[i]||0;
      const h=Math.max(Math.round((v/maxVal)*60),v>0?3:0);
      return `<div class="bar-wrap">
        <div class="bar-value">${v>0?Math.round(v/1000)+'k':''}</div>
        <div class="bar-fill" style="height:${h}px;opacity:${v>0?1:.2};"></div>
        <div class="bar-label">${MONTHS_SHORT[i]}</div>
      </div>`;
    }).join('');

    const userList = Array.from(g.users).map(u => USERS[u]?.label || u).join(', ');
    const catRows=Object.entries(g.byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--gray-100);">
        <span class="badge badge-cat">${esc(cat)}</span>
        <span style="font-weight:700;color:var(--eq-blue);font-size:12px;">${fmtDH(amt)}</span>
      </div>`).join('');

    return `<div class="history-group">
      <div class="history-group-header" onclick="toggleGroup('y${y}')">
        <div class="history-group-title">
          <span style="font-size:20px;">📆</span>
          <span>Année ${y}</span>
          <span style="font-size:11px;color:var(--gray-400);font-weight:500;">${g.count} dépense(s)</span>
        </div>
        <div class="history-group-badge">
          <span class="group-total">${fmtDH(g.total)}</span>
          <span class="group-toggle open" id="toggle-y${y}">▼</span>
        </div>
      </div>
      <div class="history-group-body open" id="body-y${y}">
        <div class="year-chart">
          <h4>Répartition mensuelle (DH) ${isAdmin ? '— ' + userList : ''}</h4>
          <div class="bar-chart">${bars}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
          <div style="padding:14px 18px;border-right:1px solid var(--gray-100);">
            <h4 style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Par catégorie</h4>
            ${catRows}
          </div>
          <div style="padding:14px 18px;">
            <h4 style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Résumé ${y}</h4>
            <div style="font-size:24px;font-weight:800;color:var(--eq-blue);margin-bottom:3px;">${fmtDH(g.total)}</div>
            <div style="font-size:12px;color:var(--gray-400);">${g.count} dépenses · Moy. ${fmtDH(g.total/g.count)}</div>
            <div style="margin-top:12px;">
              <button class="btn btn-primary" style="height:32px;font-size:11px;" onclick="switchTab('monthly');document.getElementById('filterYearMonth').value='${y}';renderMonthly();">
                📅 Voir mois par mois
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
// OCR
// ════════════════════════════════════════════
// Image preprocessing for better OCR accuracy
function preprocessImage(img) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Resize: max dimension 2000px for performance
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const MAX_DIM = 2000;
    if (w > MAX_DIM || h > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    canvas.width = w;
    canvas.height = h;
    
    // Draw resized
    ctx.drawImage(img, 0, 0, w, h);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    // 1. Convert to grayscale + auto-contrast (histogram stretch)
    let min = 255, max = 0;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i += 4) {
      // Luminosity grayscale: 0.299*R + 0.587*G + 0.114*B
      const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      gray[i / 4] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    
    // 2. Apply contrast stretch and adaptive threshold (if image is too light/dark)
    const range = max - min;
    const useThreshold = range < 150; // Low contrast → apply binarization
    
    for (let i = 0; i < gray.length; i++) {
      let g = gray[i];
      
      // Contrast stretch
      if (range > 20) {
        g = Math.round((g - min) / range * 255);
      }
      
      // Clamp
      g = Math.max(0, Math.min(255, g));
      
      // Apply threshold for low-contrast images (binarization)
      if (useThreshold) {
        // Simple Otsu-inspired threshold at 128 after stretch
        g = g > 128 ? 255 : 0;
      }
      
      const idx = i * 4;
      data[idx] = g;
      data[idx + 1] = g;
      data[idx + 2] = g;
      // Keep alpha
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to blob for Tesseract
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png', 0.9);
  });
}

// Convert PDF first page to image using canvas
async function pdfToImage(file) {
  try {
    // Use PDF.js if available
    if (window.pdfjsLib) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }
    // Fallback: PDF.js not loaded, show error
    throw new Error('PDF.js non chargé. Installez la librairie PDF.js pour analyser les PDF.');
  } catch(e) {
    console.warn('PDF conversion error:', e);
    throw e;
  }
}

function onFileChosen(e) {
  const f = e.target.files[0];
  document.getElementById('fileName').textContent = f ? '📎 ' + f.name : 'Aucun fichier';
  // Show preview thumbnail
  showOCRPreview(f);
}

function showOCRPreview(file) {
  const preview = document.getElementById('ocrPreview');
  const previewImg = document.getElementById('ocrPreviewImg');
  const previewPdfLabel = document.getElementById('ocrPreviewPdfLabel');
  if (!file || !preview || !previewImg) return;
  
  // Reset: show img, hide PDF label
  previewImg.style.display = 'block';
  if (previewPdfLabel) previewPdfLabel.style.display = 'none';
  preview.style.display = 'block';
  
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else if (file.type === 'application/pdf') {
    previewImg.style.display = 'none';
    preview.style.display = 'flex';
    preview.style.flexDirection = 'column';
    preview.style.alignItems = 'center';
    preview.style.justifyContent = 'center';
    if (previewPdfLabel) {
      previewPdfLabel.style.display = 'block';
    } else {
      // Create label element on first use
      const label = document.createElement('div');
      label.id = 'ocrPreviewPdfLabel';
      label.style.cssText = 'font-size:28px;text-align:center;padding:20px 0;';
      label.innerHTML = '📄<div style="font-size:11px;color:var(--gray-400);margin-top:4px;">PDF chargé</div>';
      preview.appendChild(label);
    }
  } else {
    preview.style.display = 'none';
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  const zone = e.currentTarget;
  zone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) {
    const dt = new DataTransfer();
    dt.items.add(f);
    document.getElementById('fileInput').files = dt.files;
    document.getElementById('fileName').textContent = '📎 ' + f.name;
    showOCRPreview(f);
    toast((f.type.startsWith('image/') ? 'Image' : 'PDF') + ' prêt(e) pour OCR !');
  } else {
    toast('Veuillez déposer un fichier image ou PDF.', 'err');
  }
}

function handleBatchDrop(e) {
  e.preventDefault();
  const zone = e.currentTarget;
  zone.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (validFiles.length === 0) {
      toast('Veuillez déposer des images ou PDF uniquement.', 'err');
      return;
    }
    const dt = new DataTransfer();
    validFiles.forEach(f => dt.items.add(f));
    document.getElementById('batchFileInput').files = dt.files;
    document.getElementById('batchFileName').textContent = `📎 ${dt.files.length} fichier(s) sélectionné(s)`;
    toast(`${dt.files.length} fichier(s) prêt(s) pour le traitement par lots !`);
  }
}

async function runOCR() {
  const fileInput = document.getElementById('fileInput');
  const out = document.getElementById('ocrOutput');
  const bar = document.getElementById('ocrBar');
  const prog = document.getElementById('ocrProgress');
  const btn = document.getElementById('ocrBtn');
  const extractedPanel = document.getElementById('ocrExtractedFields');

  if (!fileInput.files || !fileInput.files.length) {
    return toast('Choisissez d\'abord une image ou un PDF.', 'err');
  }

  btn.disabled = true;
  btn.textContent = '⏳ Préparation…';
  prog.style.display = 'block';
  bar.style.width = '0%';
  out.textContent = '⏳ Préparation de l\'image…';
  if (extractedPanel) extractedPanel.style.display = 'none';

  try {
    const file = fileInput.files[0];
    
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js n\'est pas chargé. Vérifiez votre connexion internet.');
    }

    // Step 1: Convert PDF to image if needed
    let imageBlob;
    if (file.type === 'application/pdf') {
      out.textContent = '⏳ Conversion PDF en image…';
      imageBlob = await pdfToImage(file);
    } else {
      imageBlob = file;
    }

    // Step 2: Preprocess image for better OCR
    out.textContent = '⏳ Optimisation de l\'image…';
    bar.style.width = '10%';
    
    const img = new Image();
    const imageUrl = URL.createObjectURL(imageBlob);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });
    
    const processedBlob = await preprocessImage(img);
    URL.revokeObjectURL(imageUrl);
    
    const processedUrl = URL.createObjectURL(processedBlob);
    bar.style.width = '20%';

    // Step 3: Run Tesseract with multiple languages
    out.textContent = '⏳ Initialisation de Tesseract…';
    
    const result = await Tesseract.recognize(processedUrl, 'fra+eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const progress = Math.round(m.progress * 100);
          bar.style.width = Math.min(20 + progress * 0.75, 95) + '%';
          out.textContent = `⏳ Reconnaissance... ${progress}%`;
        }
        if (m.status === 'loading tesseract core') {
          out.textContent = '⏳ Chargement du moteur OCR...';
        }
        if (m.status === 'initializing tesseract') {
          out.textContent = '⏳ Initialisation...';
        }
        if (m.status === 'loading language traineddata') {
          out.textContent = '⏳ Chargement dictionnaire français+anglais...';
        }
      }
    });

    URL.revokeObjectURL(processedUrl);

    ocrText = result.data.text || '';
    bar.style.width = '100%';
    
    if (ocrText.trim()) {
      out.textContent = ocrText;
      toast('✅ Texte extrait avec succès !');
      // Show extracted fields
      showExtractedOCRFields(ocrText);
    } else {
      out.textContent = '⚠️ Aucun texte détecté. Vérifiez que l\'image est lisible.';
      toast('Aucun texte détecté.', 'err');
    }
  } catch (error) {
    console.error('OCR Error:', error);
    out.textContent = '❌ Erreur OCR: ' + (error.message || 'Erreur inconnue');
    toast('Erreur lors de la lecture OCR.', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Lire et extraire';
    setTimeout(() => {
      prog.style.display = 'none';
      bar.style.width = '0%';
    }, 1000);
  }
}

// ════════════════════════════════════════════
// INTELLIGENT OCR DATA EXTRACTION
// ════════════════════════════════════════════

// Detect category from OCR text
function detectCategory(text) {
  const lower = text.toLowerCase();
  const catScores = {
    'Transport': 0,
    'Repas': 0,
    'Hébergement': 0,
    'Matériel': 0,
    'Communication': 0,
    'Formation': 0,
    'Autre': 0
  };
  
  // Transport keywords
  if (/taxi|uber|essence|carburant|péage|parking|train|avion|billet|transport|voyage|location voiture|gazole|gazoil/.test(lower)) catScores['Transport'] += 3;
  if (/km|kilométr|indemnité km|frais de déplacement|trajet|navette/.test(lower)) catScores['Transport'] += 2;
  
  // Meal keywords
  if (/restaurant|repas|déjeuner|dîner|petit-déjeuner|café|nourriture|plat|menu|addition/.test(lower)) catScores['Repas'] += 3;
  if (/note de restaurant|facture restaurant|boucher|traiteur|sandwich/.test(lower)) catScores['Repas'] += 2;
  
  // Hotel keywords
  if (/hôtel|hotel|hébergement|nuitée|séjour|chambre|logement|auberge|ibis|accor|radisson|riad|gîte/.test(lower)) catScores['Hébergement'] += 3;
  if (/booking|airbnb|expedia/.test(lower)) catScores['Hébergement'] += 2;
  
  // Material keywords
  if (/fourniture|matériel|équipement|achat|article|bureau|informatique|ordinateur|clavier|souris|ecran|imprimante|cartouche/.test(lower)) catScores['Matériel'] += 3;
  if (/papier|stylo|caisse|outil|pièce détachée|consommable/.test(lower)) catScores['Matériel'] += 2;
  
  // Communication keywords
  if (/téléphone|télécom|internet|abonnement|forfait|appel|recharge|wifi|data|sim/.test(lower)) catScores['Communication'] += 3;
  if (/orange|maroc telecom|inwi|iam|moi|facture tel/.test(lower)) catScores['Communication'] += 2;
  
  // Training keywords
  if (/formation|stage|séminaire|conférence|cours|atelier|workshop|certification|learning/.test(lower)) catScores['Formation'] += 3;
  if (/université|école|institut|formation professionnelle/.test(lower)) catScores['Formation'] += 2;
  
  // Find best category
  let bestCat = 'Autre';
  let bestScore = 0;
  for (const [cat, score] of Object.entries(catScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }
  return bestCat;
}

// Extract all fields from OCR text
function extractOCRFields(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = text;
  const lower = fullText.toLowerCase();
  
  const result = {
    date: '',
    dateConfidence: 0,
    amount: '',
    amountConfidence: 0,
    description: '',
    descriptionConfidence: 0,
    category: 'Autre',
    categoryConfidence: 0,
    vendor: '',
    invoiceNumber: ''
  };
  
  // ─── DATE EXTRACTION ───
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    { pattern: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, parse: (m) => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    // DD/MM/YY
    { pattern: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})(?=\D|$)/, parse: (m) => { const y = parseInt(m[3]) > 30 ? '19'+m[3] : '20'+m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }, confidence: 0.7 },
    // YYYY-MM-DD
    { pattern: /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/, parse: (m) => `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`, confidence: 0.85 },
    // French text dates: "12 janvier 2024" or "1er janvier 2024"
    { pattern: /(\d{1,2})(?:er)?[\s]*janvier[\s]*(\d{4})/i, parse: (m) => `${m[2]}-01-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*février[\s]*(\d{4})/i, parse: (m) => `${m[2]}-02-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*mars[\s]*(\d{4})/i, parse: (m) => `${m[2]}-03-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*avril[\s]*(\d{4})/i, parse: (m) => `${m[2]}-04-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*mai[\s]*(\d{4})/i, parse: (m) => `${m[2]}-05-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*juin[\s]*(\d{4})/i, parse: (m) => `${m[2]}-06-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*juillet[\s]*(\d{4})/i, parse: (m) => `${m[2]}-07-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*août[\s]*(\d{4})/i, parse: (m) => `${m[2]}-08-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*septembre[\s]*(\d{4})/i, parse: (m) => `${m[2]}-09-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*octobre[\s]*(\d{4})/i, parse: (m) => `${m[2]}-10-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*novembre[\s]*(\d{4})/i, parse: (m) => `${m[2]}-11-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    { pattern: /(\d{1,2})(?:er)?[\s]*décembre[\s]*(\d{4})/i, parse: (m) => `${m[2]}-12-${m[1].padStart(2,'0')}`, confidence: 0.9 },
    // English text dates: "January 12, 2024" or "12 January 2024"
    { pattern: /(january|february|march|april|may|june|july|august|september|october|november|december)[\s]+(\d{1,2})[,]?[\s]+(\d{4})/i, parse: (m) => { const months={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'}; return `${m[3]}-${months[m[1].toLowerCase()]}-${m[2].padStart(2,'0')}`; }, confidence: 0.85 },
    { pattern: /(\d{1,2})[\s]+(january|february|march|april|may|june|july|august|september|october|november|december)[\s]+(\d{4})/i, parse: (m) => { const months={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'}; return `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}`; }, confidence: 0.85 }
  ];
  
  // Score dates: prefer dates near "date" or "facture" keywords
  let bestDateScore = 0;
  let bestDate = '';
  for (const dp of datePatterns) {
    const match = lower.match(dp.pattern);
    if (match) {
      const parsed = dp.parse(match);
      // Increase confidence if near a date keyword
      const lineWithDate = lines.find(l => l.match(dp.pattern));
      let lineScore = dp.confidence;
      if (lineWithDate) {
        const l = lineWithDate.toLowerCase();
        if (/date|facture|invoice|émis|le|du/.test(l)) lineScore += 0.2;
        if (/total|montant|prix/.test(l)) lineScore -= 0.2;
      }
      if (lineScore > bestDateScore && parsed) {
        // Validate the date
        const d = new Date(parsed);
        if (!isNaN(d.getTime()) && d <= new Date() && d >= new Date('2010-01-01')) {
          bestDateScore = lineScore;
          bestDate = parsed;
        }
      }
    }
  }
  if (bestDate) {
    result.date = bestDate;
    result.dateConfidence = Math.round(bestDateScore * 100);
  }
  
  // ─── AMOUNT EXTRACTION ───
  const amountPatterns = [
    // Keywords first: TOTAL TTC, NET A PAYER, etc.
    { pattern: /(?:total\s*(?:ttc|general|général)?|net\s*à\s*payer|à\s*payer|net\s*payé)\s*[:\s]+(\d[\d\s,.]*[,.]\d{2})/i, score: 5 },
    { pattern: /(?:ttc|toutes taxes comprises)\s*[:\s]+(\d[\d\s,.]*[,.]\d{2})/i, score: 4 },
    { pattern: /(?:montant\s*(?:total|ttc)?|total|prix\s*(?:total)?|somme)\s*[:\s]+(\d[\d\s,.]*[,.]\d{2})/i, score: 3 },
    // Number with currency suffix
    { pattern: /(\d[\d\s,.]*[,.]\d{2})\s*(?:dh|dhs|mad|€|eur|usd|euro|dollar)/i, score: 2.5 },
    // Currency prefix
    { pattern: /(?:dh|mad|€|\$)\s*(\d[\d\s,.]*[,.]\d{2})/i, score: 2 },
    // Any decimal number that looks like an amount
    { pattern: /(\d{1,3}(?:[\s.,]?\d{3})*[.,]\d{2})(?!\s*%)(?![\d,])/, score: 1 }
  ];
  
  let bestAmtScore = 0;
  let bestAmt = '';
  for (const ap of amountPatterns) {
    const match = lower.match(ap.pattern);
    if (match) {
      let amtStr = match[1].replace(/\s/g, '').replace(',', '.');
      const num = parseFloat(amtStr);
      if (!isNaN(num) && num > 0 && num < 9999999) {
        // Prefer the largest amount (total) when multiple found
        const effectiveScore = ap.score + (num > 100 ? 0.5 : 0);
        if (effectiveScore > bestAmtScore) {
          bestAmtScore = effectiveScore;
          bestAmt = num;
        }
      }
    }
  }
  if (bestAmt) {
    result.amount = bestAmt;
    // Normalize confidence to 0-100
    result.amountConfidence = Math.min(Math.round(bestAmtScore * 20), 100);
  }
  
  // ─── DESCRIPTION EXTRACTION ───
  let bestDesc = '';
  let bestDescScore = 0;
  for (const line of lines) {
    let lineScore = 0;
    if (line.length < 3 || line.length > 120) continue;
    // Skip lines that are just numbers/dates
    if (/^[\d\s\/\-\.:]+$/.test(line)) continue;
    if (/^[A-Z\s]{3,}$/.test(line) && line.length < 10) continue;
    // Skip common header/footer keywords
    if (/^(facture|invoice|total|montant|date|client|tva|ht|ttc|ref|n°|email|tel|fax|www|\.com)/i.test(line)) continue;
    if (/^\d{1,3}[\s.,]\d{3}/.test(line)) continue;
    
    // Score by content type
    if (/prestation|service|mission|conseil|étude|analyse|intervention|maintenance|réparation/.test(line)) lineScore += 3;
    if (/transport|taxi|restaurant|hôtel|achat|formation|repas|déplacement|location/.test(line)) lineScore += 2.5;
    if (/^[A-Z]/.test(line) && line.length > 10) lineScore += 2; // Proper sentence
    if (line.length > 15) lineScore += 1.5;
    if (/\d{1,2}[\/\-]\d{1,2}/.test(line)) lineScore -= 1; // Contains a date, skip
    
    if (lineScore > bestDescScore) {
      bestDescScore = lineScore;
      bestDesc = line.substring(0, 100);
    }
  }
  if (bestDesc) {
    result.description = bestDesc;
    result.descriptionConfidence = Math.min(Math.round(bestDescScore * 20), 100);
  }
  
  // ─── VENDOR / COMPANY NAME ───
  // Look for common invoice patterns: company name at top
  for (const line of lines) {
    // Skip known non-vendor lines
    if (line.length < 3) continue;
    if (/^(facture|invoice|total|date|montant|ht|ttc|tva|ref|n°)/i.test(line)) continue;
    if (/^[\d\s\/\-]+$/.test(line)) continue;
    if (line.length > 5 && line.length < 50 && /(SARL|SA|SAS|EI|SNC|EURL|Maroc|Casablanca|Rabat|Tanger)/i.test(line)) {
      result.vendor = line;
      break;
    }
  }
  if (!result.vendor) {
    // First line that looks like a company name
    for (const line of lines.slice(0, 8)) {
      if (line.length > 5 && line.length < 50 && !/^(facture|invoice|total|date)/i.test(line) && !/^[\d\s\/\-\.]+$/.test(line)) {
        result.vendor = line;
        break;
      }
    }
  }
  
  // ─── INVOICE NUMBER ───
  for (const line of lines) {
    const match = line.match(/(?:facture|invoice|n°|nº|no|numéro|ref)\s*[:\s]*(\w[\w\d\/\-]+)/i);
    if (match && match[1].length > 2) {
      result.invoiceNumber = match[1];
      break;
    }
  }
  
  // ─── CATEGORY DETECTION ───
  const detectedCategory = detectCategory(fullText);
  result.category = detectedCategory;
  result.categoryConfidence = detectedCategory !== 'Autre' ? 70 : 0;
  
  return result;
}

// Display extracted fields in the OCR panel
function showExtractedOCRFields(text) {
  const container = document.getElementById('ocrExtractedFields');
  if (!container) return;
  
  const fields = extractOCRFields(text);
  
  container.style.display = 'block';
  
  function confidenceBar(val) {
    const color = val > 70 ? 'var(--green)' : val > 40 ? 'var(--eq-orange)' : 'var(--red)';
    return `<div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;height:4px;background:var(--gray-100);border-radius:2px;overflow:hidden;"><div style="height:100%;width:${val}%;background:${color};border-radius:2px;transition:width .5s;"></div></div><span style="font-size:9px;color:var(--gray-400);font-weight:600;">${val}%</span></div>`;
  }
  
  container.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--gray-500);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
      <span>📊 Données extraites</span>
      <span style="font-size:9px;color:var(--gray-400);font-weight:400;">— Vérifiez avant de remplir</span>
    </div>
    <div style="display:grid;gap:6px;">
      <div class="ocr-field-row">
        <span class="ocr-field-label">📅 Date</span>
        <span class="ocr-field-value ${fields.date ? 'found' : ''}">${fields.date || 'Non détectée'}</span>
        ${fields.date ? confidenceBar(fields.dateConfidence) : ''}
      </div>
      <div class="ocr-field-row">
        <span class="ocr-field-label">💰 Montant TTC</span>
        <span class="ocr-field-value ${fields.amount ? 'found' : ''}">${fields.amount ? fmtDH(fields.amount) : 'Non détecté'}</span>
        ${fields.amount ? confidenceBar(fields.amountConfidence) : ''}
      </div>
      <div class="ocr-field-row">
        <span class="ocr-field-label">📝 Description</span>
        <span class="ocr-field-value ${fields.description ? 'found' : ''}">${fields.description || 'Non détectée'}</span>
        ${fields.description ? confidenceBar(fields.descriptionConfidence) : ''}
      </div>
      <div class="ocr-field-row">
        <span class="ocr-field-label">🏷️ Catégorie</span>
        <span class="ocr-field-value ${fields.category !== 'Autre' ? 'found' : ''}">${fields.category}</span>
        ${fields.category !== 'Autre' ? confidenceBar(fields.categoryConfidence) : ''}
      </div>
      <div class="ocr-field-row">
        <span class="ocr-field-label">🏢 Fournisseur</span>
        <span class="ocr-field-value ${fields.vendor ? 'found' : ''}">${fields.vendor || 'Non détecté'}</span>
      </div>
      <div class="ocr-field-row">
        <span class="ocr-field-label">🔢 N° Facture</span>
        <span class="ocr-field-value ${fields.invoiceNumber ? 'found' : ''}">${fields.invoiceNumber || 'Non détecté'}</span>
      </div>
    </div>
    <div style="margin-top:8px;display:flex;gap:6px;">
      <button class="btn btn-primary btn-full" onclick="fillFormFromExtracted()" style="height:32px;font-size:11px;">
        ⬅️ Remplir le formulaire
      </button>
    </div>
  `;
  
  // Store extracted fields for use by fillFormFromExtracted
  window._ocrExtracted = fields;
}

// Fill form using the extracted data
function fillFormFromExtracted() {
  const fields = window._ocrExtracted;
  if (!fields) {
    return fillFormFromOCR(); // Fallback to old method
  }
  
  let filled = 0;
  if (fields.date) {
    document.getElementById('dateInput').value = fields.date;
    filled++;
  }
  if (fields.amount) {
    document.getElementById('amountInput').value = fields.amount;
    filled++;
  }
  if (fields.description) {
    document.getElementById('descInput').value = fields.description;
    filled++;
  }
  if (fields.category !== 'Autre') {
    // Try to set category if it exists in select
    const catSelect = document.getElementById('catInput');
    if (catSelect) {
      for (const opt of catSelect.options) {
        if (opt.value.toLowerCase() === fields.category.toLowerCase()) {
          catSelect.value = opt.value;
          break;
        }
      }
    }
    filled++;
  }
  
  // Use vendor as mission object if available
  if (fields.vendor) {
    const missionInput = document.getElementById('missionInput');
    if (missionInput && !missionInput.value) {
      missionInput.value = fields.vendor;
    }
  }
  
  toast(filled > 0 ? 
    `${filled} champ(s) rempli(s) — Vérifiez les valeurs avant d'ajouter.` : 
    'Aucun champ détecté. Vérifiez que l\'image contient une facture lisible.', 
    filled > 0 ? 'ok' : 'err'
  );
}

// Legacy fillFormFromOCR - keep for backward compatibility
function fillFormFromOCR() {
  if (!ocrText || ocrText.trim().length === 0) {
    return toast('Lancez d\'abord l\'OCR.', 'err');
  }
  // Use the new extraction pipeline
  const fields = extractOCRFields(ocrText);
  window._ocrExtracted = fields;
  fillFormFromExtracted();
}

// ════════════════════════════════════════════
// BATCH OCR — Traitement par lots
// ════════════════════════════════════════════

// Store for batch OCR results
window._batchOCRResults = [];

function onBatchFilesChosen(e) {
  const files = e.target.files;
  const label = document.getElementById('batchFileName');
  if (!files || !files.length) {
    label.textContent = 'Aucun fichier sélectionné';
    return;
  }
  label.textContent = `📎 ${files.length} fichier(s) sélectionné(s)`;
  toast(`${files.length} fichier(s) chargé(s) — Prêt pour le traitement par lots.`, 'info');
}

async function runBatchOCR() {
  const fileInput = document.getElementById('batchFileInput');
  const files = fileInput.files;
  if (!files || !files.length) {
    return toast('Sélectionnez d\'abord des fichiers.', 'err');
  }

  const totalFiles = files.length;
  const btn = document.getElementById('batchOcrBtn');
  const progress = document.getElementById('batchOcrProgress');
  const bar = document.getElementById('batchOcrBar');
  const status = document.getElementById('batchStatus');
  const resultsContainer = document.getElementById('batchResults');
  const resultsList = document.getElementById('batchResultsList');
  const countSpan = document.getElementById('batchCount');

  if (typeof Tesseract === 'undefined') {
    return toast('Tesseract.js n\'est pas chargé.', 'err');
  }

  btn.disabled = true;
  btn.textContent = '⏳ Traitement en cours…';
  progress.style.display = 'block';
  bar.style.width = '0%';
  status.textContent = 'Préparation…';
  resultsContainer.style.display = 'none';
  window._batchOCRResults = [];

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const fileProgress = ((i) / totalFiles * 100);
    bar.style.width = fileProgress + '%';
    
    status.textContent = `📄 Traitement ${i + 1}/${totalFiles} : ${file.name}`;
    
    try {
      // Convert PDF to image if needed
      let imageBlob;
      if (file.type === 'application/pdf') {
        status.textContent = `📄 ${i + 1}/${totalFiles} : Conversion PDF → ${file.name}`;
        imageBlob = await pdfToImage(file);
      } else {
        imageBlob = file;
      }

      // Preprocess image
      status.textContent = `📄 ${i + 1}/${totalFiles} : Optimisation → ${file.name}`;
      const img = new Image();
      const imageUrl = URL.createObjectURL(imageBlob);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });
      
      const processedBlob = await preprocessImage(img);
      URL.revokeObjectURL(imageUrl);
      const processedUrl = URL.createObjectURL(processedBlob);

      // Run Tesseract
      status.textContent = `📄 ${i + 1}/${totalFiles} : OCR en cours → ${file.name}`;
      let ocrResultText = '';
      try {
        const result = await Tesseract.recognize(processedUrl, 'fra+eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              const subProgress = Math.round(m.progress * 100);
              bar.style.width = Math.min(fileProgress + (subProgress / totalFiles), 98) + '%';
            }
          }
        });
        ocrResultText = result.data.text || '';
      } finally {
        URL.revokeObjectURL(processedUrl);
      }

      const text = ocrResultText;
      if (text.trim()) {
        // Extract fields
        const fields = extractOCRFields(text);
        fields._fileName = file.name;
        fields._fileSize = file.size;
        fields._text = text.substring(0, 300);
        fields._dateAdded = new Date().toISOString();
        
        // Store the file reference for justificatif (only images)
        if (file.type.startsWith('image/')) {
          fields._file = file;
        }
        
        window._batchOCRResults.push(fields);
        successCount++;
      } else {
        // Push entry with error flag
        window._batchOCRResults.push({
          _fileName: file.name,
          _fileSize: file.size,
          _text: '',
          _error: 'Aucun texte détecté',
          date: '', amount: '', description: '', category: 'Autre', vendor: '', invoiceNumber: '',
          dateConfidence: 0, amountConfidence: 0, descriptionConfidence: 0, categoryConfidence: 0
        });
        errorCount++;
      }
    } catch (err) {
      console.warn('Batch OCR error for', file.name, ':', err);
      window._batchOCRResults.push({
        _fileName: file.name,
        _fileSize: file.size,
        _text: '',
        _error: err.message || 'Erreur inconnue',
        date: '', amount: '', description: '', category: 'Autre', vendor: '', invoiceNumber: '',
        dateConfidence: 0, amountConfidence: 0, descriptionConfidence: 0, categoryConfidence: 0
      });
      errorCount++;
    }
    
    // Tiny delay for UI updates
    await new Promise(r => setTimeout(r, 50));
  }

  bar.style.width = '100%';
  
  if (successCount > 0) {
    status.textContent = `✅ Traitement terminé : ${successCount} facture(s) lue(s), ${errorCount} erreur(s)`;
    toast(`✅ ${successCount} facture(s) traitées avec succès !`, 'ok');
  } else {
    status.textContent = '❌ Aucune facture n\'a pu être lue.';
    toast('Aucune facture n\'a pu être lue.', 'err');
  }
  
  // Render results
  renderBatchResults();
  
  btn.disabled = false;
  btn.textContent = '📚 Traiter toutes les factures';
  setTimeout(() => { progress.style.display = 'none'; bar.style.width = '0%'; }, 2000);
}

function renderBatchResults() {
  const results = window._batchOCRResults;
  const container = document.getElementById('batchResults');
  const list = document.getElementById('batchResultsList');
  const countSpan = document.getElementById('batchCount');
  const addAllBtn = document.getElementById('batchAddAllBtn');
  
  if (!results.length) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  if (countSpan) countSpan.textContent = results.length;
  
  // Check if all results are valid (have at least date OR amount OR description)
  const validCount = results.filter(r => r.date || r.amount || r.description).length;
  if (addAllBtn) {
    addAllBtn.textContent = validCount > 0 ? `➕ Ajouter ${validCount} facture(s) valide(s)` : '➕ Ajouter tout (⚠️ aucune valide)';
    addAllBtn.disabled = validCount === 0;
  }
  
  list.innerHTML = results.map((r, idx) => {
    const isError = r._error;
    const hasData = r.date || r.amount || r.description;
    
    return `
    <div class="batch-result-item ${isError ? 'batch-error' : ''} ${!isError && !hasData ? 'batch-warning' : ''}">
      <div class="batch-result-header">
        <span class="batch-result-num">#${idx + 1}</span>
        <span class="batch-result-file">📄 ${esc(r._fileName)}${r._fileSize ? ' (' + Math.round(r._fileSize / 1024) + ' Ko)' : ''}</span>
        ${isError ? `<span class="batch-result-err">❌ ${esc(r._error)}</span>` : ''}
        <div class="batch-result-actions">
          ${!isError && hasData ? `<button class="btn btn-primary" onclick="addBatchExpense(${idx})" style="height:26px;font-size:9px;padding:0 8px;">➕ Ajouter</button>` : ''}
          <button class="btn btn-ghost" onclick="removeBatchResult(${idx})" style="height:26px;font-size:9px;padding:0 8px;color:var(--red);">✕</button>
        </div>
      </div>
      ${!isError ? `
      <div class="batch-result-fields">
        <div class="batch-field"><span class="batch-field-label">📅 Date</span><span class="batch-field-value ${r.date ? 'found' : ''}">${r.date || '—'}</span></div>
        <div class="batch-field"><span class="batch-field-label">💰 Montant</span><span class="batch-field-value ${r.amount ? 'found' : ''}">${r.amount ? fmtDH(r.amount) : '—'}</span></div>
        <div class="batch-field" style="flex:2;"><span class="batch-field-label">📝 Description</span><span class="batch-field-value ${r.description ? 'found' : ''}">${r.description || '—'}</span></div>
        <div class="batch-field"><span class="batch-field-label">🏷️ Catégorie</span><span class="batch-field-value ${r.category !== 'Autre' ? 'found' : ''}">${r.category}</span></div>
        <div class="batch-field"><span class="batch-field-label">🏢 Fournisseur</span><span class="batch-field-value ${r.vendor ? 'found' : ''}">${r.vendor || '—'}</span></div>
      </div>` : ''}
    </div>`;
  }).join('');
}

async function addBatchExpense(idx, skipToast = false) {
  const results = window._batchOCRResults;
  if (idx < 0 || idx >= results.length) return;
  
  const r = results[idx];
  if (!r.date && !r.amount && !r.description) {
    if (!skipToast) toast('Impossible d\'ajouter : aucune donnée extraite.', 'err');
    return false;
  }
  
  // Build expense object
  const exp = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    date: r.date || today(),
    desc: r.description || 'Facture ' + r._fileName,
    amount: r.amount || 0,
    cat: r.category && r.category !== 'Autre' ? r.category : document.getElementById('catInput').value,
    mission: r.vendor || '',
    comment: 'Ajouté via OCR batch — ' + r._fileName,
    user: currentUser,
    justif: 'Non',
    justifData: null,
    justifName: null,
    justifStorageUrl: null,
    justifStoragePath: null
  };
  
  // If we have the file, try to read it as justificatif
  if (r._file && r._file.type.startsWith('image/')) {
    try {
      const reader = new FileReader();
      const data = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(r._file);
      });
      if (data) {
        exp.justif = 'Oui';
        exp.justifData = data;
        exp.justifName = r._fileName;
        
        // Try Firebase Storage upload
        if (window.__storage && window.__fbReady) {
          try {
            const ext = r._fileName.split('.').pop() || 'jpg';
            const fileName = `frais/${Date.now()}_${currentUser}_${r._fileName.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
            const storageRef = window.__storageRef(window.__storage, fileName);
            await window.__uploadBytes(storageRef, r._file);
            exp.justifStorageUrl = await window.__getDownloadURL(storageRef);
            exp.justifStoragePath = fileName;
          } catch (e) {
            console.warn('Firebase Storage upload failed:', e);
          }
        }
      }
    } catch (e) {
      console.warn('Error reading justificatif from batch:', e);
    }
  }
  
  await dataAdd(exp);
  
  // Remove from results
  window._batchOCRResults.splice(idx, 1);
  renderBatchResults();
  
  updateKPIs();
  if (activeTab !== 'saisie') switchTab(activeTab); else renderAll();
  
  if (!skipToast) toast('✅ Dépense ajoutée : ' + (r.description || r._fileName), 'ok');
  return true;
}

async function addAllBatchExpenses() {
  const results = window._batchOCRResults;
  if (!results.length) return toast('Aucun résultat à ajouter.', 'err');
  
  const btn = document.getElementById('batchAddAllBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Ajout en cours…';
  
  let added = 0;
  let errors = 0;
  
  // Process in reverse to maintain correct indices after deletion
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i];
    if (r.date || r.amount || r.description) {
      const ok = await addBatchExpense(i, true);
      if (ok) added++;
      else errors++;
    } else {
      errors++;
    }
  }
  
  btn.disabled = false;
  btn.textContent = '➕ Ajouter tout';
  
  renderBatchResults();
  updateKPIs();
  if (activeTab !== 'saisie') switchTab(activeTab); else renderAll();
  
  toast(`✅ ${added} dépense(s) ajoutée(s)${errors > 0 ? ', ' + errors + ' ignorée(s)' : ''}`, 'ok');
}

function removeBatchResult(idx) {
  window._batchOCRResults.splice(idx, 1);
  renderBatchResults();
}

function clearBatchResults() {
  if (window._batchOCRResults.length === 0) return;
  if (!confirm('Effacer tous les résultats OCR batch ?')) return;
  window._batchOCRResults = [];
  document.getElementById('batchResults').style.display = 'none';
  document.getElementById('batchStatus').textContent = '';
  document.getElementById('batchFileInput').value = '';
  document.getElementById('batchFileName').textContent = 'Aucun fichier sélectionné';
  toast('🗑️ Résultats effacés.', 'info');
}

// ════════════════════════════════════════════
// EXPORTS (avec filtres actifs)
// ════════════════════════════════════════════
function getFilteredDataForExport() {
  const allData = dataAll();
  const data = getUserExpenses(allData);
  
  const yearF = document.getElementById('filterYear')?.value || 'all';
  const monthF = document.getElementById('filterMonth')?.value || 'all';
  const catF = document.getElementById('filterCat')?.value || 'all';
  const userF = document.getElementById('filterUser')?.value || 'all';
  const search = (document.getElementById('filterSearch')?.value || '').toLowerCase();

  return data.filter(e => {
    const y = e.date.substring(0,4);
    const m = e.date.substring(5,7);
    const userMatch = userF === 'all' || e.user === userF;
    return (yearF === 'all' || y === yearF)
      && (monthF === 'all' || m === monthF)
      && (catF === 'all' || (e.cat || 'Autre') === catF)
      && userMatch
      && (!search || e.desc.toLowerCase().includes(search) || (e.cat || '').toLowerCase().includes(search) || (e.mission || '').toLowerCase().includes(search));
  });
}

function exportExcel() {
  if (!window.XLSX) return toast('Bibliothèque Excel non chargée.', 'err');
  const data = getFilteredDataForExport();
  if (!data.length) return toast('Aucune dépense à exporter avec ces filtres.', 'err');
  
  const employeeRows = [
    ['NOTE DE FRAIS', ''],
    ['Date d\'export', new Date().toLocaleDateString('fr-FR')],
    ['Utilisateur connecté', USERS[currentUser].label],
    ['Filtres actifs', 'Oui'],
    [],
  ];
  const headers = ['N°', 'Date', 'Description', 'Type', 'Total TTC (DH)', 'Objet mission', 'Commentaires', 'Utilisateur', 'Justificatif'];
  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
  const dataRows = sorted.map((e, i) => [
    i + 1, e.date, e.desc, e.cat || 'Autre', e.amount, e.mission || '', e.comment || '',
    USERS[e.user]?.label || e.user,
    e.justifData ? 'Oui' : 'Non'
  ]);
  const totalTTC = sorted.reduce((s, e) => s + e.amount, 0);
  const footerRows = [[], ['', '', 'TOTAL', '', totalTTC, '', '', '', '']];
  const allRows = [...employeeRows, headers, ...dataRows, ...footerRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 35 }, { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Notes de Frais');
  XLSX.writeFile(wb, `note-de-frais_${USERS[currentUser].label.replace(/ /g, '_')}_${today()}.xlsx`);
  toast('Export Excel téléchargé !');
}

function exportPDF() {
  if (!window.jspdf) return toast('Bibliothèque PDF non chargée.', 'err');
  const data = getFilteredDataForExport();
  if (!data.length) return toast('Aucune dépense à exporter avec ces filtres.', 'err');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  
  const logoUrl = 'logo.PNG';
  try {
    doc.addImage(logoUrl, 'PNG', 14, 4, 20, 18);
  } catch (e) {
    console.warn('Logo not found in PDF export', e);
  }
  
  doc.setFillColor(11, 79, 158);
  doc.rect(0, 0, W, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('eqnovia', 38, 14);
  doc.setFillColor(247, 147, 30);
  doc.circle(38 + doc.getTextWidth('eqnovia') - 2, 8, 1.5, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 223, 245);
  doc.text('Note de Frais — Document officiel', 14, 20);
  const now = new Date();
  doc.setFontSize(9);
  doc.text(`Édité le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, W - 14, 14, { align: 'right' });
  doc.setTextColor(11, 79, 158);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Récapitulatif des dépenses professionnelles', 14, 30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(53, 61, 79);
  doc.text(`Utilisateur : ${USERS[currentUser].label}`, 14, 36);
  doc.text(`Filtres actifs : Oui`, 180, 36);
  
  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
  const total = sorted.reduce((s, e) => s + e.amount, 0);
  const head = [['#', 'Date', 'Description', 'Type', 'Total TTC', 'Mission', 'Commentaires', 'User', 'Justif']];
  const body = sorted.map((e, i) => [
    i + 1, fmtDate(e.date), e.desc, e.cat || 'Autre', fmtDH(e.amount), e.mission || '—', e.comment || '—',
    USERS[e.user]?.label || e.user,
    e.justifData ? 'Oui' : 'Non'
  ]);
  doc.autoTable({
    head, body, startY: 40,
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
    headStyles: { fillColor: [11, 79, 158], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [235, 243, 251] },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center', textColor: [100, 110, 130] },
      1: { cellWidth: 18, textColor: [100, 110, 130] },
      2: { cellWidth: 38 },
      3: { cellWidth: 20 },
      4: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [11, 79, 158] },
      5: { cellWidth: 28 },
      6: { cellWidth: 25 },
      7: { cellWidth: 18 },
      8: { cellWidth: 14, halign: 'center' }
    },
    foot: [['', '', '', 'TOTAL', fmtDH(total), '', '', '', '']],
    footStyles: { fillColor: [235, 243, 251], fontStyle: 'bold' },
    margin: { left: 10, right: 10 }
  });
  const fy = doc.lastAutoTable.finalY + 8;
  doc.setFillColor(247, 147, 30);
  doc.rect(10, fy, 6, 6, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 130);
  doc.text(`Eqnovia · ${sorted.length} dépense(s) · Total TTC : ${fmtDH(total)}`, 20, fy + 4);
  doc.save(`note-de-frais_${USERS[currentUser].label.replace(/ /g, '_')}_${today()}.pdf`);
  toast('Export PDF téléchargé !');
}

// ════════════════════════════════════════════════════
// RAPPORTS TRIMESTRIELS
// ════════════════════════════════════════════════════
function getTrimester(m) {
  const month = parseInt(m);
  if (month >= 1 && month <= 3) return 1;
  if (month >= 4 && month <= 6) return 2;
  if (month >= 7 && month <= 9) return 3;
  return 4;
}
function getTrimesterLabel(t) {
  const labels = {1:'T1 · Jan–Mar',2:'T2 · Avr–Juin',3:'T3 · Jui–Sep',4:'T4 · Oct–Déc'};
  return labels[t] || `T${t}`;
}
function getTrimesterMonths(t) {
  const m = {1:['01','02','03'],2:['04','05','06'],3:['07','08','09'],4:['10','11','12']};
  return m[t] || [];
}

function renderTrimester() {
  const container = document.getElementById('trimesterContent');
  if (!container) return;

  const data = getFilteredExpenses();
  const yearSel = document.getElementById('triYearFilter');
  const userSel = document.getElementById('triUserFilter');

  // Populate year filter
  const years = [...new Set(data.map(e=>e.date?.substring(0,4)).filter(Boolean))].sort();
  yearSel.innerHTML = '<option value="">Toutes les années</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  if (!yearSel.value && years.length) yearSel.value = years[years.length-1];

  // Populate user filter
  const users = [...new Set(data.map(e=>e.user).filter(Boolean))];
  userSel.innerHTML = '<option value="">Tous les collaborateurs</option>' + users.map(u => `<option value="${u}">${USERS[u]?.label||u}</option>`).join('');

  const selectedYear = yearSel.value;
  const selectedUser = userSel.value;

  let filtered = data;
  if (selectedYear) filtered = filtered.filter(e => e.date?.substring(0,4) === selectedYear);
  if (selectedUser) filtered = filtered.filter(e => e.user === selectedUser);

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><h3>Aucune dépense</h3><p>Aucune dépense trouvée pour cette période.</p></div>';
    return;
  }

  // Group by trimester
  const triData = {1: {expenses:[], total:0, count:0}, 2: {expenses:[], total:0, count:0}, 3: {expenses:[], total:0, count:0}, 4: {expenses:[], total:0, count:0}};
  filtered.forEach(e => {
    const m = e.date?.substring(5,7);
    if (!m) return;
    const t = getTrimester(m);
    triData[t].expenses.push(e);
    triData[t].total += parseFloat(e.amount) || 0;
    triData[t].count++;
  });

  const grandTotal = Object.values(triData).reduce((s,d) => s + d.total, 0);
  const maxTotal = Math.max(...Object.values(triData).map(d => d.total), 1);

  // Build trimester cards
  let cardsHtml = '<div class="tri-grid">';
  [1,2,3,4].forEach(t => {
    const d = triData[t];
    const pct = grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : 0;
    cardsHtml += `
      <div class="tri-card">
        <div class="tri-top">
          <div class="tri-icon t${t}">T${t}</div>
          <div>
            <div class="tri-label">${getTrimesterLabel(t)}</div>
            <div class="tri-count">${d.count} dépense${d.count>1?'s':''}</div>
          </div>
        </div>
        <div class="tri-amount">${fmtDH(d.total)}</div>
        <div class="tri-count">${pct}% du total</div>
        <div style="margin-top:6px;height:4px;background:var(--gray-100);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:var(--eq-blue);border-radius:4px;transition:width .5s;"></div>
        </div>
      </div>`;
  });
  cardsHtml += '</div>';

  // Build detail table
  let tableHtml = '<div class="table-wrap"><table class="tri-table"><thead><tr><th>Trimestre</th><th>Mois</th><th>Montant</th><th>Dépenses</th><th>Moy./mois</th></tr></thead><tbody>';
  [1,2,3,4].forEach(t => {
    const d = triData[t];
    if (d.count === 0) return;
    const months = getTrimesterMonths(t);
    const monthlyAvg = months.length > 0 ? d.total / months.length : 0;
    tableHtml += `<tr><td><strong>T${t}</strong><span class="tri-sub">${getTrimesterLabel(t)}</span></td>`;
    tableHtml += `<td>${months.map(m => {
      const monthNames = ['Jan','Fév','Mar','Avr','Mai','Juin','Jui','Aoû','Sep','Oct','Nov','Déc'];
      return monthNames[parseInt(m)-1];
    }).join(', ')}</td>`;
    tableHtml += `<td class="td-amount">${fmtDH(d.total)}</td>`;
    tableHtml += `<td>${d.count}</td>`;
    tableHtml += `<td class="td-amount">${fmtDH(monthlyAvg)}</td></tr>`;
  });
  tableHtml += `</tbody></table></div>`;
  tableHtml += `<div class="table-footer"><span class="total-info">Total annuel</span><span class="total-amount">${fmtDH(grandTotal)}</span></div>`;

  container.innerHTML = cardsHtml + '<div style="margin-top:10px;">' + tableHtml + '</div>';
}

// ════════════════════════════════════════════════════
// COMPARAISON DE PÉRIODES
// ════════════════════════════════════════════════════
function renderComparison() {
  const container = document.getElementById('comparisonContent');
  if (!container) return;

  const data = getFilteredExpenses();
  const period1 = document.getElementById('cmpPeriod1').value;
  const period2 = document.getElementById('cmpPeriod2').value;
  const userF = document.getElementById('cmpUserFilter').value;

  // Populate date selectors FIRST, then read values
  function populateDates(selId) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const p = selId.includes('Date1') ? period1 : period2;
    const years = [...new Set(data.map(e=>e.date?.substring(0,4)).filter(Boolean))].sort();
    let options = [];
    if (p === 'month') {
      years.forEach(y => {
        for (let m = 1; m <= 12; m++) {
          const val = `${y}-${String(m).padStart(2,'0')}`;
          const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
          options.push({val, label: `${monthNames[m-1]} ${y}`});
        }
      });
    } else if (p === 'trimestre') {
      years.forEach(y => {
        [1,2,3,4].forEach(t => options.push({val: `${y}-T${t}`, label: `${y} · T${t} (${getTrimesterLabel(t)})`}));
      });
    } else {
      years.forEach(y => options.push({val: y, label: y}));
    }
    sel.innerHTML = options.map(o => `<option value="${o.val}">${o.label}</option>`).join('');
    if (options.length > 0) sel.value = options[options.length-1].val;
  }

  populateDates('cmpDate1');
  populateDates('cmpDate2');

  // Read dates AFTER populating
  const date1 = document.getElementById('cmpDate1').value;
  const date2 = document.getElementById('cmpDate2').value;

  // Populate user filter
  const users = [...new Set(data.map(e=>e.user).filter(Boolean))];
  const uSel = document.getElementById('cmpUserFilter');
  uSel.innerHTML = '<option value="">Tous</option>' + users.map(u => `<option value="${u}">${USERS[u]?.label||u}</option>`).join('');

  if (!date1 || !date2) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📈</div><h3>Sélectionnez deux périodes</h3><p>Choisissez deux périodes à comparer.</p></div>';
    return;
  }

  // Filter by period
  let filteredData = userF ? data.filter(e => e.user === userF) : data;
  const set1 = _filterByPeriod(filteredData, period1, date1);
  const set2 = _filterByPeriod(filteredData, period2, date2);

  const total1 = set1.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const total2 = set2.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const count1 = set1.length;
  const count2 = set2.length;
  const avg1 = count1 > 0 ? total1 / count1 : 0;
  const avg2 = count2 > 0 ? total2 / count2 : 0;

  function fmtChange(current, previous) {
    if (previous === 0) return {pct: 'N/A', cls: 'same', arrow: '—'};
    const chg = ((current - previous) / previous) * 100;
    const arrow = chg > 0 ? '↑' : chg < 0 ? '↓' : '→';
    return {pct: `${arrow} ${Math.abs(chg).toFixed(1)}%`, cls: chg > 0 ? 'up' : chg < 0 ? 'down' : 'same', arrow};
  }

  const totalChg = fmtChange(total2, total1);
  const countChg = fmtChange(count2, count1);
  const avgChg = fmtChange(avg2, avg1);

  // Category breakdown
  const cats1 = {}, cats2 = {};
  set1.forEach(e => { const c = e.cat||'Autre'; cats1[c] = (cats1[c]||0) + (parseFloat(e.amount)||0); });
  set2.forEach(e => { const c = e.cat||'Autre'; cats2[c] = (cats2[c]||0) + (parseFloat(e.amount)||0); });
  const allCats = [...new Set([...Object.keys(cats1), ...Object.keys(cats2)])];
  const maxCat = Math.max(...allCats.map(c => Math.max(cats1[c]||0, cats2[c]||0)), 1);

  container.innerHTML = `
    <div class="cmp-grid">
      <!-- Carte: Total -->
      <div class="cmp-card">
        <div class="cmp-header"><div class="cmp-icon blue">💰</div> Comparaison des totaux</div>
        <div class="cmp-body">
          <div class="cmp-stat">
            <span class="cmp-stat-label">${date1}</span>
            <span class="cmp-stat-val">${fmtDH(total1)}</span>
            <span class="cmp-stat-chg ${totalChg.cls}">${totalChg.pct}</span>
          </div>
          <div class="cmp-stat">
            <span class="cmp-stat-label">${date2}</span>
            <span class="cmp-stat-val">${fmtDH(total2)}</span>
            <span class="cmp-stat-chg ${totalChg.cls}">—</span>
          </div>
          <div class="cmp-stat">
            <span class="cmp-stat-label">Nombre de dépenses</span>
            <span class="cmp-stat-val">${count1} → ${count2}</span>
            <span class="cmp-stat-chg ${countChg.cls}">${countChg.pct}</span>
          </div>
          <div class="cmp-stat">
            <span class="cmp-stat-label">Moyenne par dépense</span>
            <span class="cmp-stat-val">${fmtDH(avg1)} → ${fmtDH(avg2)}</span>
            <span class="cmp-stat-chg ${avgChg.cls}">${avgChg.pct}</span>
          </div>
        </div>
      </div>

      <!-- Carte: Par catégorie -->
      <div class="cmp-card">
        <div class="cmp-header"><div class="cmp-icon orange">📂</div> Par catégorie</div>
        <div class="cmp-body">
          ${allCats.map(c => {
            const v1 = cats1[c]||0, v2 = cats2[c]||0;
            const chg = fmtChange(v2, v1);
            return `<div class="cmp-stat">
              <span class="cmp-stat-label">${c}</span>
              <span class="cmp-stat-val">${fmtDH(v1)} → ${fmtDH(v2)}</span>
              <span class="cmp-stat-chg ${chg.cls}">${chg.pct}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Carte: Graphique barres -->
      <div class="cmp-card">
        <div class="cmp-header"><div class="cmp-icon green">📊</div> Distribution par catégorie</div>
        <div class="cmp-body">
          <div style="display:flex;gap:12px;margin-bottom:10px;">
            <span style="font-size:11px;display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--eq-blue);display:inline-block;"></span> ${date1}</span>
            <span style="font-size:11px;display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--eq-orange);display:inline-block;"></span> ${date2}</span>
          </div>
          <div class="cmp-bar-wrap" style="height:120px;">
            ${allCats.map((c, i) => `
              <div class="cmp-bar-item">
                <div class="cmp-bar-value">${fmtDH(cats2[c]||0)}</div>
                <div class="cmp-bar-fill b2" style="height:${((cats2[c]||0)/maxCat*100).toFixed(0)}%;"></div>
                <div class="cmp-bar-fill b1" style="height:${((cats1[c]||0)/maxCat*100).toFixed(0)}%;"></div>
                <div class="cmp-bar-value">${fmtDH(cats1[c]||0)}</div>
                <div class="cmp-bar-label">${c.substring(0,6)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Carte: Recommandations -->
      <div class="cmp-card">
        <div class="cmp-header"><div class="cmp-icon red">💡</div> Recommandations</div>
        <div class="cmp-body">
          <div style="font-size:12px;color:var(--gray-700);line-height:1.7;">
            ${total1 > 0
              ? (total2 > total1
                  ? `<p>⚠️ Les dépenses ont <strong>augmenté de ${Math.abs(((total2-total1)/total1*100)).toFixed(1)}%</strong> entre les deux périodes.</p>`
                  : total2 < total1
                  ? `<p>✅ Les dépenses ont <strong>baissé de ${Math.abs(((total2-total1)/total1*100)).toFixed(1)}%</strong> entre les deux périodes. Bonne tendance !</p>`
                  : `<p>➡️ Les dépenses sont stables entre les deux périodes.</p>`)
              : total2 > 0
                ? `<p>⚠️ Les dépenses ont <strong>augmenté</strong> entre les deux périodes (période précédente à 0).</p>`
                : `<p>➡️ Les dépenses sont stables entre les deux périodes.</p>`
            }
            ${allCats.filter(c => {
              const v1 = cats1[c]||0, v2 = cats2[c]||0;
              return v1 > 0 && v2 > v1 * 1.2;
            }).length > 0
              ? `<p>🔴 Catégories en hausse : ${allCats.filter(c => { const v1=cats1[c]||0,v2=cats2[c]||0; return v1>0&&v2>v1*1.2; }).join(', ')}</p>`
              : ''
            }
            ${count1 > 0 && count2 > count1 * 1.2
              ? `<p>📌 Le nombre de dépenses a augmenté de ${((count2-count1)/count1*100).toFixed(0)}%. Vérifiez si toutes sont justifiées.</p>`
              : ''
            }
            ${avg2 > avg1 * 1.1
              ? `<p>💸 Le montant moyen par dépense a augmenté. Envisagez des plafonds par catégorie.</p>`
              : avg2 < avg1 * 0.9
              ? `<p>👍 Le montant moyen par dépense diminue. Les efforts de réduction des coûts portent leurs fruits.</p>`
              : ''
            }
            <p style="margin-top:8px;font-size:11px;color:var(--gray-400);">Analyse générée le ${new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════
// EXPORTS AMÉLIORÉS AVEC LOGO EQNOVIA
// ════════════════════════════════════════════════════
function exportPDFTrimestre() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','mm','a4');
  
  // Header with logo
  try { doc.addImage('logo.PNG', 'PNG', 20, 12, 16, 12); } catch(e) { /* fallback */ }
  doc.setFontSize(8); doc.setTextColor(247,147,30); doc.setFont(undefined,'normal');
  doc.text('Notes de Frais', 38, 22);
  
  doc.setFontSize(14); doc.setTextColor(53,61,79); doc.setFont(undefined,'bold');
  doc.text('Rapport trimestriel', 105, 20, {align:'center'});
  doc.setFontSize(8); doc.setTextColor(142,151,168); doc.setFont(undefined,'normal');
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${USERS[currentUser]?.label||''}`, 105, 26, {align:'center'});
  
  doc.setDrawColor(11,79,158); doc.line(20, 30, 190, 30);

  // Data
  const data = getFilteredExpenses();
  const yearSel = document.getElementById('triYearFilter');
  const year = yearSel?.value || '';
  let filtered = year ? data.filter(e => e.date?.substring(0,4) === year) : data;

  const triData = {1:[],2:[],3:[],4:[]};
  filtered.forEach(e => {
    const m = e.date?.substring(5,7);
    if (!m) return;
    triData[getTrimester(m)].push(e);
  });

  let y = 38;
  [1,2,3,4].forEach(t => {
    const items = triData[t];
    if (!items.length) return;
    
    doc.setFontSize(10); doc.setFont(undefined,'bold');
    doc.setTextColor(11,79,158);
    doc.text(`T${t} · ${getTrimesterLabel(t)}`, 20, y);
    y += 5;

    const total = items.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
    const rows = items.map(e => [
      e.date||'',
      e.desc?.substring(0,25)||'',
      e.cat||'',
      USERS[e.user]?.label?.substring(0,15)||'',
      (parseFloat(e.amount)||0).toFixed(2)+' DH'
    ]);

    doc.autoTable({
      startY: y, head: [['Date','Description','Catégorie','Collaborateur','Montant']],
      body: rows, margin: {left:20, right:20},
      theme: 'grid', headStyles: {fillColor: [11,79,158], fontSize:7},
      bodyStyles: {fontSize:7}, footStyles: {fontSize:7, fontStyle:'bold'},
      didDrawPage: (d) => { y = d.cursor.y + 4; }
    });

    doc.setFontSize(8); doc.setFont(undefined,'bold');
    doc.setTextColor(53,61,79);
    doc.text(`Total T${t} : ${total.toFixed(2)} DH (${items.length} dépense${items.length>1?'s':''})`, 20, y + 2);
    y += 10;
  });

  // Footer
  doc.setDrawColor(200,200,200); doc.line(20, y, 190, y);
  doc.setFontSize(8); doc.setTextColor(142,151,168); doc.setFont(undefined,'normal');
  doc.text('eqnovia · Notes de Frais', 105, y + 5, {align:'center'});
  
  doc.save(`rapport-trimestriel_${year||'all'}_${today()}.pdf`);
  toast('📄 Rapport trimestriel PDF téléchargé !');
}

function exportExcelTrimestre() {
  const data = getFilteredExpenses();
  const yearSel = document.getElementById('triYearFilter');
  const year = yearSel?.value || '';
  let filtered = year ? data.filter(e => e.date?.substring(0,4) === year) : data;

  const rows = [['eqnovia · Rapport trimestriel', '', '', '', ''],
    [`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${USERS[currentUser]?.label||''}`, '', '', '', ''],
    ['', '', '', '', ''],
    ['Trimestre', 'Période', 'Montant TTC', 'Nb dépenses', 'Moyenne/mois']
  ];

  const triData = {1:[],2:[],3:[],4:[]};
  filtered.forEach(e => {
    const m = e.date?.substring(5,7);
    if (!m) return;
    triData[getTrimester(m)].push(e);
  });

  let grandTotal = 0;
  [1,2,3,4].forEach(t => {
    const items = triData[t];
    if (!items.length) return;
    const total = items.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
    grandTotal += total;
    const months = getTrimesterMonths(t);
    const monthNames = ['Jan','Fév','Mar','Avr','Mai','Juin','Jui','Aoû','Sep','Oct','Nov','Déc'];
    rows.push([`T${t}`, months.map(m => monthNames[parseInt(m)-1]).join(', '), total.toFixed(2)+' DH', items.length, (total/months.length).toFixed(2)+' DH']);
  });
  rows.push(['', 'TOTAL', grandTotal.toFixed(2)+' DH', '', '']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:14},{wch:18},{wch:14},{wch:14},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws, 'Trimestres');
  XLSX.writeFile(wb, `rapport-trimestriel_${year||'all'}_${today()}.xlsx`);
  toast('📊 Rapport trimestriel Excel téléchargé !');
}

function exportPDFComparison() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','mm','a4');
  
  // Header
  try { doc.addImage('logo.PNG', 'PNG', 20, 12, 16, 12); } catch(e) { /* fallback */ }
  doc.setFontSize(8); doc.setTextColor(247,147,30); doc.setFont(undefined,'normal');
  doc.text('Notes de Frais', 38, 22);
  
  doc.setFontSize(14); doc.setTextColor(53,61,79); doc.setFont(undefined,'bold');
  doc.text('Comparaison de périodes', 105, 20, {align:'center'});
  doc.setFontSize(8); doc.setTextColor(142,151,168);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 105, 26, {align:'center'});
  
  doc.setDrawColor(11,79,158); doc.line(20, 30, 190, 30);

  const p1 = document.getElementById('cmpDate1')?.value||'Période 1';
  const p2 = document.getElementById('cmpDate2')?.value||'Période 2';

  doc.setFontSize(11); doc.setFont(undefined,'bold');
  doc.setTextColor(53,61,79);
  doc.text(`Comparaison : ${p1} vs ${p2}`, 20, 38);

  const data = getFilteredExpenses();
  const period1 = document.getElementById('cmpPeriod1')?.value||'month';
  const period2 = document.getElementById('cmpPeriod2')?.value||'month';

  const set1 = _filterByPeriod(data, period1, p1);
  const set2 = _filterByPeriod(data, period2, p2);
  const t1 = set1.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const t2 = set2.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);

  doc.autoTable({
    startY: 44, head: [['Indicateur', p1, p2, 'Variation']],
    body: [
      ['Total TTC', t1.toFixed(2)+' DH', t2.toFixed(2)+' DH', t1 ? `${((t2-t1)/t1*100).toFixed(1)}%` : 'N/A'],
      ['Nb dépenses', String(set1.length), String(set2.length), set1.length ? `${((set2.length-set1.length)/set1.length*100).toFixed(1)}%` : 'N/A'],
    ],
    theme: 'grid', headStyles: {fillColor: [11,79,158], fontSize:8},
    bodyStyles: {fontSize:8}, margin: {left:20, right:20},
  });

  const fy = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(7); doc.setTextColor(142,151,168);
  doc.text('eqnovia · Notes de Frais · Analyse comparative', 105, fy, {align:'center'});
  doc.save(`comparaison_${p1}_vs_${p2}_${today()}.pdf`);
  toast('📄 Rapport de comparaison PDF téléchargé !');
}

// ════════════════════════════════════════════════════
// Get filtered data helper (for new reports)
// ════════════════════════════════════════════════════
function getFilteredExpenses() {
  return cache;
}

// Shared filter helper for comparison
function _filterByPeriod(data, periodType, periodValue) {
  if (periodType === 'month') return data.filter(e => e.date?.substring(0,7) === periodValue);
  else if (periodType === 'trimestre') {
    const [y, t] = periodValue.split('-T');
    const months = getTrimesterMonths(parseInt(t.replace('T', '')));
    return data.filter(e => e.date?.substring(0,4) === y && months.includes(e.date?.substring(5,7)));
  } else return data.filter(e => e.date?.substring(0,4) === periodValue);
}

// ════════════════════════════════════════════════════
// ADMIN OM — GLOBAL DASHBOARD
// ════════════════════════════════════════════════════
let _adminOMCache = [];
let _adminOMFiltered = [];

async function loadAdminOM() {
  const container = document.getElementById('adminOMContent');
  if (!container) return;
  container.innerHTML = '<div class="admin-om-loading"><span class="spinner"></span> Chargement des ordres de mission depuis Firebase...</div>';
  
  try {
    // Load from Firebase
    const fbData = (await fbLoadOM()) || [];
    // Also load from localStorage for merge
    const localData = loadOMHistory();
    
    // Merge: combine both sources, deduplicate by _localId
    const seen = new Set();
    const merged = [];
    
    // Add Firebase items first
    fbData.forEach(item => {
      const key = item._localId || item.numero + '_' + item.employe;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ ...item, _source: 'firebase' });
      }
    });
    
    // Add local items not in Firebase
    localData.forEach(item => {
      const key = item._localId || item.numero + '_' + item.employe;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ ...item, _source: item._syncedToFB ? 'both' : 'local' });
      } else if (item._syncedToFB) {
        // Mark Firebase item as also synced from this user
        const existing = merged.find(m => (m._localId || m.numero + '_' + m.employe) === key);
        if (existing) existing._source = 'both';
      }
    });
    
    _adminOMCache = merged;
    populateAdminFilters();
    renderAdminOM();
  } catch(e) {
    console.warn('Admin OM load failed:', e);
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><h3>Erreur de chargement</h3><p>Impossible de charger les données depuis Firebase.</p><button class="btn btn-ghost" onclick="loadAdminOM()" style="margin-top:10px;">🔄 Réessayer</button></div>';
  }
}

function populateAdminFilters() {
  const data = _adminOMCache || [];
  const yearSel = document.getElementById('adminOMYear');
  const empSel = document.getElementById('adminOMEmploye');
  if (!yearSel || !empSel) return;

  const years = [...new Set(data.map(o => o.date?.substring(0,4)).filter(Boolean))].sort();
  const currentYear = yearSel.value;
  yearSel.innerHTML = '<option value="">Toutes années</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  if (currentYear) yearSel.value = currentYear;

  const employes = [...new Set(data.map(o => o.employe).filter(Boolean))].sort();
  const currentEmp = empSel.value;
  empSel.innerHTML = '<option value="">Tous collaborateurs</option>' + employes.map(e => `<option value="${e}">${e}</option>`).join('');
  if (currentEmp) empSel.value = currentEmp;
}

function renderAdminOM() {
  const container = document.getElementById('adminOMContent');
  if (!container) return;
  
  const search = (document.getElementById('adminOMSearch')?.value || '').toLowerCase();
  const yearFilter = document.getElementById('adminOMYear')?.value || '';
  const employeFilter = document.getElementById('adminOMEmploye')?.value || '';
  const statusFilter = document.getElementById('adminOMStatus')?.value || '';
  
  let data = _adminOMCache;
  
  // Apply filters
  if (search) data = data.filter(o => 
    (o.numero || '').toLowerCase().includes(search) ||
    (o.employe || '').toLowerCase().includes(search) ||
    (o.objet || '').toLowerCase().includes(search) ||
    (o.depart || '').toLowerCase().includes(search) ||
    (o.arrivee || '').toLowerCase().includes(search)
  );
  if (yearFilter) data = data.filter(o => o.date?.substring(0,4) === yearFilter);
  if (employeFilter) data = data.filter(o => o.employe === employeFilter);
  if (statusFilter) data = data.filter(o => (o._status || 'pending') === statusFilter);
  
  // Update count
  document.getElementById('adminOMCount').textContent = `${data.length} OM`;
  
  // Store filtered data for exports BEFORE the early return
  _adminOMFiltered = data;
  
  if (!data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>Aucun ordre de mission</h3><p>Aucun résultat trouvé pour les filtres actuels.</p></div>';
    return;
  }
  
  // Stats
  const totalOM = data.length;
  const fbCount = data.filter(o => o._source === 'firebase' || o._source === 'both').length;
  const localCount = data.filter(o => o._source === 'local').length;
  const uniqueEmployes = [...new Set(data.map(o => o.employe).filter(Boolean))].length;
  const pendingCount = data.filter(o => (o._status || 'pending') === 'pending').length;
  const approvedCount = data.filter(o => o._status === 'approved').length;
  const rejectedCount = data.filter(o => o._status === 'rejected').length;
  
  function statusIcon(s) {
    s = s || 'pending';
    if (s === 'approved') return '✅';
    if (s === 'rejected') return '❌';
    return '⏳';
  }
  function statusLabel(s) {
    s = s || 'pending';
    if (s === 'approved') return 'Approuvé';
    if (s === 'rejected') return 'Rejeté';
    return 'En attente';
  }
  function statusClass(s) {
    s = s || 'pending';
    if (s === 'approved') return 'approved';
    if (s === 'rejected') return 'rejected';
    return 'pending';
  }
  
  // Render
  container.innerHTML = `
    <div class="admin-om-stats">
      <div class="admin-om-stat"><div class="aos-value">${totalOM}</div><div class="aos-label">Total OM</div></div>
      <div class="admin-om-stat"><div class="aos-value">${pendingCount}</div><div class="aos-label">⏳ En attente</div></div>
      <div class="admin-om-stat"><div class="aos-value">${approvedCount}</div><div class="aos-label">✅ Approuvés</div></div>
      <div class="admin-om-stat"><div class="aos-value">${rejectedCount}</div><div class="aos-label">❌ Rejetés</div></div>
      <div class="admin-om-stat"><div class="aos-value">${fbCount}</div><div class="aos-label">Sur Firebase</div></div>
      <div class="admin-om-stat"><div class="aos-value">${uniqueEmployes}</div><div class="aos-label">Collaborateurs</div></div>
    </div>
    <table class="admin-om-table">
      <thead><tr>
        <th>Statut</th><th>N° OM</th><th>Collaborateur</th><th>Date</th><th>Trajet</th><th>Objet</th><th>Actions</th>
      </tr></thead>
      <tbody>
        ${data.slice().reverse().map(o => {
          const rawKey = o._localId || (o.numero || '') + '_' + (o.employe || '');
          const key = rawKey.replace(/'/g, "\\'");
          const s = o._status || 'pending';
          return `
          <tr>
            <td><span class="status-badge ${statusClass(s)}">${statusIcon(s)} ${statusLabel(s)}</span></td>
            <td><strong>${esc(o.numero||'—')}</strong></td>
            <td>${esc(o.employe||'—')}</td>
            <td class="td-date">${esc(o.date||'—')}</td>
            <td style="font-size:10px;">${esc(o.depart||'...')} → ${esc(o.arrivee||'...')}</td>
            <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(o.objet||'—')}</td>
            <td>
              <div class="status-actions">
                ${s !== 'approved' ? `<button class="status-btn approve" onclick="adminOMSetStatus('${key}','approved')" title="Approuver">✅</button>` : ''}
                ${s !== 'rejected' ? `<button class="status-btn reject" onclick="adminOMSetStatus('${key}','rejected')" title="Rejeter">❌</button>` : ''}
                ${s !== 'pending' ? `<button class="status-btn pending-btn" onclick="adminOMSetStatus('${key}','pending')" title="Remettre en attente">⏳</button>` : ''}
                ${o.tel && o.tel !== '—' && o.tel.length > 5 ? `<a class="status-btn" href="${notifyOMByWhatsApp(o, o._status||'pending', o._comment||'')}" target="_blank" title="WhatsApp" style="text-decoration:none;background:var(--green-pale);color:var(--green);">💬</a>` : ''}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function adminOMSetStatus(key, newStatus) {
  const item = _adminOMCache.find(o => (o._localId || (o.numero || '') + '_' + (o.employe || '')) === key);
  if (!item) return;
  
  const statusLabel = {approved:'✅ Approuver', rejected:'❌ Rejeter', pending:'⏳ Remettre en attente'}[newStatus] || newStatus;
  const comment = prompt(`${statusLabel} — ${esc(item.numero)} (${esc(item.employe)})\n\nSouhaitez-vous ajouter un commentaire pour le collaborateur ?`, '');
  if (comment === null) return; // cancelled
  
  updateOMStatus(key, newStatus, comment || '');
}

function updateOMStatus(key, newStatus, comment) {
  const item = _adminOMCache.find(o => (o._localId || (o.numero || '') + '_' + (o.employe || '')) === key);
  if (!item) return;
  const oldStatus = item._status || 'pending';
  if (oldStatus === newStatus) return;
  
  item._status = newStatus;
  if (comment !== undefined) item._comment = comment;
  
  // Update in localStorage cache
  const localData = loadOMHistory();
  const localIdx = localData.findIndex(o => 
    o._localId === item._localId || (o.numero === item.numero && o.employe === item.employe)
  );
  if (localIdx >= 0) {
    localData[localIdx]._status = newStatus;
    if (comment !== undefined) localData[localIdx]._comment = comment;
    localStorage.setItem(OM_STORAGE_KEY, JSON.stringify(localData));
  }
  
  // Sync to Firebase if item was synced
  if (useFirebase && item._localId) {
    fbDeleteOM(item._localId)
      .then(() => fbAddOM({ ...item, _syncedToFB: true }))
      .catch(e => console.warn('FB status sync failed:', e));
  }
  
  renderAdminOM();
  toast(`✅ OM ${esc(item.numero)} : ${newStatus === 'approved' ? 'Approuvé' : newStatus === 'rejected' ? 'Rejeté' : 'Remis en attente'}`, 'ok');
  
  // Envoyer une notification email si le statut a changé
  if (newStatus === 'approved' || newStatus === 'rejected') {
    notifyOMByEmail(item, newStatus, comment);
  }
  
  // Envoyer une notification WhatsApp si le statut a changé et qu'un téléphone est renseigné
  if ((newStatus === 'approved' || newStatus === 'rejected') && item.tel && item.tel !== '—' && item.tel.length > 5) {
    const waUrl = notifyOMByWhatsApp(item, newStatus, comment);
    if (waUrl) {
      setTimeout(() => {
        if (confirm(`📱 Envoyer une notification WhatsApp à ${esc(item.employe)} au ${esc(item.tel)} ?\n\nCliquez sur OK pour ouvrir WhatsApp avec le message pré-rempli.`)) {
          window.open(waUrl, '_blank');
        }
      }, 500);
    }
  }
}

// ════════════════════════════════════════════════════
// EXPORTS — ADMIN OM (PDF / EXCEL)
// ════════════════════════════════════════════════════
function adminOMExportPDF() {
  const data = _adminOMFiltered;
  if (!data.length) { toast('Aucune donnée à exporter.', 'err'); return; }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l','mm','a4');
  
  // Header with Eqnovia logo
  try { doc.addImage('logo.PNG', 'PNG', 20, 12, 16, 12); } catch(e) { /* fallback */ }
  doc.setFontSize(8); doc.setTextColor(247,147,30); doc.setFont(undefined,'normal');
  doc.text('Notes de Frais', 38, 22);
  doc.setFontSize(14); doc.setTextColor(53,61,79); doc.setFont(undefined,'bold');
  doc.text('Ordres de mission — Admin Global', 148, 20, {align:'center'});
  doc.setFontSize(8); doc.setTextColor(142,151,168);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${data.length} OM`, 148, 26, {align:'center'});
  doc.setDrawColor(11,79,158); doc.line(20, 30, 290, 30);

  // Build table
  const rows = data.slice().reverse().map(o => [
    o.numero || '—',
    o.employe || '—',
    o.date || '—',
    (o.depart||'') + ' → ' + (o.arrivee||''),
    (o.objet||'').substring(0,30),
    o.transport || '—',
    {approved:'✅ Approuvé', rejected:'❌ Rejeté', pending:'⏳ En attente'}[o._status||'pending'],
    {firebase:'☁️ FB', local:'💻 Local', both:'✅ Les deux'}[o._source]||'—'
  ]);

  doc.autoTable({
    startY: 35, head: [['N° OM','Collaborateur','Date','Trajet','Objet','Transport','Statut','Source']],
    body: rows, margin: {left:15, right:15},
    theme: 'grid', headStyles: {fillColor: [11,79,158], fontSize:7},
    bodyStyles: {fontSize:6}, styles: {cellPadding:2},
    didDrawPage: (d) => { /* footer handled below */ }
  });

  const fy = doc.lastAutoTable.finalY + 6;
  doc.setDrawColor(200); doc.line(15, fy, 280, fy);
  doc.setFontSize(7); doc.setTextColor(142,151,168);
  doc.text('eqnovia · Notes de Frais · Ordres de mission globaux', 148, fy + 4, {align:'center'});
  doc.save(`om_global_${new Date().toISOString().split('T')[0]}.pdf`);
  toast('📄 Export PDF des OM téléchargé !');
}

function adminOMExportExcel() {
  const data = _adminOMFiltered;
  if (!data.length) { toast('Aucune donnée à exporter.', 'err'); return; }
  
  const rows = [
    ['eqnovia · Ordres de mission (Admin Global)', '', '', '', '', '', '', ''],
    [`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${data.length} OM`, '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['N° OM', 'Collaborateur', 'Date', 'Départ', 'Arrivée', 'Objet', 'Statut', 'Source']
  ];
  
  data.slice().reverse().forEach(o => {
    rows.push([
      o.numero || '—',
      o.employe || '—',
      o.date || '—',
      o.depart || '—',
      o.arrivee || '—',
      o.objet || '—',
      {approved:'Approuvé', rejected:'Rejeté', pending:'En attente'}[o._status||'pending'],
      {firebase:'Firebase', local:'Local', both:'Les deux'}[o._source]||'—'
    ]);
  });
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:14},{wch:20},{wch:12},{wch:14},{wch:14},{wch:30},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'OM Global');
  XLSX.writeFile(wb, `om_global_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast('📊 Export Excel des OM téléchargé !');
}

// ════════════════════════════════════════════════════
// DATA LOAD — OM FROM FIREBASE
// ════════════════════════════════════════════════════
async function dataLoadOM() {
  // Merge Firebase OM data with local storage (Firebase wins on conflicts)
  if (useFirebase) {
    try {
      const fbData = await fbLoadOM();
      if (fbData && fbData.length > 0) {
        const localData = loadOMHistory();
        const localIds = new Set(localData.map(o => o._localId).filter(Boolean));
        let merged = [...localData];
        let changed = false;
        for (const fbItem of fbData) {
          if (!localIds.has(fbItem._localId)) {
            merged.push(fbItem);
            changed = true;
          }
        }
        // Also sync any local items to Firebase that weren't synced yet
        for (const local of localData) {
          if (!local._syncedToFB) {
            local._syncedToFB = true;
            local._localId = local._localId || (Date.now() + '_' + Math.random().toString(36).slice(2));
            fbAddOM(local);
            changed = true;
          }
        }
        if (changed) {
          // Use a direct save without triggering Firebase sync again
          localStorage.setItem(OM_STORAGE_KEY, JSON.stringify(merged));
        }
      }
    } catch(e) { console.warn('dataLoadOM error:', e); }
  }
  renderOMHistory();
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
async function init() {
  try {
    document.getElementById('dateInput').value = today();

    await new Promise(r => setTimeout(r, 2000));

    if (window.__fbReady) {
      useFirebase = true;
      document.getElementById('dbStatus').className = 'db-status db-online';
      document.getElementById('dbStatusText').textContent = 'Firebase connecté';
      toast('🔥 Base de données Firebase connectée !', 'info');
    } else {
      useFirebase = false;
      document.getElementById('dbStatus').className = 'db-status db-local';
      document.getElementById('dbStatusText').textContent = 'Stockage local';
      toast('💾 Mode local (localStorage)', 'info');
    }

    // Update mode status indicator
    updateModeStatus();

    await dataLoad();
    updateUserUI();
    updateKPIs();
    renderAll();
    
    // Initialize OM history (Firebase + localStorage merge)
    await dataLoadOM();  // also calls renderOMHistory() internally
    
    // Initialize mission orders (new system)
    await dataLoadMissionOrders();
    await dataLoadUserMissionOrders();
    
    // Render dashboard mission orders for non-admin users
    if (!isAdmin) renderDashboardMissionOrders();
    
    // Initialize bottom nav active state
    TABS.forEach(id => {
      document.getElementById(`bnav-${id}`)?.classList.toggle('active', id === activeTab);
    });
  } catch (error) {
    console.error('Init error:', error);
    toast('Erreur lors de l\'initialisation.', 'err');
  }
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', function() {
  // Synchronise les listes déroulantes avec les utilisateurs persistés
  updateLoginUserSelect();
  updateUserSelector();
  // Restaurer le dernier utilisateur sélectionné depuis le cache
  try {
    const lastUser = localStorage.getItem('eqnovia_lastUser');
    if (lastUser && USERS[lastUser]) {
      document.getElementById('loginUser').value = lastUser;
    }
  } catch(e) {}
  document.getElementById('loginOverlay').classList.remove('hidden');
});

// Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ════════════════════════════════════════════
// BACKUP MODULE — Justificatifs Photos
// ════════════════════════════════════════════

// Get all justificatifs from cache
function getAllJustificatifs() {
  const result = [];
  cache.forEach(e => {
    const files = getJustifFiles(e);
    files.forEach((f, fi) => {
      const url = f.storageUrl || f.data;
      if (!url) return;
      result.push({
        id: e.id + '_' + fi,
        expenseId: e.id,
        date: e.date,
        desc: e.desc + (files.length > 1 ? ` (justif ${fi+1}/${files.length})` : ''),
        user: e.user,
        justifData: url,
        justifName: f.name || 'Justificatif ' + (fi+1),
        amount: e.amount,
        cat: e.cat,
        mission: e.mission
      });
    });
  });
  return result;
}

// Convert base64 data URL to Blob
function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

// Local backup: Create ZIP and download
async function backupLocal() {
  const justificatifs = getAllJustificatifs();
  if (!justificatifs.length) {
    toast('Aucun justificatif à sauvegarder.', 'err');
    return;
  }

  toast('Création de la sauvegarde locale...', 'ok');

  try {
    const zip = new JSZip();
    const folder = zip.folder('justificatifs_backup');

    // Add metadata
    const metadata = justificatifs.map(j => ({
      id: j.id,
      date: j.date,
      description: j.desc,
      utilisateur: j.user,
      montant: j.amount,
      categorie: j.cat,
      mission: j.mission,
      nom_fichier: j.justifName
    }));
    folder.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Add images
    for (const j of justificatifs) {
      const blob = dataURLtoBlob(j.justifData);
      const ext = j.justifName ? j.justifName.split('.').pop() : 'jpg';
      const fileName = `${j.id}_${j.date}_${j.desc.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.${ext}`;
      folder.file(fileName, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_justificatifs_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast(`Sauvegarde locale créée: ${justificatifs.length} justificatif(s)`, 'ok');
  } catch (e) {
    console.error('Local backup error:', e);
    toast('Erreur lors de la sauvegarde locale.', 'err');
  }
}

// Firebase Storage backup
async function backupFirebase() {
  const justificatifs = getAllJustificatifs();
  if (!justificatifs.length) {
    toast('Aucun justificatif à sauvegarder sur Firebase.', 'err');
    return;
  }

  if (!window.__storage || !window.__fbReady) {
    toast('Firebase Storage non disponible. Vérifiez la configuration.', 'err');
    return;
  }

  toast('Sauvegarde sur Firebase Storage...', 'ok');
  let successCount = 0;
  let errorCount = 0;

  for (const j of justificatifs) {
    try {
      const blob = dataURLtoBlob(j.justifData);
      const ext = j.justifName ? j.justifName.split('.').pop() : 'jpg';
      const fileName = `frais/${j.id}_${j.date}_${j.user}.${ext}`;

      const storageRef = window.__storageRef(window.__storage, fileName);
      await window.__uploadBytes(storageRef, blob);
      const downloadURL = await window.__getDownloadURL(storageRef);

      // Update Firestore document with storage URL
      const { collection, getDocs, doc, query, where, updateDoc } = window.__fs;
      const q = query(collection(window.__db, 'expenses'), where('id', '==', j.id));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(doc(window.__db, 'expenses', d.id), {
          justifStorageUrl: downloadURL,
          justifStoragePath: fileName
        });
      }

      successCount++;
    } catch (e) {
      console.error('Firebase backup error for', j.id, e);
      errorCount++;
    }
  }

  if (errorCount === 0) {
    toast(`Sauvegarde Firebase terminée: ${successCount} fichier(s) uploadé(s)`, 'ok');
  } else {
    toast(`Sauvegarde Firebase: ${successCount} succès, ${errorCount} erreur(s)`, 'err');
  }
}

// Backup all justificatifs
async function backupAll() {
  const justificatifs = getAllJustificatifs();
  if (!justificatifs.length) {
    toast('Aucun justificatif à sauvegarder.', 'err');
    return;
  }

  toast(`Début de la sauvegarde de ${justificatifs.length} justificatif(s)...`, 'ok');

  // Local backup
  await backupLocal();

  // Firebase backup
  if (window.__fbReady && window.__storage) {
    await backupFirebase();
  }

  toast('Sauvegarde terminée !', 'ok');
}

// Render backup status
function renderBackupStatus() {
  const justificatifs = getAllJustificatifs();
  const count = justificatifs.length;
  const statusEl = document.getElementById('backupStatus');
  if (statusEl) {
    statusEl.innerHTML = `
      <div class="backup-status-card">
        <div class="backup-stat">
          <span class="backup-stat-number">${count}</span>
          <span class="backup-stat-label">Justificatifs disponibles</span>
        </div>
        <div class="backup-stat">
          <span class="backup-stat-number">${window.__fbReady ? '✅' : '❌'}</span>
          <span class="backup-stat-label">Firebase</span>
        </div>
      </div>
    `;
  }
}

// PWA Install Button
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.style.display = '';
});

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      toast('Application installée avec succès !', 'ok');
    }
    deferredPrompt = null;
    if (installBtn) installBtn.style.display = 'none';
  });
}
