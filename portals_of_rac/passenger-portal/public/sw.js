// Service Worker for Passenger Portal
// Handles push notifications for RAC upgrades and alerts

self.addEventListener('install', (event) => {
    console.log('📦 Passenger Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('✅ Passenger Service Worker activated');
    event.waitUntil(clients.claim());
});

// Listen for push events
self.addEventListener('push', (event) => {
    console.log('📨 Passenger Push notification received');

    if (!event.data) {
        console.log('❌ No data in push event');
        return;
    }

    const data = event.data.json();
    console.log('📨 Passenger Push data:', data);

    const options = {
        body: data.body || 'You have a new notification',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: data.tag || 'passenger-notification',
        requireInteraction: true,
        data: {
            url: data.url || 'http://localhost:5175',
            type: data.data?.type || 'GENERAL',
            ...data.data
        },
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ],
        vibrate: [200, 100, 200]
    };

    // Show notification
    event.waitUntil(
        self.registration.showNotification(data.title || 'Notification', options)
            .then(() => {
                // Broadcast refresh message to all Passenger clients
                if (data.data?.type === 'DUAL_APPROVAL_UPGRADE_OFFER' || data.data?.type === 'NO_SHOW_MARKED') {
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
    console.log('🖱️ Passenger Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if Passenger portal window is already open
                for (const client of clientList) {
                    if (client.url.includes('5175') && 'focus' in client) {
                        // Send refresh message before focusing
                        client.postMessage({ type: 'REFRESH_PAGE' });
                        return client.focus();
                    }
                }
                // Open Passenger portal if not open
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen || 'http://localhost:5175');
                }
            })
    );
});
