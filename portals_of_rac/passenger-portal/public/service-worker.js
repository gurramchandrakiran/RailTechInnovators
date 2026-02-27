// passenger-portal/public/service-worker.js

/**
 * Service Worker for Push Notifications
 * Handles background push events
 */

self.addEventListener('push', event => {
    console.log('📨 Push notification received');

    let data = {
        title: 'RAC Update',
        body: 'You have a new notification',
        icon: '/logo192.png',
        badge: '/badge.png'
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            console.error('Error parsing notification data:', e);
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/logo192.png',
        badge: data.badge || '/badge.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: [
            { action: 'view', title: 'View Details' },
            { action: 'close', title: 'Close' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', event => {
    console.log('🔔 Notification clicked');

    event.notification.close();

    if (event.action === 'view' || !event.action) {
        const urlToOpen = event.notification.data.url || '/dashboard';

        event.waitUntil(
            clients.openWindow(urlToOpen)
        );
    }
});

console.log('✅ Service worker loaded for push notifications');
