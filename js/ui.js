function getCountryLabel(country) {
  if (!country) return '';
  return country.name || countryNameMap[country.code] || country.code;
}

function updateConnectionStatus() {
  const statusText = document.getElementById('status-text');
  const statusIcon = document.querySelector('#connection-status .material-icons');
  const container = document.getElementById('connection-status');
  if (!statusText || !statusIcon || !container) return;
  if (navigator.onLine) {
    statusText.innerText = "Cloud Live";
    statusIcon.innerText = "cloud_done";
    statusIcon.style.color = "var(--success)";
    container.style.borderColor = "rgba(16, 185, 129, 0.3)";
    container.style.background = "rgba(16, 185, 129, 0.1)";
  } else {
    statusText.innerText = "Offline";
    statusIcon.innerText = "cloud_off";
    statusIcon.style.color = "var(--error)";
    container.style.borderColor = "rgba(239, 68, 68, 0.3)";
    container.style.background = "rgba(239, 68, 68, 0.1)";
  }
}

function showView(view) {
  // Auth Check for sensitive views
  const sensitiveViews = ['send', 'history', 'admin', 'profile'];
  if (sensitiveViews.includes(view) && !user) {
    console.warn("Unauthenticated access to:", view);
    openLogin();
    return;
  }

  const views = ['home', 'send', 'history', 'tracking', 'admin', 'profile'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.style.display = v === view ? v === 'home' ? 'flex' : 'block' : 'none';

    // Update Desktop Nav
    const navLink = document.getElementById(`nav-${v}`);
    if (navLink) navLink.classList.toggle('active', v === view);

    // Update Mobile Nav
    const mobLink = document.getElementById(`mob-${v === 'profile' ? 'account' : v}`);
    if (mobLink) mobLink.classList.toggle('active', v === view);
  });
  if (view === 'home') {
    renderHomeRates();
    calculateQuick();
  }
  if (view === 'send') {
    calculate();
    renderUserAccounts();
  }
  if (view === 'history') loadTransactions();
  if (view === 'admin') loadAdminData();
  if (view === 'profile') loadUserProfile();
  if (view === 'tracking') {
    updateTrackingUI();
    // Request interaction for audio if needed
    playNotificationSound(true); // Silent play to unlock audio
  }
  if (view === 'send') calculate(); // Standard refresh for send view

  // Scroll to top on view change
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function selectVesType(type) {
  // Update hidden input value
  const typeInput = document.getElementById('ves-type');
  if (typeInput) typeInput.value = type;

  // Update button styles
  const btnMobile = document.getElementById('ves-btn-mobile');
  const btnTransfer = document.getElementById('ves-btn-transfer');
  if (btnMobile && btnTransfer) {
    if (type === 'mobile') {
      btnMobile.style.border = '2px solid var(--gold)';
      btnMobile.style.background = 'rgba(204, 163, 83, 0.15)';
      btnMobile.style.color = 'var(--gold)';
      btnTransfer.style.border = '2px solid rgba(255,255,255,0.1)';
      btnTransfer.style.background = 'rgba(255,255,255,0.03)';
      btnTransfer.style.color = 'var(--text-muted)';
    } else {
      btnTransfer.style.border = '2px solid var(--gold)';
      btnTransfer.style.background = 'rgba(204, 163, 83, 0.15)';
      btnTransfer.style.color = 'var(--gold)';
      btnMobile.style.border = '2px solid rgba(255,255,255,0.1)';
      btnMobile.style.background = 'rgba(255,255,255,0.03)';
      btnMobile.style.color = 'var(--text-muted)';
    }
  }

  // Update account field label, placeholder and maxlength
  const accountLabel = document.getElementById('ves-account-label');
  const accountInput = document.getElementById('ves-account');
  if (!accountLabel || !accountInput) return;

  // Clear field when switching type to avoid invalid data
  accountInput.value = '';

  if (type === 'mobile') {
    accountLabel.innerText = "Número de Teléfono (Pago Móvil)";
    accountInput.placeholder = "Ej: 04123456789";
    accountInput.maxLength = 11;
  } else {
    accountLabel.innerText = "Número de Cuenta (Solo números - 20 dígitos)";
    accountInput.placeholder = "Ej: 01020000001234567890";
    accountInput.maxLength = 20;
  }
}

function toggleCopType() {
  const bank = document.getElementById('cop-bank').value;
  const accountLabel = document.getElementById('cop-account-label');
  const accountInput = document.getElementById('cop-account');
  if (!accountLabel || !accountInput) return;
  if (bank === 'Nequi') {
    accountLabel.innerText = "Número de Teléfono (Nequi)";
    accountInput.placeholder = "Ej: 3001234567";
    accountInput.maxLength = 10;
  } else {
    accountLabel.innerText = "Número de Cuenta (Bancolombia)";
    accountInput.placeholder = "";
    accountInput.maxLength = 20;
  }
}

