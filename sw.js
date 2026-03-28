// ============================================
// BookTracker Service Worker
// ============================================

const CACHE_NAME = 'booktracker-v1.0.0';
const STATIC_CACHE = 'booktracker-static-v1';
const DYNAMIC_CACHE = 'booktracker-dynamic-v1';
const BOOKS_CACHE = 'booktracker-books-v1';

// Файли для кешування при встановленні
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/db.js',
    '/js/ui.js',
    '/js/reader.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Зовнішні ресурси
const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
];

// ============================================
// Install Event
// ============================================

self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    
    event.waitUntil(
        Promise.all([
            // Кешуємо статичні файли
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            // Кешуємо зовнішні ресурси
            caches.open(DYNAMIC_CACHE).then((cache) => {
                console.log('[SW] Caching external assets');
                return Promise.allSettled(
                    EXTERNAL_ASSETS.map(url => 
                        cache.add(url).catch(err => {
                            console.warn(`[SW] Failed to cache: ${url}`, err);
                        })
                    )
                );
            })
        ]).then(() => {
            console.log('[SW] Installation complete');
            return self.skipWaiting();
        })
    );
});

// ============================================
// Activate Event
// ============================================

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Видаляємо старі кеші
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== BOOKS_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Activation complete');
            return self.clients.claim();
        })
    );
});

// ============================================
// Fetch Event
// ============================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Пропускаємо non-GET запити
    if (request.method !== 'GET') {
        return;
    }

    // Пропускаємо chrome-extension та інші спеціальні протоколи
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Стратегія для різних типів ресурсів
    if (isStaticAsset(url)) {
        // Cache First для статичних файлів
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    } else if (isBookFile(url)) {
        // Cache First для книг
        event.respondWith(cacheFirst(request, BOOKS_CACHE));
    } else if (isApiRequest(url)) {
        // Network First для API
        event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    } else {
        // Stale While Revalidate для інших
        event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    }
});

// ============================================
// Caching Strategies
// ============================================

// Cache First - спочатку кеш, потім мережа
async function cacheFirst(request, cacheName) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] Cache First failed:', error);
        return createOfflineResponse(request);
    }
}

// Network First - спочатку мережа, потім кеш
async function networkFirst(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return createOfflineResponse(request);
    }
}

// Stale While Revalidate - кеш + оновлення в фоні
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch((error) => {
        console.warn('[SW] Network request failed:', error);
        return null;
    });

    return cachedResponse || fetchPromise || createOfflineResponse(request);
}

// ============================================
// Helper Functions
// ============================================

function isStaticAsset(url) {
    return url.pathname.match(/\.(html|css|js|json|woff2?|ttf|eot)$/) ||
           url.pathname === '/' ||
           url.pathname.startsWith('/icons/');
}

function isBookFile(url) {
    return url.pathname.match(/\.(epub|pdf|txt|fb2)$/);
}

function isApiRequest(url) {
    return url.pathname.startsWith('/api/') ||
           url.hostname.includes('openlibrary.org') ||
           url.hostname.includes('googleapis.com');
}

