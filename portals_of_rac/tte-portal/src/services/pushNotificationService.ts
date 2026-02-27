// tte-portal/src/services/pushNotificationService.ts
// Handles push notification subscription for TTE portal

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Get CSRF token from cookies
 */
const getCsrfToken = (): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split('; csrfToken=');
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
};


interface PushSubscriptionResult {
    success: boolean;
    error?: string;
}

interface VapidKeyResponse {
    vapidPublicKey: string;
}

interface SubscribeResponse {
    success: boolean;
    message?: string;
}

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
export const subscribeToPushNotifications = async (): Promise<PushSubscriptionResult> => {
    if (!isPushSupported()) {
        console.log('❌ Push notifications not supported');
        return { success: false, error: 'Not supported' };
    }

    try {
        // Request permission
        const permissionGranted = await requestNotificationPermission();
        if (!permissionGranted) {
            console.log('❌ Notification permission denied');
            return { success: false, error: 'Permission denied' };
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ TTE Service Worker registered');

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Get VAPID key
        const vapidPublicKey = await getVapidPublicKey();
        if (!vapidPublicKey) {
            return { success: false, error: 'Failed to get VAPID key' };
        }

        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer
        });

        console.log('✅ Push subscription created');

        // Send subscription to backend
        const token = localStorage.getItem('token');
        const csrfToken = getCsrfToken();
        const response = await fetch(`${API_BASE_URL}/tte/push-subscribe`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(csrfToken && { 'X-CSRF-Token': csrfToken })
            },
            body: JSON.stringify({ subscription })
        });

        const result: SubscribeResponse = await response.json();

        if (result.success) {
            console.log('✅ TTE subscribed to push notifications');
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

interface RefreshData {
    type?: string;
    [key: string]: any;
}

interface ServiceWorkerMessage {
    type: string;
    data?: RefreshData;
}

/**
 * Setup listener for refresh messages from service worker
 */
export const setupRefreshListener = (refreshCallback?: (data?: RefreshData) => void): void => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event: MessageEvent<ServiceWorkerMessage>) => {
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
 * Initialize push notifications for TTE portal
 */
export const initializePushNotifications = async (refreshCallback?: (data?: RefreshData) => void): Promise<PushSubscriptionResult> => {
    console.log('🔔 Initializing TTE push notifications...');

    // Setup refresh listener first
    setupRefreshListener(refreshCallback);

    // Subscribe to push
    const result = await subscribeToPushNotifications();

    if (result.success) {
        console.log('✅ TTE push notifications initialized');
    }

    return result;
};
