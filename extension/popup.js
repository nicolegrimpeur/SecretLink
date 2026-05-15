'use strict';

const DEFAULT_API_URL   = 'https://api-secret.nicob.ovh';
const DEFAULT_FRONT_URL = 'https://secret.nicob.ovh';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewLoading        = document.getElementById('view-loading');
const viewNotConnected   = document.getElementById('view-not-connected');
const viewGenerate       = document.getElementById('view-generate');
const viewSettings       = document.getElementById('view-settings');

const btnBack            = document.getElementById('btn-back');
const btnGenerate        = document.getElementById('btn-generate');
const btnSave            = document.getElementById('btn-save');
const btnOpenSite        = document.getElementById('btn-open-site');
const btnRetry           = document.getElementById('btn-retry');

const secretEl           = document.getElementById('secret');
const ttlEl              = document.getElementById('ttl');
const apiUrlEl           = document.getElementById('api-url');
const frontUrlEl         = document.getElementById('front-url');

const resultEl           = document.getElementById('result');
const resultUrlEl        = document.getElementById('result-url');
const errorEl            = document.getElementById('error');
const settingsFeedbackEl = document.getElementById('settings-feedback');
const notConnectedHint   = document.getElementById('not-connected-hint');
const toastEl            = document.getElementById('toast');

// ── State ─────────────────────────────────────────────────────────────────────
let currentApiUrl   = DEFAULT_API_URL;
let currentFrontUrl = DEFAULT_FRONT_URL;

// ── Init ──────────────────────────────────────────────────────────────────────
chrome.storage.local.get(['apiUrl', 'frontUrl'], ({ apiUrl, frontUrl }) => {
  currentApiUrl   = apiUrl   || DEFAULT_API_URL;
  currentFrontUrl = frontUrl || DEFAULT_FRONT_URL;

  checkAuth();
});

// ── Auth check ────────────────────────────────────────────────────────────────
async function checkAuth() {
  showView(viewLoading);
  try {
    const response = await fetch(`${currentApiUrl}/users/me`, {
      credentials: 'include',
    });
    if (response.ok) {
      hideError();
      hideResult();
      showView(viewGenerate);
    } else {
      notConnectedHint.textContent =
        "Connectez-vous sur le site web SecretLink pour utiliser l'extension.";
      showView(viewNotConnected);
    }
  } catch {
    notConnectedHint.textContent =
      "Impossible de joindre le serveur. Vérifiez l'URL de l'API dans les paramètres.";
    showView(viewNotConnected);
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
function showView(el) {
  [viewLoading, viewNotConnected, viewGenerate, viewSettings].forEach(v => {
    v.classList.add('hidden');
  });
  el.classList.remove('hidden');
}

// Boutons ⚙ présents sur plusieurs vues (classe partagée)
document.querySelectorAll('.btn-open-settings').forEach(btn => {
  btn.addEventListener('click', () => {
    apiUrlEl.value   = currentApiUrl;
    frontUrlEl.value = currentFrontUrl;
    hideSettingsFeedback();
    showView(viewSettings);
  });
});

btnBack.addEventListener('click', () => checkAuth());
btnRetry.addEventListener('click', () => checkAuth());

btnOpenSite.addEventListener('click', () => {
  chrome.tabs.create({ url: currentFrontUrl });
});

// ── Sauvegarde paramètres ────────────────────────────────────────────────────
btnSave.addEventListener('click', async () => {
  const apiUrl   = apiUrlEl.value.trim()   || DEFAULT_API_URL;
  const frontUrl = frontUrlEl.value.trim() || DEFAULT_FRONT_URL;

  try { new URL(apiUrl); } catch {
    showSettingsFeedback("URL de l'API invalide.", 'error');
    return;
  }
  try { new URL(frontUrl); } catch {
    showSettingsFeedback('URL du site invalide.', 'error');
    return;
  }

  btnSave.disabled    = true;
  btnSave.textContent = 'Enregistrement…';

  try {
    await chrome.storage.local.set({ apiUrl, frontUrl });
    currentApiUrl   = apiUrl;
    currentFrontUrl = frontUrl;
    showSettingsFeedback('Paramètres enregistrés !', 'success');
    setTimeout(() => checkAuth(), 900);
  } catch {
    showSettingsFeedback('Erreur lors de la sauvegarde.', 'error');
  } finally {
    btnSave.disabled    = false;
    btnSave.textContent = 'Enregistrer';
  }
});

// ── Génération du lien ────────────────────────────────────────────────────────
btnGenerate.addEventListener('click', async () => {
  const secret  = secretEl.value.trim();
  const ttlDays = parseInt(ttlEl.value, 10);

  if (!secret) {
    showError('Veuillez entrer un secret.');
    return;
  }
  if (isNaN(ttlDays) || ttlDays < 0 || ttlDays > 365) {
    showError('La durée doit être comprise entre 0 et 365 jours.');
    return;
  }

  const itemId = generateItemId();

  hideError();
  hideResult();
  setLoading(true);

  try {
    const response = await fetch(`${currentApiUrl}/links/bulk`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify([{ item_id: itemId, secret, ttl_days: ttlDays }]),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      showError(`Erreur ${response.status} — réponse inattendue du serveur.`);
      return;
    }

    if (response.status === 401) {
      notConnectedHint.textContent =
        'Votre session a expiré. Reconnectez-vous sur le site web.';
      showView(viewNotConnected);
      return;
    }
    if (!response.ok) {
      const msg = data?.error?.message || data?.message || `Erreur ${response.status}`;
      showError(msg);
      return;
    }

    const result = data?.results?.[0];

    if (!result) {
      showError('Réponse inattendue du serveur.');
      return;
    }
    if (result.status === 'duplicate_item_id') {
      showError('Identifiant déjà utilisé. Réessayez dans un instant.');
      return;
    }
    if (result.status !== 'created' || !result.link_token) {
      showError(result.error || 'La génération a échoué.');
      return;
    }

    // Reconstruire l'URL comme le fait le front Angular :
    // frontBaseUrl + '/redeem/' + encodeURIComponent(link_token)
    const linkUrl = `${currentFrontUrl}/redeem/${encodeURIComponent(result.link_token)}`;

    // Succès : copie automatique + toast
    try {
      await navigator.clipboard.writeText(linkUrl);
      showToast();
    } catch {
      // La copie peut échouer si le popup a perdu le focus
    }

    showResult(linkUrl);
    secretEl.value = '';

  } catch {
    showError("Impossible de joindre le serveur.");
  } finally {
    setLoading(false);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Génère un item_id au format YYYY-MM-DD HH-MM-SS (heure locale) */
function generateItemId() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    ` ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  );
}

function setLoading(active) {
  btnGenerate.disabled    = active;
  btnGenerate.textContent = active ? 'Génération en cours…' : 'Générer le lien';
}

function showResult(url) {
  resultUrlEl.textContent = url;
  resultEl.classList.remove('hidden');
}

function hideResult() {
  resultEl.classList.add('hidden');
  resultUrlEl.textContent = '';
}

let toastTimer = null;
function showToast() {
  toastEl.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 2500);
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
}

function showSettingsFeedback(msg, type) {
  settingsFeedbackEl.textContent = msg;
  settingsFeedbackEl.className   = `feedback ${type}`;
}

function hideSettingsFeedback() {
  settingsFeedbackEl.className = 'feedback hidden';
  settingsFeedbackEl.textContent = '';
}
