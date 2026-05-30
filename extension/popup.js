'use strict';

// ── Configuration ─────────────────────────────────────────────────────────────
// Pour une instance auto-hébergée, modifiez ces deux constantes.
const API_URL   = 'https://api-secret.nicob.ovh';
const FRONT_URL = 'https://secret.nicob.ovh';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewLoading        = document.getElementById('view-loading');
const viewNotConnected   = document.getElementById('view-not-connected');
const viewGenerate       = document.getElementById('view-generate');

const btnGenerate        = document.getElementById('btn-generate');
const btnOpenSite        = document.getElementById('btn-open-site');
const btnRetry           = document.getElementById('btn-retry');

const secretEl           = document.getElementById('secret');
const ttlEl              = document.getElementById('ttl');

const resultEl           = document.getElementById('result');
const resultUrlEl        = document.getElementById('result-url');
const errorEl            = document.getElementById('error');
const notConnectedHint   = document.getElementById('not-connected-hint');
const toastEl            = document.getElementById('toast');

// ── Init ──────────────────────────────────────────────────────────────────────
checkAuth();

// ── Auth check ────────────────────────────────────────────────────────────────
async function checkAuth() {
  showView(viewLoading);
  try {
    const response = await fetch(`${API_URL}/users/me`, {
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
      "Impossible de joindre le serveur.";
    showView(viewNotConnected);
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
function showView(el) {
  [viewLoading, viewNotConnected, viewGenerate].forEach(v => {
    v.classList.add('hidden');
  });
  el.classList.remove('hidden');
}

btnRetry.addEventListener('click', () => checkAuth());

btnOpenSite.addEventListener('click', () => {
  window.open(FRONT_URL, '_blank');
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
    const response = await fetch(`${API_URL}/links/bulk`, {
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
    const linkUrl = `${FRONT_URL}/redeem/${encodeURIComponent(result.link_token)}`;

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

function hideSettingsFeedback() {
  settingsFeedbackEl.textContent = msg;
  settingsFeedbackEl.className   = `feedback ${type}`;
}
