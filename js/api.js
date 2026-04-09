/**
 * Envía una notificación de nueva transacción al administrador vía Telegram.
 * Llama a la Cloud Function 'sendTelegramAdmin' para mantener las credenciales seguras.
 * @param {Object} tx - Datos de la transacción (sender, name, amount, note, id).
 */
function sendTelegramAdmin(tx) {
    const fnUrl = 'https://us-central1-enmssellchanges-premium.cloudfunctions.net/sendTelegramAdmin';
    fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: tx })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) console.error("Error desde cloud function:", data.error);
    })
    .catch(err => console.error("Error llamando a sendTelegramAdmin:", err));
}

/**
 * Sends an email notification to the administrator about a new transaction.
 * @param {Object} transferData - The transaction details.
 */
function sendAdminEmail(transferData) {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbxPP-mK2tICYcq43pzKvJvAN4nrgUj7ahax5CSkB6evAPOjUJWBbh-TjSn4iOZHUPWc/exec";

    const payload = {
        user_name: "Administrador",
        user_email: "enmssellchanges@gmail.com",
        status: "pending",
        amount: transferData.amount,
        tx_id: transferData.id,
        date: transferData.date || new Date().toLocaleDateString('es-ES'),
        message: `Nueva orden de: ${transferData.sender} (${transferData.userEmail || 'N/A'}). Banco: ` + (transferData.vesData ? `VES: ${transferData.vesData.bank} ${transferData.vesData.account}` : (transferData.copData ? `COP: ${transferData.copData.bank} ${transferData.copData.account}` : 'Ver Admin')),
        es_admin: true
    };

    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
        .catch(err => console.error('Error al enviar email admin:', err));
}

/**
 * Sends an email notification to the user about their transaction status.
 * @param {Object} tx - The transaction details.
 * @param {string} status - The current status of the transaction (e.g., 'Procesando', 'completed', 'rejected').
 */
function sendUserNotification(tx, status) {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbxPP-mK2tICYcq43pzKvJvAN4nrgUj7ahax5CSkB6evAPOjUJWBbh-TjSn4iOZHUPWc/exec";

    let emailStatus = status === 'Procesando' ? 'pending' : status;

    let customMessage = '';
    if (status === 'rejected') {
        customMessage = `Motivo: ${tx.reason || 'Comunícate con soporte.'}`;
    } else if (status === 'completed') {
        customMessage = `El envío hacia ${tx.name} se ha completado con éxito.`;
        if (tx.reason && tx.reason.trim() !== '') {
            customMessage += `<br><br><strong>Mensaje del administrador:</strong> ${tx.reason}`;
        }
    } else {
        customMessage = `Hemos recibido tu solicitud de envío hacia ${tx.name} y la estamos procesando.`;
    }

    const payload = {
        user_name: tx.sender || 'Usuario',
        user_email: tx.userEmail,
        status: emailStatus,
        amount: tx.amount,
        tx_id: tx.id || 'N/A',
        date: tx.date || new Date().toLocaleDateString('es-ES'),
        message: customMessage
    };

    fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
        .catch(err => console.error('Error al enviar email a usuario:', err));
}

/**
 * Plays the notification sound for new alerts using Web Audio API.
 * Delegates to playNotificationSoundByPreference (defined in ui.js).
 */
async function playNotificationSound(silent = false) {
    if (silent) return; // Ya no necesitamos desbloquear con elemento <audio>

    // Leer preferencia de localStorage (sincrónico, sin consulta a Firestore)
    let soundPreference = localStorage.getItem('notif-sound-pref') || 'default';

    // Intentar sincronizar con Firestore si el usuario está autenticado
    if (auth && auth.currentUser) {
        try {
            const doc = await db.collection('users').doc(auth.currentUser.uid).get();
            if (doc.exists && doc.data().notificationSound) {
                soundPreference = doc.data().notificationSound;
                localStorage.setItem('notif-sound-pref', soundPreference);
            }
        } catch (e) { /* usa el valor en localStorage */ }
    }

    // Delegar al motor de audio definido en ui.js
    if (typeof playNotificationSoundByPreference === 'function') {
        playNotificationSoundByPreference(soundPreference);
    }
}

/**
 * Fetches current P2P exchange rates from Binance for various currencies
 * using a Google Apps Script proxy. Updates UI and spreadsheet data.
 */
