/**
 * @file app.js
 * @description Módulo principal de la aplicación.
 *   - Inicializa Firebase (Auth, Firestore, Storage, Messaging)
 *   - Declara variables globales de estado (user, countries, currentTransfer, etc.)
 *   - Registra el Service Worker para PWA
 *   - Arranca los listeners globales de Firestore al cargar la página
 *   - Maneja el ciclo de vida de las transacciones en tiempo real
 */

// ── Firebase Configuration ──────────────────────────────────────────────────
const firebaseConfig = {
  projectId: "enmssellchanges-premium",
  appId: "1:591347469322:web:aadf4993968d3cbf57e3f3",
  storageBucket: "enmssellchanges-premium.firebasestorage.app",
  apiKey: "AIzaSyDjZnv2KSnmpiptFzkMceHz1r08-WeVBZs",
  authDomain: "enmssellchanges-premium.firebaseapp.com",
  messagingSenderId: "591347469322",
  measurementId: "G-1VV3QWHZ20"
};
const countryNameMap = {
  'CLP': 'Chile',
  'VES': 'Venezuela',
  'COP': 'Colombia',
  'PEN': 'Perú',
  'USD': 'USA',
  'ECS': 'Ecuador'
};
let auth, db, messaging, storage;
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();
  if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .catch(err => console.warn('[SW] Registration failed:', err));
    });
  }
}
var defaultCountries = [{
  code: 'CLP',
  name: 'Chile',
  rate: 1,
  minCLP: 10000,
  marginOff: 0,
  flag: 'https://flagcdn.com/w20/cl.png'
}, {
  code: 'VES',
  name: 'Venezuela',
  rate: 0.05,
  minCLP: 10000,
  marginOff: 0,
  flag: 'https://flagcdn.com/w20/ve.png'
}, {
  code: 'COP',
  name: 'Colombia',
  rate: 4.8,
  minCLP: 20000,
  marginOff: 0,
  flag: 'https://flagcdn.com/w20/co.png'
}, {
  code: 'PEN',
  name: 'Perú',
  rate: 0.003,
  minCLP: 20000,
  marginOff: 0,
  flag: 'https://flagcdn.com/w20/pe.png'
}, {
  code: 'USD',
  name: 'USA',
  rate: 0.001,
  minCLP: 100000,
  marginOff: 0,
  flag: 'https://flagcdn.com/w20/us.png'
}, {
  code: 'ECS',
  name: 'Ecuador',
  rate: 0.001,
  minCLP: 20000,
  marginOff: 0,
  flag: 'https://flagcdn.com/w20/ec.png'
}];
var countries = [...defaultCountries];
var user = null;
var sourceCountry = countries[0];
var destCountry = countries[1]; // Default to VES
var quickSourceCountry = countries[0];
var quickDestCountry = countries[1]; // Default to VES

// --- Debouncing for Calculators ---
// Prevents the UI from recalculating on every single keystroke.

// Register Firestore real-time listeners as early as possible so that
// Firestore data is available by the time renderHomeRates() fires.
let _listenersStarted = false;
/**
 * Initializes Firestore real-time listeners for settings.
 * Ensures the listeners are only started once.
 */
function startFirebaseListeners() {
  if (_listenersStarted) return;
  if (db && typeof window.FirebaseAPI !== 'undefined') {
    _listenersStarted = true;
    window.FirebaseAPI.initSettingsListeners();
  } else {
    // Firebase not ready yet — retry after a short delay
    setTimeout(startFirebaseListeners, 400);
  }
}
startFirebaseListeners(); // First attempt: runs during script execution (before DOMContentLoaded)

var currentTransfer = null;
var txToReject = null;
var txToAuthorize = null; // Store ID for admin authorization
var selectedProofBase64 = null; // Store user proof
var adminProofBase64 = null; // Store admin result proof

