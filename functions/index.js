'use strict';

const { setGlobalOptions } = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

setGlobalOptions({ maxInstances: 1, region: 'us-central1' });

initializeApp();
const db = getFirestore();

// ── CONFIG ────────────────────────────────────────────────────────────────────

// Same configs used by the frontend fetchBinanceP2P()
const BINANCE_CONFIGS = [
    { id: 'CLP', fiat: 'CLP', tradeType: 'BUY', amount: 50000, payTypes: [] },
    { id: 'COP', fiat: 'COP', tradeType: 'SELL', amount: 60000, payTypes: ['Bancolombia', 'Nequi'] },
    { id: 'PEN', fiat: 'PEN', tradeType: 'SELL', amount: 70, payTypes: ['CreditBankOfPeru', 'Yape'] },
    { id: 'VES', fiat: 'VES', tradeType: 'SELL', amount: 20000, payTypes: ['BBVAProvincial', 'PagoMovil'] },
    { id: 'USD', fiat: 'USD', tradeType: 'SELL', amount: 100, payTypes: ['Zelle'] },
    { id: 'ECS', fiat: 'USD', tradeType: 'SELL', amount: 20, payTypes: ['BancoPichincha', 'BancoGuayaquil'] },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
async function fetchFrom(url, opts = {}, timeoutMs = 14000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...opts, signal: ctrl.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fetch Binance P2P prices directly.
 * Returns { CLP, COP, PEN, VES, USD, ECS } or throws.
 */
async function fetchBinancePrices() {
    const prices = {};
    for (const conf of BINANCE_CONFIGS) {
        const payload = {
            asset: 'USDT',
            fiat: conf.fiat,
            merchantCheck: true,
            page: 1,
            payTypes: conf.payTypes,
            publisherType: conf.id === 'VES' ? null : 'merchant',
            rows: 5,
            tradeType: conf.tradeType,
            transAmount: conf.amount,
        };

        let success = false;
        for (let attempt = 0; attempt < 2 && !success; attempt++) {
            try {
                const res = await fetchFrom('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`Binance status ${res.status}`);
                const json = await res.json();
                if (!json || !Array.isArray(json.data) || json.data.length === 0)
                    throw new Error('Empty Binance response');
                const startIdx = json.data.length >= 2 ? 1 : 0;
                const ads = json.data.slice(startIdx, startIdx + 3);
                const avg =
                    ads.reduce((s, a) => s + parseFloat(a.adv.price), 0) / ads.length;
                prices[conf.id] = parseFloat(avg.toFixed(4));
                success = true;
            } catch (err) {
                console.warn(`Binance fetch attempt ${attempt + 1} failed for ${conf.id}:`, err.message);
                if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
            }
        }
    }
    return prices;
}

/**
 * Fetch Yadio parallel dollar rate (VES/USD).
 * Returns numeric value or null on failure.
 */
async function fetchYadioRate() {
    try {
        const res = await fetchFrom(`https://api.yadio.io/json/?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        if (data && data.USD && data.USD.VES) return parseFloat(data.USD.VES);
    } catch (err) {
        console.warn('Yadio fetch failed:', err.message);
    }
    return null;
}

// ── CLOUD FUNCTION ────────────────────────────────────────────────────────────
exports.autoUpdateRates = onSchedule(
    {
        schedule: 'every 15 minutes',
        timeZone: 'America/Caracas',
        timeoutSeconds: 120,
    },
    async () => {
        console.log('[autoUpdateRates] Starting scheduled rate update...');

        // 1. Read current settings from Firestore (to preserve minCLP, flags, etc.)
        const [countriesSnap, factorSnap, monitorSnap] = await Promise.all([
            db.collection('settings').doc('countries').get(),
            db.collection('settings').doc('adminFactor').get(),
            db.collection('settings').doc('monitor').get(),
        ]);

        if (!countriesSnap.exists) {
            console.warn('[autoUpdateRates] settings/countries not found — skipping.');
            return;
        }

        const countries = countriesSnap.data().list || [];
        const adminFactor = factorSnap.exists
            ? (parseFloat(factorSnap.data().value) || 0.94)
            : 0.94;

        // 2. Fetch market prices in parallel
        const [binancePrices, yadioVal] = await Promise.all([
            fetchBinancePrices(),
            fetchYadioRate(),
        ]);

        const clpPrice = binancePrices['CLP'];
        if (!clpPrice || clpPrice <= 0) {
            console.error('[autoUpdateRates] No valid CLP price — aborting.');
            return;
        }

        console.log('[autoUpdateRates] Binance prices:', binancePrices);
        console.log('[autoUpdateRates] Yadio monitor:', yadioVal);
        console.log('[autoUpdateRates] adminFactor:', adminFactor);

        // 3. Calculate new rates (same formula as autoUpdateRatesFromMonitors in admin.js)
        let hasChanges = false;
        const updatedCountries = countries.map(c => {
            let newRate = c.rate;
            if (c.code === 'CLP') {
                newRate = 1.0;
            } else {
                const monitorPrice = binancePrices[c.code];
                if (monitorPrice && clpPrice > 0) {
                    newRate = (monitorPrice / clpPrice) * adminFactor;
                }
            }
            if (Math.abs((c.rate || 0) - newRate) > 0.000001) hasChanges = true;
            return { ...c, rate: newRate };
        });

        const isoTime = new Date().toISOString();

        // 4. Save to Firestore using a batch
        const batch = db.batch();

        batch.set(db.collection('settings').doc('countries'), {
            list: updatedCountries,
            lastUpdate: isoTime,
        });

        // Update monitor doc if we got a valid Yadio rate
        if (yadioVal) {
            const prevMonitor = monitorSnap.exists ? (monitorSnap.data().numeric || 0) : 0;
            if (Math.abs(prevMonitor - yadioVal) > 0.0001) {
                batch.set(db.collection('settings').doc('monitor'), {
                    rate: yadioVal.toFixed(2).replace('.', ','),
                    numeric: yadioVal,
                    lastUpdate: isoTime,
                });
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await batch.commit();
            console.log(`[autoUpdateRates] ✅ Rates updated successfully at ${isoTime}`);
        } else {
            console.log('[autoUpdateRates] ⏺ No significant rate changes — skipping write.');
        }
    }
);

// ── STATUS CHANGE NOTIFICATIONS ───────────────────────────────────────────────
exports.onTransferStatusChanged = onDocumentUpdated(
    {
        document: 'transfers/{transferId}',
        region: 'us-central1',
    },
    async (event) => {
        const before = event.data.before.data();
        const after = event.data.after.data();

        // Only fire when status actually changes
        if (before.status === after.status) return;

        const newStatus = after.status;
        if (newStatus !== 'completed' && newStatus !== 'rejected') return;

        const userId = after.userId;
        if (!userId) {
            console.warn('[notify] No userId on transfer — skipping.');
            return;
        }

        // Look up user's FCM token
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists || !userDoc.data().fcmToken) {
            console.warn(`[notify] No FCM token for user ${userId} — skipping.`);
            return;
        }

        const token = userDoc.data().fcmToken;
        const recipientName = after.name || 'destinatario';

        let title, body;
        if (newStatus === 'completed') {
            title = '✅ Envío Completado';
            body = `Tu envío hacia ${recipientName} ha sido procesado exitosamente.`;
        } else {
            title = '❌ Envío Rechazado';
            const reason = after.reason || 'Contacta a soporte para más detalles.';
            body = `Tu envío hacia ${recipientName} fue rechazado. Motivo: ${reason}`;
        }

        const message = {
            token,
            notification: { title, body },
            webpush: {
                notification: {
                    icon: '/logo-enmssell.png',
                    badge: '/logo-enmssell.png',
                    vibrate: [200, 100, 200],
                    tag: `transfer-${event.params.transferId}`,
                },
            },
        };

        try {
            await getMessaging().send(message);
            console.log(`[notify] ✅ Push sent to ${userId} — ${newStatus}`);
        } catch (err) {
            console.error(`[notify] Failed to send push to ${userId}:`, err.message);
            // If token is invalid, clean it up
            if (
                err.code === 'messaging/registration-token-not-registered' ||
                err.code === 'messaging/invalid-registration-token'
            ) {
                await db.collection('users').doc(userId).update({ fcmToken: null });
                console.log(`[notify] Cleaned up stale token for ${userId}`);
            }
        }
    }
);

// ── PROMOTIONAL NOTIFICATIONS ─────────────────────────────────────────────────
const { onCall, HttpsError } = require('firebase-functions/v2/https');

exports.sendPromoNotification = onCall(
    { region: 'us-central1' },
    async (request) => {
        // Only admin can send promos
        const callerEmail = request.auth?.token?.email;
        if (!callerEmail || callerEmail.toLowerCase() !== 'enmssellchanges@gmail.com') {
            throw new HttpsError('permission-denied', 'Solo el administrador puede enviar promociones.');
        }

        const { title, body } = request.data;
        if (!title || !body) {
            throw new HttpsError('invalid-argument', 'Título y mensaje son requeridos.');
        }

        // Get all users with FCM tokens
        const usersSnap = await db.collection('users').where('fcmToken', '!=', null).get();
        if (usersSnap.empty) {
            return { sent: 0, message: 'No hay usuarios con notificaciones activas.' };
        }

        const tokens = [];
        usersSnap.forEach(doc => {
            const t = doc.data().fcmToken;
            if (t) tokens.push(t);
        });

        if (tokens.length === 0) {
            return { sent: 0, message: 'No hay tokens válidos.' };
        }

        const message = {
            notification: { title, body },
            webpush: {
                notification: {
                    icon: '/logo-enmssell.png',
                    badge: '/logo-enmssell.png',
                    vibrate: [200, 100, 200],
                },
            },
        };

        let successCount = 0;
        // Send individually to handle invalid tokens gracefully
        for (const t of tokens) {
            try {
                await getMessaging().send({ ...message, token: t });
                successCount++;
            } catch (err) {
                console.warn(`[promo] Failed for token ${t.substring(0, 15)}...:`, err.message);
            }
        }

        console.log(`[promo] ✅ Sent to ${successCount}/${tokens.length} users`);
        return { sent: successCount, total: tokens.length };
    }
);
