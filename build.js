const fs = require('fs');
const path = require('path');

// Load .env file (optional - for local development)
const envPath = path.join(__dirname, '.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
} else {
  console.log('ℹ️  No .env file found, using default values');
}

// Base URL for subdirectory deployments (e.g., GitHub Pages)
// Set VITE_BASE_URL=/repo-name/ in .env or as environment variable for GitHub Pages
const baseUrl = (envVars['VITE_BASE_URL'] || process.env.VITE_BASE_URL || '/').trim();
console.log(`ℹ️  Base URL: ${baseUrl}`);

// Read index.html
const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Replace Firebase config placeholders (individual values)
const replacements = {
  'VITE_FIREBASE_API_KEY': 'apiKey',
  'VITE_FIREBASE_AUTH_DOMAIN': 'authDomain',
  'VITE_FIREBASE_PROJECT_ID': 'projectId',
  'VITE_FIREBASE_STORAGE_BUCKET': 'storageBucket',
  'VITE_FIREBASE_MESSAGING_SENDER_ID': 'messagingSenderId',
  'VITE_FIREBASE_APP_ID': 'appId'
};

Object.entries(replacements).forEach(([envKey, configKey]) => {
  const value = envVars[envKey];
  if (value) {
    // Support both quoted ("configKey":) and unquoted (configKey:) key formats
    const regex = new RegExp(`("?${configKey}"?\s*:\s*")[^"]*(")`, 'g');
    html = html.replace(regex, `$1${value}$2`);
  }
});

// Replace entire firebaseConfig object if VITE_FIREBASE_CONFIG is provided
if (envVars['VITE_FIREBASE_CONFIG']) {
  try {
    const configObj = JSON.parse(envVars['VITE_FIREBASE_CONFIG']);
    const configStr = JSON.stringify(configObj, null, 6);
    const configRegex = /const firebaseConfig = \{[^}]+\}/s;
    html = html.replace(configRegex, `const firebaseConfig = ${configStr}`);
  } catch (e) {
    console.warn('⚠️  VITE_FIREBASE_CONFIG is not valid JSON, using individual values instead');
  }
}

// Replace user password placeholders
const userPasswordReplacements = {
  '__ADMIN_PASSWORD__': envVars['VITE_USER_ADMIN_PASSWORD'],
  '__USER1_PASSWORD__': envVars['VITE_USER_USER1_PASSWORD'],
  '__USER2_PASSWORD__': envVars['VITE_USER_USER2_PASSWORD'],
  '__USER3_PASSWORD__': envVars['VITE_USER_USER3_PASSWORD'],
  '__USER4_PASSWORD__': envVars['VITE_USER_USER4_PASSWORD'],
  '__USER5_PASSWORD__': envVars['VITE_USER_USER5_PASSWORD'],
  '__USER6_PASSWORD__': envVars['VITE_USER_USER6_PASSWORD']
};

Object.entries(userPasswordReplacements).forEach(([placeholder, password]) => {
  if (password) {
    html = html.replace(new RegExp(placeholder, 'g'), password);
  }
});

// Write to dist/
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Update manifest.json with base URL if needed
const manifestPath = path.join(__dirname, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Update start_url with base URL for subdirectory deployments
  if (baseUrl !== '/' && manifest.start_url === './') {
    manifest.start_url = baseUrl;
  } else if (baseUrl === '/' && manifest.start_url === './') {
    // Keep relative for root deployments
    manifest.start_url = './';
  }
  
  // Update scope if present
  if (manifest.scope && baseUrl !== '/') {
    manifest.scope = baseUrl;
  }
  
  fs.writeFileSync(path.join(distPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`✅ manifest.json updated with base URL: ${baseUrl}`);
}

// Update service worker with base URL if needed
const swPath = path.join(__dirname, 'sw.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  
  // Replace root path with base URL in service worker
  if (baseUrl !== '/') {
    sw = sw.replace("'./',", `'${baseUrl}',`);
  }
  
  fs.writeFileSync(path.join(distPath, 'sw.js'), sw);
  console.log(`✅ sw.js updated with base URL: ${baseUrl}`);
}

fs.writeFileSync(path.join(distPath, 'index.html'), html);

// Also copy to root for direct browser access
fs.writeFileSync(path.join(__dirname, 'index.html'), html);

// Copy static assets (icons, CSS, JS)
const staticAssets = ['icon-192.png', 'icon-512.png', 'style.css', 'app.js', 'logo.PNG'];
staticAssets.forEach((file) => {
  const src = path.join(__dirname, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distPath, file));
  }
});

console.log('✅ Build complete: dist/ generated');
