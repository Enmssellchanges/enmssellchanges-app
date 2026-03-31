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

const CACHE_NAME = 'enmssell-v10.7';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/config.js',
    '/js/app.js',
    '/js/api.js',
    '/js/ui.js',
    '/logo-enmssell.webp',
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
    // Skip Firebase/Firestore queries and unsupported methods like POST
    if (e.request.method !== 'GET' || e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('firebaseinstallations') || e.request.url.includes('cloudfunctions')) {
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
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo-enmssell.webp'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});
