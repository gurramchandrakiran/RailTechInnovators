// Push Notification Manager for TTE Portal
// Handles subscription for offline passenger upgrade notifications

// API Base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Get CSRF token from cookies
 */
function getCsrfToken(): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split('; csrfToken=');
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

/**
 * Request notification permission and subscribe TTE to push
 * @param tteId - TTE user ID
 * @returns Success status
 */
export async function subscribeTTEToPush(tteId: string): Promise<boolean> {
    try {
        // Check support
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            console.log('❌ Push notifications not supported');
            return false;
        }

        // Request permission
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            console.log(`❌ TTE notification permission: ${permission}`);
            return false;
        }

        console.log('✅ TTE notification permission granted');

        // Wait for service worker
        const registration = await navigator.serviceWorker.ready;
        console.log('✅ TTE Service Worker ready');

        // Get VAPID public key
        const response = await fetch(`${API_BASE_URL}/push/vapid-public-key`);
        const { publicKey } = await response.json();

        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Subscribe
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer
            });
            console.log('✅ TTE subscribed to push notifications');
        } else {
            console.log('✅ TTE already subscribed');
        }

        // Send subscription to backend with auth token and CSRF
        const token = localStorage.getItem('token');
        const csrfToken = getCsrfToken();
        await fetch(`${API_BASE_URL}/tte/push-subscribe`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
                ...(csrfToken && { 'X-CSRF-Token': csrfToken })
            },
            body: JSON.stringify({
                tteId,
                subscription: subscription.toJSON()
            })
        });

        console.log('✅ TTE push subscription registered with backend');
        return true;

    } catch (error) {
        console.error('❌ TTE push subscription error:', error);
        return false;
    }
}

/**
 * Convert base64 VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
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
}

/**
 * Unsubscribe TTE from push
 */
export async function unsubscribeTTEFromPush(tteId: string): Promise<boolean> {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();

            const token = localStorage.getItem('token');
            const csrfToken = getCsrfToken();
            await fetch(`${API_BASE_URL}/tte/push-unsubscribe`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                    ...(csrfToken && { 'X-CSRF-Token': csrfToken })
                },
                body: JSON.stringify({ tteId })
            });

            console.log('✅ TTE unsubscribed from push');
            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ TTE unsubscribe error:', error);
        return false;
    }
}
