// passenger-portal/src/services/pushNotificationService.ts
// Handles push notification subscription for Passenger portal

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface SubscriptionResult {
    success: boolean;
    error?: string;
}

interface VapidKeyResponse {
    vapidPublicKey: string;
}

type RefreshCallback = (data?: any) => void;

/**
 * Check if push notifications are supported
 */
export const isPushSupported = (): boolean => {
    return 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
        console.log('❌ Notifications not supported');
        return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
};

/**
 * Get VAPID public key from server
 */
const getVapidPublicKey = async (): Promise<string | null> => {
    try {
        const response = await fetch(`${API_BASE_URL}/push/vapid-key`);
        const data: VapidKeyResponse = await response.json();
        return data.vapidPublicKey;
    } catch (error) {
        console.error('❌ Failed to get VAPID key:', error);
        return null;
    }
};

/**
 * Convert VAPID key to Uint8Array
 */
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

/**
 * Register service worker and subscribe to push notifications
 */
export const subscribeToPushNotifications = async (): Promise<SubscriptionResult> => {
    if (!isPushSupported()) {
        console.log('❌ Push notifications not supported');
        return { success: false, error: 'Not supported' };
    }

    try {
        const permissionGranted = await requestNotificationPermission();
        if (!permissionGranted) {
            console.log('❌ Notification permission denied');
            return { success: false, error: 'Permission denied' };
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Passenger Service Worker registered');

        await navigator.serviceWorker.ready;

        const vapidPublicKey = await getVapidPublicKey();
        if (!vapidPublicKey) {
            return { success: false, error: 'Failed to get VAPID key' };
        }

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
        });

        console.log('✅ Push subscription created');

        // Get IRCTC ID from user object stored in localStorage
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const irctcId = user?.IRCTC_ID || user?.irctcId;

        if (!irctcId) {
            console.error('❌ No IRCTC ID found in localStorage');
            return { success: false, error: 'User not authenticated' };
        }

        console.log('📤 Subscribing to push notifications for:', irctcId);
        const response = await fetch(`${API_BASE_URL}/passenger/push-subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ irctcId, subscription })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Passenger subscribed to push notifications');
            return { success: true };
        } else {
            console.error('❌ Failed to subscribe:', result.message);
            return { success: false, error: result.message };
        }

    } catch (error: any) {
        console.error('❌ Push subscription error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Setup listener for refresh messages from service worker
 */
export const setupRefreshListener = (refreshCallback?: RefreshCallback): void => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        console.log('📨 Message from SW:', event.data);

        if (event.data?.type === 'REFRESH_PAGE') {
            console.log('🔄 Auto-refreshing page...');
            if (typeof refreshCallback === 'function') {
                refreshCallback(event.data.data);
            } else {
                window.location.reload();
            }
        }
    });
};

/**
 * Initialize push notifications for Passenger portal
 */
export const initializePushNotifications = async (refreshCallback?: RefreshCallback): Promise<SubscriptionResult> => {
    console.log('🔔 Initializing Passenger push notifications...');

    setupRefreshListener(refreshCallback);

    const result = await subscribeToPushNotifications();

    if (result.success) {
        console.log('✅ Passenger push notifications initialized');
    }

    return result;
};
