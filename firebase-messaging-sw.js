importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    projectId: "enmssellchanges-premium",
    appId: "1:591347469322:web:aadf4993968d3cbf57e3f3",
    apiKey: "AIzaSyDjZnv2KSnmpiptFzkMceHz1r08-WeVBZs",
    authDomain: "enmssellchanges-premium.firebaseapp.com",
    messagingSenderId: "591347469322"
});

const messaging = firebase.messaging();

const CACHE_NAME = 'enmssell-v10.8';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/config.js',
    '/js/app.js',
    '/js/api.js',
    '/js/ui.js',
    '/logo-enmssell.png',
    '/manifest.json',
    '/firebase-messaging-sw.js'
];

// Install Event
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        }).catch(err => console.warn('[SW] Cache addAll error:', err))
    );
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event (Network First for real-time updates)
self.addEventListener('fetch', (e) => {
    if (
        e.request.method !== 'GET' ||
        e.request.url.includes('firestore.googleapis.com') ||
        e.request.url.includes('firebaseinstallations') ||
        e.request.url.includes('cloudfunctions') ||
        e.request.url.includes('googleapis.com')
    ) {
        return;
    }

    e.respondWith(
        fetch(e.request).then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, resClone);
            });
            return res;
        }).catch(() => caches.match(e.request))
    );
});

// Background notifications (app cerrada o en segundo plano)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Notificación en segundo plano:', payload);

    const title = (payload.notification && payload.notification.title) || 'Enmsell';
    const body  = (payload.notification && payload.notification.body)  || '';
    const data  = payload.data || {};

    const options = {
        body: body,
        icon: '/logo-enmssell.png',
        badge: '/logo-enmssell.png',
        vibrate: [200, 100, 200],
        tag: 'enmsell-notification',
        renotify: true,
        requireInteraction: false,
        data: { url: self.location.origin, ...data }
    };

    self.registration.showNotification(title, options);
});

// Abrir/enfocar la app cuando el usuario toca la notificación en móvil
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const targetUrl = (e.notification.data && e.notification.data.url) || self.location.origin;

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Si la app ya está abierta, enfocarla
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no está abierta, abrirla
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
