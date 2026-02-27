// backend/services/PushNotificationService.js

/**
 * Push Notification Service
 * Sends Web Push notifications to passengers when RAC upgrades to CNF
 */

class PushNotificationService {
    constructor() {
        this.subscriptions = new Map(); // Store push subscriptions (PNR -> subscription)

        // In production, use environment variables for VAPID keys
        this.vapidKeys = {
            publicKey: 'YOUR_VAPID_PUBLIC_KEY_HERE',
            privateKey: 'YOUR_VAPID_PRIVATE_KEY_HERE'
        };

        console.log('📱 Push Notification Service initialized');
    }

    /**
     * Subscribe a passenger to push notifications
     */
    async subscribe(pnr, subscription) {
        try {
            this.subscriptions.set(pnr, subscription);
            console.log(`✅ Subscribed ${pnr} to push notifications`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error subscribing to notifications:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe a passenger from push notifications
     */
    async unsubscribe(pnr) {
        this.subscriptions.delete(pnr);
        console.log(`🔕 Unsubscribed ${pnr} from push notifications`);
        return { success: true };
    }

    /**
     * Send notification when RAC upgrades to CNF
     */
    async notifyUpgrade(passenger) {
        try {
            const subscription = this.subscriptions.get(passenger.PNR_Number);

            if (!subscription) {
                console.log(`⚠️ No subscription found for ${passenger.PNR_Number}`);
                return { success: false, reason: 'No subscription' };
            }

            const payload = JSON.stringify({
                title: '🎉 Your RAC Ticket is Confirmed!',
                body: `Congratulations ${passenger.Name}! Your RAC ticket has been upgraded to CNF. Seat: ${passenger.Coach}-${passenger.Seat_Number}`,
                icon: '/logo192.png',
                badge: '/badge.png',
                data: {
                    pnr: passenger.PNR_Number,
                    seat: `${passenger.Coach}-${passenger.Seat_Number}`,
                    url: '/dashboard'
                }
            });

            // In production, use web-push library:
            // const webpush = require('web-push');
            // await webpush.sendNotification(subscription, payload);

            console.log(`📨 Sent upgrade notification to ${passenger.Name} (${passenger.PNR_Number})`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error sending notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send bulk notifications to multiple passengers
     */
    async notifyBulk(passengers) {
        const results = {
            sent: 0,
            failed: 0,
            total: passengers.length
        };

        for (const passenger of passengers) {
            const result = await this.notifyUpgrade(passenger);
            if (result.success) {
                results.sent++;
            } else {
                results.failed++;
            }
        }

        console.log(`📊 Bulk notification results: ${results.sent}/${results.total} sent`);
        return results;
    }

    /**
     * Get VAPID public key for client
     */
    getPublicKey() {
        return this.vapidKeys.publicKey;
    }
}

module.exports = new PushNotificationService();