function createOfflineResponse(request) {
    const url = new URL(request.url);
    
    // Для HTML сторінок повертаємо офлайн сторінку
    if (request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/index.html');
    }
    
    // Для зображень повертаємо placeholder
    if (request.headers.get('accept')?.includes('image')) {
        return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
                <rect fill="#e2e8f0" width="200" height="300"/>
                <text fill="#a0aec0" font-family="sans-serif" font-size="14" text-anchor="middle" x="100" y="150">📚</text>
            </svg>`,
            { headers: { 'Content-Type': 'image/svg+xml' } }
        );
    }
    
    // Для JSON повертаємо помилку
    if (request.headers.get('accept')?.includes('application/json')) {
        return new Response(
            JSON.stringify({ error: 'Offline', message: 'Немає з\'єднання з інтернетом' }),
            { 
                status: 503,
                headers: { 'Content-Type': 'application/json' } 
            }
        );
    }
    
    // Для інших - 503
    return new Response('Офлайн режим', { status: 503 });
}

// ============================================
// Background Sync
// ============================================

self.addEventListener('sync', (event) => {
    console.log('[SW] Background Sync:', event.tag);
    
    if (event.tag === 'sync-reading-progress') {
        event.waitUntil(syncReadingProgress());
    }
    
    if (event.tag === 'sync-books') {
        event.waitUntil(syncBooks());
    }
});

async function syncReadingProgress() {
    try {
        // Отримуємо незсинхронізований прогрес з IndexedDB
        const pendingSync = await getPendingSync();
        
        for (const item of pendingSync) {
            // Тут можна відправити на сервер якщо є бекенд
            console.log('[SW] Syncing progress:', item);
        }
        
        // Очищаємо чергу
        await clearPendingSync();
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

async function syncBooks() {
    console.log('[SW] Syncing books...');
}

// ============================================
// Push Notifications
// ============================================

self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);
    
    let data = {
        title: 'BookTracker',
        body: 'Час почитати! 📚',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png'
    };
    
    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: [100, 50, 100],
        data: data.data || {},
        actions: [
            { action: 'read', title: '📖 Читати' },
            { action: 'dismiss', title: '❌ Закрити' }
        ],
        tag: 'booktracker-notification',
        renotify: true
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'read') {
        event.waitUntil(
            clients.openWindow('/?action=continue-reading')
        );
    } else if (event.action === 'dismiss') {
        // Просто закриваємо
    } else {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// ============================================
// Periodic Background Sync
// ============================================

self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic Sync:', event.tag);
    
    if (event.tag === 'daily-reminder') {
        event.waitUntil(showDailyReminder());
    }
});

async function showDailyReminder() {
    const lastRead = await getLastReadDate();
    const now = new Date();
    const diffHours = (now - lastRead) / (1000 * 60 * 60);
    
    if (diffHours > 24) {
        await self.registration.showNotification('📚 BookTracker', {
            body: 'Ви давно не читали! Час повернутися до книги.',
            icon: '/icons/icon-192x192.png',
            tag: 'daily-reminder'
        });
    }
}

// ============================================
// Message Handler
// ============================================

self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_BOOK':
            cacheBook(payload.url, payload.data);
            break;
            
        case 'CLEAR_CACHE':
            clearAllCaches();
            break;
            
        case 'GET_CACHE_SIZE':
            getCacheSize().then(size => {
                event.source.postMessage({ type: 'CACHE_SIZE', payload: size });
            });
            break;
    }
});

async function cacheBook(url, data) {
    const cache = await caches.open(BOOKS_CACHE);
    const response = new Response(data);
    await cache.put(url, response);
    console.log('[SW] Book cached:', url);
}

async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[SW] All caches cleared');
}

async function getCacheSize() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage,
            quota: estimate.quota,
            percent: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
    }
    return null;
}

// ============================================
// IndexedDB Helpers (for sync)
// ============================================

function openSyncDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('booktracker-sync', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pending')) {
                db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function getPendingSync() {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending', 'readonly');
        const store = tx.objectStore('pending');
        const request = store.getAll();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function clearPendingSync() {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending', 'readwrite');
        const store = tx.objectStore('pending');
        const request = store.clear();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

async function getLastReadDate() {
    // Спрощена версія - повертаємо дату з localStorage через clients
    const allClients = await clients.matchAll();
    if (allClients.length > 0) {
        // Запитуємо у клієнта
        allClients[0].postMessage({ type: 'GET_LAST_READ' });
    }
    return new Date(Date.now() - 25 * 60 * 60 * 1000); // За замовчуванням 25 годин тому
}

// ============================================
// Error Handling
// ============================================

self.addEventListener('error', (event) => {
    console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Unhandled rejection:', event.reason);
});

console.log('[SW] Service Worker loaded');
