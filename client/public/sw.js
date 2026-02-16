const CACHE_NAME = 'sbl-roofing-v7';
const STATIC_CACHE = 'sbl-static-v7';
const API_CACHE = 'sbl-api-v7';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png'
];

const CACHED_API_ROUTES = [
  '/api/crew/schedule',
  '/api/jobs'
];

const OFFLINE_FALLBACK = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
      caches.open(API_CACHE)
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => 
            name !== STATIC_CACHE && 
            name !== API_CACHE && 
            name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  const pathname = url.pathname;
  return (
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.ttf') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.webp') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/assets/')
  );
}

function isCachedApiRoute(url) {
  const pathname = url.pathname;
  return CACHED_API_ROUTES.some(route => pathname.startsWith(route)) ||
    pathname.match(/^\/api\/jobs\/[^/]+\/checklists$/);
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, response);
        });
      }
    }).catch(() => {});
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await caches.match(OFFLINE_FALLBACK);
    return fallback || new Response('Offline', { status: 503 });
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleMutation(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.clone().text(),
      timestamp: Date.now()
    };
    
    await storeFailedRequest(requestData);
    
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-mutations');
    }
    
    return new Response(
      JSON.stringify({ 
        queued: true, 
        message: 'Request queued for sync when online' 
      }),
      { 
        status: 202, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function storeFailedRequest(requestData) {
  const db = await openDB();
  const tx = db.transaction('offline-queue', 'readwrite');
  const store = tx.objectStore('offline-queue');
  await store.add(requestData);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sbl-offline-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-queue')) {
        db.createObjectStore('offline-queue', { keyPath: 'timestamp' });
      }
    };
  });
}

async function processOfflineQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction('offline-queue', 'readwrite');
    const store = tx.objectStore('offline-queue');
    const requests = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          const deleteTx = db.transaction('offline-queue', 'readwrite');
          const deleteStore = deleteTx.objectStore('offline-queue');
          deleteStore.delete(requestData.timestamp);
        }
      } catch (error) {
        console.log('Failed to sync request, will retry later:', requestData.url);
      }
    }
    
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SYNC_COMPLETE' });
      });
    });
  } catch (error) {
    console.error('Failed to process offline queue:', error);
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.origin !== location.origin) return;
  
  if (event.request.method === 'POST' || event.request.method === 'PUT' || event.request.method === 'PATCH') {
    event.respondWith(handleMutation(event.request));
    return;
  }
  
  if (event.request.method !== 'GET') return;
  
  if (url.pathname.startsWith('/api/')) {
    if (isCachedApiRoute(url)) {
      event.respondWith(networkFirstStrategy(event.request));
    } else {
      event.respondWith(fetch(event.request));
    }
    return;
  }
  
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(OFFLINE_FALLBACK);
        });
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(processOfflineQueue());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'PROCESS_QUEUE') {
    processOfflineQueue();
  }
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      }).then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHES_CLEARED' });
          });
        });
      })
    );
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Push notification handlers
self.addEventListener('push', (event) => {
  let data = { title: 'New Notification', body: 'You have a new notification' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('Error parsing push data:', e);
  }

  const notifData = data.data || {};
  const notifType = notifData.type || 'general';

  const iconMap = {
    appointment_created: '/icon-192x192.png',
    appointment_updated: '/icon-192x192.png',
    appointment_reminder: '/icon-192x192.png',
  };

  const options = {
    body: data.body,
    icon: iconMap[notifType] || '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    tag: notifType + '-' + (notifData.appointmentId || Date.now()),
    data: {
      url: notifData.url || '/schedule',
      type: notifType,
      appointmentId: notifData.appointmentId,
      timestamp: notifData.timestamp || Date.now()
    },
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/schedule';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
