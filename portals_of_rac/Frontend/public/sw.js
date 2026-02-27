// Service Worker for Admin Portal
// Handles push notifications for RAC upgrade approvals

self.addEventListener('install', (event) => {
    console.log('📦 Admin Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('✅ Admin Service Worker activated');
    event.waitUntil(clients.claim());
});

// Listen for push events
self.addEventListener('push', (event) => {
    console.log('📨 Admin Push notification received');

    if (!event.data) {
        console.log('❌ No data in push event');
        return;
    }

    const data = event.data.json();
    console.log('📨 Admin Push data:', data);

    const options = {
        body: data.body || 'RAC upgrade has been approved',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: data.tag || 'admin-notification',
        requireInteraction: true,
        data: {
            url: data.url || 'http://localhost:3000',
            type: data.data?.type || 'GENERAL',
            ...data.data
        },
        actions: [
            { action: 'view', title: 'View Details' },
            { action: 'dismiss', title: 'Dismiss' }
        ],
        vibrate: [200, 100, 200]
    };

    // Show notification
    event.waitUntil(
        self.registration.showNotification(data.title || 'Admin Notification', options)
            .then(() => {
                // 🔄 Broadcast refresh message to all Admin clients
                if (data.data?.type === 'RAC_UPGRADE_APPROVED') {
                    return self.clients.matchAll({ type: 'window' }).then((clients) => {
                        clients.forEach((client) => {
                            client.postMessage({
                                type: 'REFRESH_PAGE',
                                data: data.data
                            });
                        });
                    });
                }
            })
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ Admin Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if Admin portal window is already open
                for (const client of clientList) {
                    if (client.url.includes('3000') && 'focus' in client) {
                        // Send refresh message before focusing
                        client.postMessage({ type: 'REFRESH_PAGE' });
                        return client.focus();
                    }
                }
                // Open Admin portal if not open
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
