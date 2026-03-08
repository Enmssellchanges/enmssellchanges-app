// --- CONFIGURACIÓN DE NOTIFICACIONES EXTERNAS ---
// Reemplaza con tus datos de Telegram para recibir avisos con la web cerrada
const TELEGRAM_CONFIG = {
    token: '8640685427:AAG3o95Bh8cY4AAmAF-DHRj4iQ33WxL-EX8', // Ejemplo: '123456:ABC-DEF...'
    chatId: '8424194336'      // Ejemplo: '987654321'
};

function sendTelegramAdmin(tx) {
    if (!TELEGRAM_CONFIG.token) return;

    // Use HTML instead of Markdown to avoid issues with special characters like "_" or "*"
    const message = `<b>🚀 NUEVO ENVÍO RECIBIDO</b>\n\n` +
        `👤 <b>Remitente:</b> ${tx.sender}\n` +
        `👤 <b>Destinatario:</b> ${tx.name}\n` +
        `💰 <b>Monto:</b> ${tx.amount}\n` +
        `📝 <b>Nota:</b> ${tx.note || 'N/A'}\n` +
        `🆔 <b>TX ID:</b> <code>${tx.id || 'N/A'}</code>\n\n` +
        `👉 Revisa el panel de admin para procesar.`;

    const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.token}/sendMessage`;

    const params = {
        chat_id: TELEGRAM_CONFIG.chatId,
        text: message,
        parse_mode: 'HTML'
    };

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    })
        .then(res => {
            if (!res.ok) {
                return res.json().then(errorData => {
                    console.error("Error detallado de Telegram:", errorData);
                });
            }

        })
        .catch(err => console.error("Fallo de conexión enviando Telegram:", err));
}

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

function playNotificationSound(silent = false) {
    const sound = document.getElementById('notification-sound');
    if (!sound) return;

    if (silent) {
        sound.muted = true;
        sound.play().then(() => {
            sound.pause();
            sound.muted = false;
        }).catch(() => { });
        return;
    }

    sound.currentTime = 0;
    sound.play().catch(e => console.warn("Interacción requerida para sonido:", e));
}

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

function renderBCV() {
    const bcvDisplay = document.getElementById('bcv-rate-display');
    if (bcvDisplay) {
        bcvDisplay.innerText = `${AppConfig.bcvRate} Bs/USD`;
    }
}

function renderMonitor() {
    const monitorDisplay = document.getElementById('monitor-rate-display');
    if (monitorDisplay) {
        monitorDisplay.innerText = `${AppConfig.monitorRate} Bs/USD`;
    }
}

// Helper to upload base64 to Firebase Storage with security metadata
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
                        console.log("Forcing Venezuela to index 1...");
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
                    console.log("Nueva versión detectada. Recargando para aplicar cambios...");
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
window.fetchMonitorRate = async function () {
    const ts = Date.now();
    const urls = [
        `https://api.yadio.io/rate/VES?t=${ts}`, // Direct
        `https://corsproxy.io/?https://api.yadio.io/rate/VES?t=${ts}` // Proxy
    ];

    for (const url of urls) {
        try {
            console.log(`Intentando extraer precio de Monitor desde: ${url}`);
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) continue;
            const data = await response.json();

            // Yadio object currently: { "usd": 644.17, ... }
            if (data && data.usd) {
                // Use exact Yadio format
                const price = parseFloat(data.usd);
                console.log("Precio extraído con éxito:", price);

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
