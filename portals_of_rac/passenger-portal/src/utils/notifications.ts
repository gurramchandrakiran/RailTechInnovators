// passenger-portal/src/utils/notifications.ts

/**
 * Browser Notification Utility
 * Handles permission requests and notification subscription
 */

interface SubscriptionResult {
    success: boolean;
    reason?: string;
    subscription?: PushSubscription | MockSubscription;
    error?: string;
}

interface MockSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

class NotificationManager {
    private isSupported: boolean;
    private permission: NotificationPermission | 'denied';

    constructor() {
        this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
        this.permission = this.isSupported ? Notification.permission : 'denied';
    }

    /**
     * Check if notifications are supported
     */
    isNotificationSupported(): boolean {
        return this.isSupported;
    }

    /**
     * Request notification permission
     */
    async requestPermission(): Promise<boolean> {
        if (!this.isSupported) {
            console.warn('Notifications not supported in this browser');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;

            if (permission === 'granted') {
                console.log('✅ Notification permission granted');
                return true;
            } else {
                console.log('⚠️ Notification permission denied');
                return false;
            }
        } catch (error) {
            console.error('❌ Error requesting notification permission:', error);
            return false;
        }
    }

    /**
     * Subscribe to push notifications
     */
    async subscribe(): Promise<SubscriptionResult> {
        if (!this.isSupported || this.permission !== 'granted') {
            return { success: false, reason: 'Permission not granted' };
        }

        try {
            // In production, register service worker and subscribe:
            // const registration = await navigator.serviceWorker.ready;
            // const subscription = await registration.pushManager.subscribe({
            //     userVisibleOnly: true,
            //     applicationServerKey: publicVapidKey
            // });

            // For now, simulate subscription
            const subscription: MockSubscription = {
                endpoint: 'mock-endpoint',
                keys: {
                    p256dh: 'mock-key',
                    auth: 'mock-auth'
                }
            };

            // Send subscription to backend
            // const pnr = JSON.parse(localStorage.getItem('user') || '{}').pnr;

            // await fetch(`${API_URL}/notifications/subscribe`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ pnr, subscription })
            // });

            console.log('✅ Subscribed to push notifications');
            return { success: true, subscription };

        } catch (error) {
            console.error('❌ Error subscribing to notifications:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Show a local notification (for testing)
     */
    showNotification(title: string, options?: NotificationOptions): void {
        if (this.permission === 'granted') {
            new Notification(title, {
                icon: '/logo192.png',
                badge: '/badge.png',
                ...options
            });
        }
    }

    /**
     * Test notification
     */
    testNotification(): void {
        this.showNotification('🎉 Test Notification', {
            body: 'Push notifications are working!',
            tag: 'test'
        });
    }
}

export default new NotificationManager();