function togglePenType() {
  const method = document.getElementById('pen-method').value;
  const bankContainer = document.getElementById('pen-bank-container');
  const accountLabel = document.getElementById('pen-account-label');
  const accountInput = document.getElementById('pen-account');
  if (!accountLabel || !accountInput || !bankContainer) return;
  if (method === 'Banco') {
    bankContainer.style.display = 'block';
    accountLabel.innerText = "Número de Cuenta";
    accountInput.placeholder = "Ej: 191...";
  } else {
    bankContainer.style.display = 'none';
    accountLabel.innerText = `Número de Teléfono(${method})`;
    accountInput.placeholder = "Ej: 987654321";
  }
}

function toggleUsaType() {
  const type = document.getElementById('usa-zelle-type').value;
  const label = document.getElementById('usa-zelle-label');
  const input = document.getElementById('usa-zelle-data');
  if (!label || !input) return;
  input.value = ""; // Clear on change to avoid partial data
  if (type === 'phone') {
    label.innerText = "Número de Teléfono (Zelle)";
    input.placeholder = "Ej: 1234567890";
  } else {
    label.innerText = "Correo Electrónico (Zelle)";
    input.placeholder = "Ej: usuario@correo.com";
  }
}

function handleUsaZelleInput(input) {
  const type = document.getElementById('usa-zelle-type').value;
  if (type === 'phone') {
    input.value = input.value.replace(/[^0-9]/g, '');
  }
}

function startNewPayment() {
  if (!user) {
    alert("Para realizar un envío debes iniciar sesión.");
    openLogin();
    return;
  }
  const amountVal = document.getElementById('quick-send-amount').value;
  const amount = parseFloat(amountVal) || 0;
  let minVal = 0;
  if (quickSourceCountry.code === 'CLP') {
    minVal = quickDestCountry.minCLP || 0;
  } else if (quickSourceCountry.code === 'VES') {
    minVal = Math.ceil(20 * AppConfig.bcvNumeric);
  }
  if (amount < minVal) {
    alert(`No puedes continuar: El monto mínimo es ${minVal.toLocaleString()} ${quickSourceCountry.code}(equivalente a 20 USD).`);
    return;
  }

  // Sync home state to payment form state
  sourceCountry = quickSourceCountry;
  destCountry = quickDestCountry;

  // Update payment form UI
  const sFlag = document.getElementById('source-flag');
  const sCode = document.getElementById('source-code');
  const dFlag = document.getElementById('dest-flag');
  const dCode = document.getElementById('dest-code');
  const sendInput = document.getElementById('send-amount');
  if (sFlag) sFlag.src = sourceCountry.flag;
  if (sCode) sCode.innerText = getCountryLabel(sourceCountry);
  if (dFlag) dFlag.src = destCountry.flag;
  if (dCode) dCode.innerText = getCountryLabel(destCountry);
  if (sendInput) sendInput.value = amountVal;
  calculate();
  showView('send');
}