var bcvLastUpdate = null;
var lastStatusMap = {};
var adminHistoryData = [];
var userTransactions = []; // Added to store current user transactions for filtering
var adminPendingUnsubscribe = null;
var adminHistoryUnsubscribe = null;
document.addEventListener('DOMContentLoaded', () => {

  renderHomeRates();
  renderBCV();
  calculateQuick();
  calculate();
  renderUserAccounts();
  checkPromotion();

  // Safety-net: if Firebase wasn't ready at script-load time, register now
  startFirebaseListeners();

  // Auto-refresh admin data every 5 minutes if visible
  setInterval(() => {
    const adminView = document.getElementById('view-admin');
    if (adminView && adminView.style.display !== 'none') {

      loadAdminData();
    }
  }, 5 * 60 * 1000);

  // Connection Status Logic
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus();

  // Listen to user transactions globally if logged in
  auth.onAuthStateChanged(firebaseUser => {
    if (firebaseUser) {
      checkPromotion();
      db.collection('transfers').where('userId', '==', firebaseUser.uid).onSnapshot(snapshot => {
        const txs = [];
        snapshot.forEach(doc => txs.push({
          id: doc.id,
          ...doc.data()
        }));

        // Client-side sort to bypass index requirement
        txs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        userTransactions = txs; // Sync local storage for filtering

        // Sound Notification upon status change
        let soundTriggered = false;
        snapshot.docChanges().forEach(change => {
          if (change.type === 'modified') {
            const data = change.doc.data();
            const id = change.doc.id;
            if (lastStatusMap[id] && lastStatusMap[id] !== data.status) {
              soundTriggered = true;
            }
            lastStatusMap[id] = data.status;
          } else if (change.type === 'added') {
            lastStatusMap[change.doc.id] = change.doc.data().status;
          }
        });
        if (soundTriggered) playNotificationSound();

        // Proactive Update: History & Tracking
        if (document.getElementById('transaction-list')) {
          renderTransactionsList(txs);
        }
        if (document.getElementById('tracking-content')) {
          updateTrackingUI(txs);
        }
      }).catch(err => {
        console.error("Firestore Error (Global Listener):", err);
      });

      // Admin Global Listener for New Shipments
      if (user && user.isAdmin) {

        db.collection('transfers').where('status', '==', 'pending').onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              // Important: We only alert if it's NOT the initial load 
              // (Firestore triggers 'added' for all existing docs on first load)
              // We check if the doc is recent (last 10 seconds)
              const data = change.doc.data();
              const now = Date.now();
              const docTime = data.timestamp ? data.timestamp.toMillis() : now;
              if (now - docTime < 10000) {
                // New shipment in the last 10s

                playNotificationSound();
                showToast("NUEVO ENVÍO RECIBIDO", `De: ${data.sender} por ${data.amount}`);

                // Highlight admin nav item if not in admin view
                const adminBtn = document.getElementById('mob-account'); // Using account as proxy for mobile
                if (adminBtn) adminBtn.style.color = "var(--gold)";
              }
            }
          });
        });
      }
    }
  });
});
// ── Binance P2P Monitor ──────────────────────────────────────────────────────
let binanceInterval = null;
/**
 * Initializes the Binance P2P monitor, fetches initial data,
 * and sets up an interval to refresh data every 5 minutes.
 */
function initBinanceMonitor() {
  const icon = document.getElementById('sync-icon');
  if (icon) icon.classList.add('spin');
  fetchBinanceP2P().finally(() => {
    if (icon) icon.classList.remove('spin');
  });
  if (binanceInterval) clearInterval(binanceInterval);
  binanceInterval = setInterval(() => {
    fetchBinanceP2P();
    // Nota: autoUpdateYadioMonitor ya no se llama aquí.
    // El Monitor Yadio se actualiza automáticamente via Cloud Function cada 15 min.
  }, 5 * 60 * 1000); // 5 minutes
}
// ── Foreground Messaging ────────────────────────────────────────────────────
// Muestra un toast cuando llega una notificación con la app en primer plano.
if (messaging) {
  messaging.onMessage(payload => {

    showToast(payload.notification.title, payload.notification.body);
  });
}
// ── Animaciones de Toast (inyectadas dinámicamente) ────────────────────────
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideInNotification {
    from { transform: translateX(120%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutNotification {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(120%); opacity: 0; }
    }
    `;
document.head.appendChild(style);

/**
 * Checks if there is an active promotional banner to display.
 * Prevents showing the banner multiple times in the same session.
 */
function checkPromotion() {
    const sessionKey = 'promoShown_' + (auth && auth.currentUser ? auth.currentUser.uid : 'guest');
    if (sessionStorage.getItem(sessionKey) === 'true') {
        return; // Ya se mostró en esta sesión para este usuario/invitado
    }

    // Asegurar que db esté inicializado
    if (typeof db === 'undefined') {
        setTimeout(checkPromotion, 500);
        return;
    }

    db.doc('settings/promotion').get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            const now = new Date();
            // Handle possibility of missing expiresAt
            const expiresAt = data.expiresAt ? (data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)) : null;

            if (data.active && data.imageUrl && expiresAt && now < expiresAt) {
                // Mostrar la promoción
                if (typeof openPromoModal === 'function') {
                    openPromoModal(data.imageUrl, data.link);
                    sessionStorage.setItem(sessionKey, 'true');
                } else {
                    console.error("openPromoModal no está definido");
                }
            } else {

            }
        }
    }).catch(err => {
        console.error("Error checking promotion:", err);
    });
}
