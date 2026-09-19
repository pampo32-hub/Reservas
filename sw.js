// Service Worker para Reservas CR (PWA)
const CACHE_NAME = 'reservascr-pwa-v4';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './src/styles/main.css',
  './src/app.js',
  './src/services/storage.js',
  './src/data/initialData.js',
  './src/assets/reservas_cr_clean_badge_1.jpg',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ [PWA] Cacheando recursos estáticos de Reservas CR');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('⚠️ [PWA] Fallo menor precacheando algunos recursos:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('🧹 [PWA] Limpiando caché obsoleta:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepción de peticiones (Network First para APIs, Stale-While-Revalidate para recursos)
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Ignorar peticiones API del backend para no servir datos transaccionales obsoletos
  if (requestUrl.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Devolver recurso en caché y actualizar en segundo plano
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Si no está en caché, traer de la red
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback offline a index.html para navegación SPA
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ==========================================
// PUSH NOTIFICATIONS (Notificaciones Push Móviles)
// ==========================================

self.addEventListener('push', (event) => {
  console.log('📲 [SW] Evento Push recibido:', event);

  let data = {
    title: '🔔 ¡Nueva Notificación!',
    body: 'Tienes una actualización en Reservas CR',
    icon: '/src/assets/reservas_cr_clean_badge_1.jpg',
    badge: '/src/assets/reservas_cr_clean_badge_1.jpg',
    data: { url: '/#/owner-dashboard' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/src/assets/reservas_cr_clean_badge_1.jpg',
    badge: data.badge || '/src/assets/reservas_cr_clean_badge_1.jpg',
    vibrate: [200, 100, 200, 100, 200],
    data: data.data || { url: '/#/owner-dashboard' },
    tag: data.tag || `reserva-push-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    actions: [
      {
        action: 'open_dashboard',
        title: 'Ver en el Panel 📅'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Al pulsar sobre la notificación recibida
self.addEventListener('notificationclick', (event) => {
  console.log('👆 [SW] Notificación clickeada:', event.notification.tag, event.action);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/#/owner-dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una pestaña abierta de Reservas CR, enfocarla y navegar
      for (const client of clientList) {
        if ('focus' in client) {
          if (targetUrl && client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
          return client.focus();
        }
      }
      // Si no está abierta, abrir una nueva ventana
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});