async function fetchBinanceP2P() {

    const configs = [
        { id: 'clp', fiat: 'CLP', tradeType: 'BUY', amount: 50000, payTypes: [] },
        { id: 'cop', fiat: 'COP', tradeType: 'SELL', amount: 60000, payTypes: ["Bancolombia", "Nequi"] },
        { id: 'pen', fiat: 'PEN', tradeType: 'SELL', amount: 70, payTypes: ["CreditBankOfPeru", "Yape"] },
        { id: 'ves', fiat: 'VES', tradeType: 'SELL', amount: 20000, payTypes: ["BBVAProvincial", "PagoMovil"] },
        { id: 'usd', fiat: 'USD', tradeType: 'SELL', amount: 100, payTypes: ["Zelle"] },
        { id: 'ecs', fiat: 'USD', tradeType: 'SELL', amount: 20, payTypes: ["BancoPichincha", "BancoGuayaquil"] }
    ];

    const target = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
    const mapCells = { clp: 'A3', ves: 'B3', cop: 'C3', pen: 'D3', usd: 'F3', ecs: 'E3' };

    // Usaremos tu propio Google Apps Script como proxy privado infalible
    const GAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbxPP-mK2tICYcq43pzKvJvAN4nrgUj7ahax5CSkB6evAPOjUJWBbh-TjSn4iOZHUPWc/exec";

    for (const conf of configs) {
        const display = document.getElementById(`binance-price-${conf.id}`);
        const updateTime = document.getElementById(`binance-time-${conf.id}`);
        if (!display) continue;

        const payload = {
            action: 'binanceP2P',
            binancePayload: {
                asset: "USDT",
                fiat: conf.fiat,
                merchantCheck: true,
                page: 1,
                payTypes: conf.payTypes,
                publisherType: conf.id === 'ves' ? null : "merchant",
                rows: 5,
                tradeType: conf.tradeType,
                transAmount: conf.amount
            }
        };

        let success = false;
        let finalPrice = null;
        let attempts = 0;
        const maxAttempts = 2; // Retry once if it fails

        while (!success && attempts < maxAttempts) {
            attempts++;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);

                const response = await fetch(GAS_PROXY_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response && response.ok) {
                    const json = await response.json();

                    if (!json || !json.data || !Array.isArray(json.data) || json.data.length === 0) {
                        throw new Error("Invalid or empty Binance response data");
                    }

                    const startIdx = json.data.length >= 2 ? 1 : 0;
                    const adsToUse = json.data.slice(startIdx, startIdx + 3);
                    const prices = adsToUse.map(item => parseFloat(item.adv.price));

                    if (prices.length === 0) throw new Error("No prices found");

                    finalPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(4);
                    // Store globally for calculation
                    window.binancePrices = window.binancePrices || {};
                    window.binancePrices[conf.id.toUpperCase()] = parseFloat(finalPrice);

                    success = true;

                } else {
                    throw new Error(`GAS returned status ${response.status}`);
                }
            } catch (err) {
                console.warn(`GAS Proxy failed for ${conf.id} on attempt ${attempts}:`, err);
                if (attempts >= maxAttempts) {
                    console.error(`Giving up on ${conf.id} after ${maxAttempts} attempts`);
                    display.innerText = "Error Proxy";
                    if (updateTime) updateTime.innerText = "Reintentando...";
                } else {
                    // Slight delay before retry
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            if (success && finalPrice) {
                let formattedPrice = parseFloat(finalPrice).toLocaleString('es-CL');
                display.innerText = `$${formattedPrice} ${conf.fiat}`;
                if (updateTime) updateTime.innerText = `Actualizado: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                const card = display.parentElement;
                if (card) {
                    card.classList.add('update-pulse');
                    setTimeout(() => card.classList.remove('update-pulse'), 3000);
                }

                const targetCell = mapCells[conf.id];
                if (targetCell) {
                    if (typeof ssData !== 'undefined') {
                        ssData[targetCell] = finalPrice;
                    }
                    const cellInput = document.getElementById(`ss-${targetCell}`);
                    if (cellInput && document.activeElement !== cellInput) {
                        cellInput.value = finalPrice;
                    }
                }
            }
        }
    }

    // Marcar como completado el fetch de esta ronda
    window.binanceFetchComplete = true;

    if (typeof refreshSpreadsheet === 'function') {
        refreshSpreadsheet();
    }
    // Nota: las tasas se actualizan automáticamente via Cloud Function (autoUpdateRates)
    // que corre cada 15 minutos en el servidor, sin depender de ningún usuario conectado.
}

/**
 * Backwards compatible fetch for Monitor rate.
 * @deprecated Use window.fetchMonitorRate instead.
 * @returns {Promise<number|null>} The numeric rate or null if failed.
 */
async function fetchMonitorRate() {
    try {
        const response = await fetch('https://api.yadio.io/json/?t=' + Date.now(), { cache: 'no-store' });
        const data = await response.json();
        if (data && data.USD && data.USD.VES) {
            const rawRate = data.USD.VES;
            // Guardar en variables globales referenciales igual que el BCV
            AppConfig.monitorNumeric = parseFloat(rawRate);
            AppConfig.monitorRate = AppConfig.monitorNumeric.toFixed(2).replace('.', ',');

            return AppConfig.monitorNumeric;
        }
    } catch (err) {
        console.warn('Fetch Yadio failed:', err);
    }
    return null;
}

// Helper to upload base64 to Firebase Storage with security metadata
/**
 * Uploads a base64 string image to Firebase Storage and returns the download URL.
 * Includes necessary metadata for backend rules evaluation.
 *
 * @param {string} base64Data - The image data in base64 format.
 * @param {string} path - The storage path where the file will be saved.
 * @param {Object} customMetadata - Additional metadata to append to the file.
 * @returns {Promise<string>} The public download URL.
 */
async function uploadBase64ToStorage(base64Data, path, customMetadata = {}) {
    if (!base64Data || !base64Data.startsWith('data:')) return base64Data;

    try {
        const ref = storage.ref(path);

        // Setup metadata for security rules
        const metadata = {
            contentType: 'image/jpeg',
            customMetadata: {}
        };

        if (Object.keys(customMetadata).length > 0) {
            metadata.customMetadata = customMetadata;
        } else if (typeof user !== 'undefined' && user && user.uid) {
            // Default to adding userId if user is logged in (for user uploads)
            metadata.customMetadata = { userId: user.uid };
        }

        const snapshot = await ref.putString(base64Data, 'data_url', metadata);
        const url = await snapshot.ref.getDownloadURL();
        return url;
    } catch (e) {
        console.error("Error uploading to storage:", e);
        throw e;
    }
}

// --- CENTRALIZED STATE & FIREBASE API ---
window.AppConfig = {
    countries: [],
    bcvRate: 0,
    bcvNumeric: 0,
    monitorRate: 0,
    monitorNumeric: 0,
    adminFactor: 0.94,
    accounts: []
};

window.FirebaseAPI = {
    initSettingsListeners: function () {
        if (!db) return;

        // Listen to Countries
        db.collection('settings').doc('countries').onSnapshot(doc => {
            if (doc.exists) {
                const docData = doc.data();
                let data = docData.list;

                // FORCE REORDER: Venezuela (VES) must be first (index 1, as index 0 is Chile)
                if (data && data.length > 2) {
                    const vesIdx = data.findIndex(c => c.code === 'VES');
                    const copIdx = data.findIndex(c => c.code === 'COP');
                    if (vesIdx !== -1 && vesIdx !== 1) {

                        const vesItem = data.splice(vesIdx, 1)[0];
                        data.splice(1, 0, vesItem);
                    }
                }

                window.AppConfig.countries = data;

                if (docData.lastUpdate) {
                    window.ratesLastUpdate = docData.lastUpdate;
                    const updateEl = document.getElementById('global-update-time');
                    if (updateEl) {
                        const dateObj = new Date(window.ratesLastUpdate);
                        // Using same hour from monitor (CLP Monitor triggered this update)
                        updateEl.innerText = `Actualizado: ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                    }
                }

                // Track previous countries to blink UI if changed
                const previousCountries = JSON.stringify(AppConfig.countries || []);

                if (window.sourceCountry) window.sourceCountry = AppConfig.countries.find(c => c.code === window.sourceCountry.code) || AppConfig.countries[0];
                if (window.destCountry) window.destCountry = AppConfig.countries.find(c => c.code === window.destCountry.code) || AppConfig.countries[2];
                if (window.quickSourceCountry) window.quickSourceCountry = AppConfig.countries.find(c => c.code === window.quickSourceCountry.code) || AppConfig.countries[0];
                if (window.quickDestCountry) window.quickDestCountry = AppConfig.countries.find(c => c.code === window.quickDestCountry.code) || AppConfig.countries[2];

                if (typeof renderHomeRates === 'function') renderHomeRates();
                if (typeof renderRatesEditor === 'function') renderRatesEditor();
                if (typeof calculate === 'function') calculate();
                if (typeof calculateQuick === 'function') calculateQuick();

                const newCountries = JSON.stringify(AppConfig.countries);
                if (previousCountries !== '[]' && previousCountries !== newCountries) {
                    setTimeout(() => {
                        document.querySelectorAll('.home-rate-card, .search-bar').forEach(card => {
                            card.style.transition = 'background-color 0.3s ease';
                            card.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                            setTimeout(() => {
                                card.style.backgroundColor = '';
                            }, 1500);
                        });
                    }, 50);
                }
            } else if (window.user && window.user.isAdmin) {
                db.collection('settings').doc('countries').set({ list: window.defaultCountries });
            }
        });

        // Listen to BCV
        db.collection('settings').doc('bcv').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                window.AppConfig.bcvRate = data.rate;
                window.AppConfig.bcvNumeric = data.numeric;
                window.bcvLastUpdate = data.lastUpdate;

                if (typeof renderBCV === 'function') renderBCV();
                if (typeof calculate === 'function') calculate();
                if (typeof calculateQuick === 'function') calculateQuick();
            }
        });

        // Listen to Monitor (Yadio)
        db.collection('settings').doc('monitor').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                window.AppConfig.monitorRate = data.rate;
                window.AppConfig.monitorNumeric = data.numeric;
                window.monitorLastUpdate = data.lastUpdate;

                // Sync Monitor Input specifically if it exists (Admin Panel)
                const monitorInput = document.getElementById('monitor-manual-rate-input');
                if (monitorInput && document.activeElement !== monitorInput) {
                    monitorInput.value = data.numeric;
                }

                if (typeof renderMonitor === 'function') renderMonitor();
                if (typeof calculate === 'function') calculate();
                if (typeof calculateQuick === 'function') calculateQuick();
            }
        });

        // Listen to Admin Factor
        db.collection('settings').doc('adminFactor').onSnapshot(doc => {
            if (doc.exists) {
                const val = doc.data().value || 0.94;
                window.AppConfig.adminFactor = val;

                if (typeof renderRatesEditor === 'function') renderRatesEditor();
            } else if (window.user && window.user.isAdmin) {
                db.collection('settings').doc('adminFactor').set({ value: 0.94 });
            }
        });

        // Listen to Accounts (Admin)
        db.collection('settings').doc('accounts').onSnapshot(doc => {
            if (doc.exists) {
                window.AppConfig.accounts = doc.data().list || [];
                if (typeof renderAdminAccounts === 'function') renderAdminAccounts();
            }
        });

        // Listen to Global Version (Force Refresh)
        let initialVersionLoad = true;
        db.collection('settings').doc('version').onSnapshot(doc => {
            if (doc.exists) {
                const currentVersion = doc.data().v;
                if (!initialVersionLoad && window.AppConfig.appVersion && window.AppConfig.appVersion !== currentVersion) {

                    window.location.reload(true);
                }
                window.AppConfig.appVersion = currentVersion;
                initialVersionLoad = false;
            } else if (window.user && window.user.isAdmin) {
                db.collection('settings').doc('version').set({ v: Date.now() });
            }
        });
    },

    saveRates: async function (newCountries, newBCVRate, newBCVNumeric, newAdminFactor, newMonitorRate, newMonitorNumeric) {
        if (!db) return Promise.reject("Firebase no inicializado");

        const promises = [];
        const isoTime = new Date().toISOString();
        promises.push(db.collection('settings').doc('countries').set({
            list: newCountries,
            lastUpdate: isoTime
        }));
        promises.push(db.collection('settings').doc('bcv').set({
            rate: newBCVRate,
            numeric: newBCVNumeric,
            lastUpdate: isoTime
        }));
        const mRate = newMonitorRate || AppConfig.monitorRate;
        const mNumeric = newMonitorNumeric || AppConfig.monitorNumeric;
        if (mRate !== undefined && mNumeric !== undefined) {
            promises.push(db.collection('settings').doc('monitor').set({
                rate: mRate,
                numeric: mNumeric,
                lastUpdate: isoTime
            }));
        }
        promises.push(db.collection('settings').doc('adminFactor').set({
            value: newAdminFactor,
            lastUpdate: isoTime
        }));

        return Promise.all(promises);
    }
};

// Global function to fetch Monitor Rate (Yadio) with proxy fallback
/**
 * Fetches the USD/VES exchange rate from the Yadio API.
 * Uses a proxy as a fallback if the direct request fails.
 *
 * @returns {Promise<number|null>} The fetched rate or null on failure.
 */
window.fetchMonitorRate = async function () {
    const ts = Date.now();
    const urls = [
        `https://api.yadio.io/rate/VES?t=${ts}`, // Direct
        `https://corsproxy.io/?https://api.yadio.io/rate/VES?t=${ts}` // Proxy
    ];

    for (const url of urls) {
        try {

            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) continue;
            const data = await response.json();

            // Yadio object currently: { "usd": 644.17, ... }
            if (data && data.usd) {
                // Use exact Yadio format
                const price = parseFloat(data.usd);

                // Do not update window.AppConfig locally here, 
                // let admin.js compare it and save it to Firestore to propagate properly.

                return price;
            }
        } catch (e) {
            console.warn(`Error en fetch a ${url}:`, e);
        }
    }
    return null;
};

/**
 * Utility to compress images before uploading to Storage
 * Ensures faster performance and lower storage/bandwidth costs
 */
async function compressImage(base64Str, maxWidth = 1000, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
    });
}
