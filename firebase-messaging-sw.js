importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    projectId: "enmssellchanges-premium",
    appId: "1:591347469322:web:aadf4993968d3cbf57e3f3",
    messagingSenderId: "591347469322"
});

const messaging = firebase.messaging();

const CACHE_NAME = 'enmssell-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/logo-enmssell.png',
    '/manifest.json'
];

// Install Event
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});

// Fetch Event (Network First for real-time updates)
self.addEventListener('fetch', (e) => {
    // Skip Firebase/Firestore queries
    if (e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('firebaseinstallations')) {
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

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo-enmssell.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