function renderUserAccounts() {
  const list = document.getElementById('user-accounts-list');
  if (!list) return;
  if (typeof db !== 'undefined') {
    db.collection('settings').doc('accounts').onSnapshot(doc => {
      const accounts = doc.exists ? doc.data().list || [] : [];
      list.innerHTML = accounts.length ? accounts.map(a => `
                <div class="glass account-card">
                    <div class="bank-logo-container">
                        <img src="${getBankLogo(a.bank)}" class="bank-logo" alt="Logo">
                        <button class="copy-all-btn" onclick="copyAccountData('${a.bank}', '${a.name}', '${a.id}', '${a.number}', '${a.type}', '${a.email}')">
                            <span class="material-icons" style="font-size: 16px;">content_copy</span> COPIAR TODO
                        </button>
                    </div>
                    <div>
                        <div style="font-weight: 800; color: var(--text-main); font-size: 1.1rem; margin-bottom: 0.2rem; letter-spacing: 0.5px;">${a.bank}</div>
                        ${a.bank.toLowerCase().includes('estado') ? '<div style="color: #ff4d4d; font-size: 0.75rem; font-weight: bold; margin-bottom: 0.5rem;">DISPONIBLE SÓLO PARA CAJA VECINA</div>' : ''}
                        <div style="display: grid; grid-template-columns: 1fr; gap: 0.4rem; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;">
                                <span style="color: var(--accent-teal); font-weight: 600;">Titular:</span>
                                <span style="color: var(--text-main); font-weight: 500;">${a.name}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;">
                                <span style="color: var(--accent-teal); font-weight: 600;">Cédula/RUT:</span>
                                <span style="color: var(--text-main); font-weight: 500;">${a.id}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;">
                                <span style="color: var(--accent-teal); font-weight: 600;">Número:</span>
                                <span style="color: var(--text-main); font-weight: 500;">${a.number}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;">
                                <span style="color: var(--accent-teal); font-weight: 600;">Tipo:</span>
                                <span style="color: var(--text-main); font-weight: 500;">${a.type}</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="color: var(--accent-teal); font-weight: 600;">Email:</span>
                                <span style="color: var(--text-main); font-weight: 500; font-size: 0.75rem;">${a.email}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('') : '<p style="color: var(--error); font-size: 0.8rem;">Consulte con soporte para obtener datos de transferencia.</p>';
    });
  }
}

function copyAccountData(bank, name, id, number, type, email) {
  const textToCopy = `Banco: ${bank}
Titular: ${name}
RUT/Cédula: ${id}
Número de Cuenta: ${number}
Tipo: ${type}
Email: ${email}`;
  navigator.clipboard.writeText(textToCopy).then(() => {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons" style="font-size: 16px;">check</span> ¡COPIADO!';
    btn.style.background = 'var(--success)';
    btn.style.color = 'white';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  }).catch(err => {
    console.error('Error al copiar:', err);
  });
}

function updateTransferLogo(prefix) {
  const select = document.getElementById(`${prefix}-bank`);
  const container = document.getElementById(`${prefix}-logo-preview`);
  if (!select || !container) return;
  const bankName = select.value;
  const img = container.querySelector('img');
  if (!bankName) {
    container.style.display = 'none';
    return;
  }
  img.src = getBankLogo(bankName);
  container.style.display = 'flex';
}

function getBankLogo(bankName) {
  const name = bankName.toLowerCase();

  // Special case for Santander Chile as requested by user
  if (name.includes('santander')) {
    // High quality logo with "Santander" text as used in Chile
    return 'assets/img/logo-santander.png';
  }
  if (name.includes('banco estado') || name.includes('estado')) {
    return 'assets/img/logo-estado.png';
  }
  if (name.includes('bcv') || name.includes('banco central') || name.includes('central de venezuela')) {
    return 'assets/img/logo-bcv.webp?v=2';
  }
  const mapping = {
    'pichincha': 'pichincha.com',
    'guayaquil': 'bancoguayaquil.com',
    'chile': 'bancochile.cl',
    'bci': 'bci.cl',
    'bcp': 'viabcp.com',
    'interbank': 'interbank.pe',
    'scotiabank': 'scotiabank.cl',
    'itau': 'itau.com.br',
    'falabella': 'bancofalabella.cl',
    'ripley': 'bancoripley.cl',
    'mercantil': 'mercantilbanco.com',
    'banesco': 'banesco.com',
    'provincial': 'bbvaprovincial.com',
    'venezuela': 'bancodevenezuela.com',
    'bnc': 'bncenlinea.com',
    'bancolombia': 'bancolombia.com',
    'nequi': 'nequi.com.co',
    'yape': 'yape.com.pe',
    'plin': 'plin.com.pe'
  };
  for (let key in mapping) {
    if (name.includes(key)) return `https://www.google.com/s2/favicons?domain=${mapping[key]}&sz=64`;
  }
  return 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png'; // Generic bank icon
}

// Push Notifications Logic
async function requestNotificationPermission() {
  if (!messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await messaging.getToken({
        vapidKey: 'BF6tguCyIgYzrLj8Muw4y_W556OyGFn6p4GCmlTcxnrp4HUneKPBj10gXPn__jS9UcsT7Jwrpi6c1L2B0V3w6Spg'
      });
      if (token && user) {
        await db.collection('users').doc(user.uid).set({
          fcmToken: token
        }, {
          merge: true
        });

      }
    }
  } catch (err) {
    console.error('Error getting notification permission:', err);
  }
}

// Handle foreground notifications (when app is open)
if (typeof messaging !== 'undefined' && messaging) {
  messaging.onMessage((payload) => {

    const { title, body } = payload.notification || {};
    if (title && typeof showToast === 'function') {
      showToast(title, body || '');
    }
    // Play notification sound
    const sound = document.getElementById('notification-sound');
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(() => { });
    }
  });
}

// Foreground messaging handler

function showToast(title, message) {
  const toast = document.createElement('div');
  toast.className = 'glass';
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 10000;
    border: 1px solid var(--gold); border-radius: 16px;
    padding: 1.2rem; width: 320px; color: var(--text-main);
    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.6);
    animation: slideInNotification 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    display: flex; gap: 1rem; align-items: flex-start;
    `;
  toast.innerHTML = `
        <div style="background: rgba(204, 163, 83, 0.1); border-radius: 12px; padding: 0.6rem; display: flex;">
            <span class="material-icons" style="color: var(--gold);">notifications_active</span>
        </div>
        <div style="flex: 1;">
            <div style="font-weight: 800; color: var(--gold-light); margin-bottom: 2px; font-size: 0.9rem; letter-spacing: 0.5px;">${title}</div>
            <div style="font-size: 0.8rem; opacity: 0.9; line-height: 1.5; font-weight: 500;">${message}</div>
        </div>
    `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOutNotification 0.5s ease-in forwards';
    setTimeout(() => toast.remove(), 500);
  }, 6000);
}

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); // A4

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn("Could not play notification sound (Audio API blocked?):", e);
  }
}

function copyToClipboard(text, btn) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons" style="font-size: 14px;">check</span>';
    btn.style.color = 'var(--success)';
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.style.color = '';
    }, 2000);
  }).catch(err => {
    console.error("Could not copy:", err);
    alert("Error al copiar");
  });
}

function renderAccountData(data, isHistory = false) {
  const fields = [{
    label: 'Nombre',
    value: data.name || data.owner,
    copyable: true
  }, {
    label: 'Cédula/ID',
    value: data.id,
    copyable: true
  }, {
    label: 'Banco',
    value: data.bank || data.method,
    copyable: false
  }, {
    label: 'Cuenta/Tel',
    value: data.account || data.number || data.phone || data.data,
    copyable: true
  }, {
    label: 'Tipo',
    value: data.type || data.method || data.docType,
    copyable: false
  }, {
    label: 'Email',
    value: data.email,
    copyable: true
  }];
  const copyAllText = fields.filter(f => f.value && f.value !== 'S/N').map(f => `${f.label}: ${f.value}`).join('\n');
  const fontSize = isHistory ? '0.7rem' : '0.82rem';
  const iconSize = isHistory ? '12px' : '14px';
  return `
        <div style="margin-bottom: 0.8rem; display: flex; justify-content: flex-end;">
            <button class="btn-signin" style="font-size: 0.65rem; padding: 4px 10px; background: rgba(20, 184, 166, 0.1); color: var(--accent-teal); border-color: rgba(20, 184, 166, 0.3); display: flex; align-items: center; gap: 4px;" onclick="copyToClipboard(\`${copyAllText.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, this)">
                <span class="material-icons" style="font-size: 14px;">content_copy</span> COPIAR TODO
            </button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; font-size: ${fontSize};">
            ${fields.filter(f => f.value && f.value !== 'S/N').map(f => `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="color: var(--text-muted); font-size: ${isHistory ? '0.6rem' : '0.68rem'}; font-weight: 600; text-transform: uppercase;">${f.label}</span>
                    <div style="display: flex; align-items: center; gap: 5px; color: var(--text-main); font-weight: 500;">
                        <span style="word-break: break-all;">${f.value}</span>
                        ${f.copyable ? `
                        <button class="btn-signin" style="min-width: auto; padding: 2px; border: none; background: none; color: var(--accent-teal); cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="copyToClipboard('${f.value}', this)" title="Copiar">
                            <span class="material-icons" style="font-size: ${iconSize}; text-shadow: 0 0 5px rgba(20, 184, 166, 0.3);">content_copy</span>
                        </button>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        `;
}

// --- THEME LOGIC ---
const THEMES = ['theme-default', 'theme-modern', 'theme-light'];
let currentThemeIndex = 0;

function initTheme() {
  const savedTheme = localStorage.getItem('app-theme') || 'theme-default';
  currentThemeIndex = THEMES.indexOf(savedTheme) !== -1 ? THEMES.indexOf(savedTheme) : 0;
  applyTheme(THEMES[currentThemeIndex]);
}

function toggleTheme() {
  currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
  const newTheme = THEMES[currentThemeIndex];
  applyTheme(newTheme);
  localStorage.setItem('app-theme', newTheme);
}

function applyTheme(themeName) {
  // Remove all theme classes
  THEMES.forEach(t => document.body.classList.remove(t));
  if (themeName !== 'theme-default') {
    document.body.classList.add(themeName);
  }
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', initTheme);

// --- MODAL PROMOCIONAL ---
function openPromoModal(imageUrl, link) {
    const modal = document.getElementById('promo-modal');
    const image = document.getElementById('promo-modal-image');
    const linkEl = document.getElementById('promo-modal-link');

    if (!modal || !image) return;

    image.src = imageUrl;

    if (link) {
        linkEl.href = link;
        linkEl.style.pointerEvents = "auto";
    } else {
        linkEl.removeAttribute("href");
        linkEl.style.pointerEvents = "none";
    }

    modal.style.display = 'flex';
}

function closePromoModal() {
    const modal = document.getElementById('promo-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
