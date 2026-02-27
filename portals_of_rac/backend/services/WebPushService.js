// backend/services/WebPushService.js
/**
 * Web Push Service
 * Sends browser push notifications to passengers
 */

const webPush = require('web-push');
const PushSubscriptionService = require('./PushSubscriptionService');

// VAPID keys from environment variables (generate with: npx web-push generate-vapid-keys)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@indianrailways.com';

// Validate VAPID keys are configured
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('❌ VAPID keys not configured! Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
    console.error('   Generate new keys: npx web-push generate-vapid-keys');
    throw new Error('VAPID keys required for Web Push Service');
}

// Configure VAPID
webPush.setVapidDetails(
    VAPID_EMAIL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

class WebPushService {
    constructor() {
        console.log('📨 WebPushService initialized');
        console.log('   VAPID configured ✓');
    }

    /**
     * Send push notification to a specific passenger
     */
    async sendPushNotification(irctcId, payload) {
        if (!irctcId) {
            console.error('❌ Cannot send push: IRCTC ID required');
            return { success: false, error: 'IRCTC ID required' };
        }

        // Now uses async MongoDB queries
        const subscriptions = await PushSubscriptionService.getSubscriptions(irctcId);

        if (subscriptions.length === 0) {
            console.log(`ℹ️  No push subscriptions for ${irctcId}`);
            return { success: false, sent: 0, message: 'No subscriptions' };
        }

        console.log(`📨 Sending push to ${subscriptions.length} device(s) for ${irctcId}`);

        const results = [];
        for (const subscription of subscriptions) {
            try {
                await webPush.sendNotification(
                    subscription,
                    JSON.stringify(payload),
                    {
                        TTL: 60 * 60 * 24 // 24 hours
                    }
                );
                results.push({ success: true, endpoint: subscription.endpoint });
                console.log(`   ✅ Sent to device`);
            } catch (error) {
                console.error(`   ❌ Failed to send:`, error.message);

                // Remove subscription if it's expired or invalid
                if (error.statusCode === 410 || error.statusCode === 404) {
                    console.log(`   🗑️  Removing invalid subscription`);
                    await PushSubscriptionService.deleteSubscription(subscription.endpoint);
                }

                results.push({
                    success: false,
                    endpoint: subscription.endpoint,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`📨 Push notification sent: ${successCount}/${subscriptions.length} devices`);

        return {
            success: successCount > 0,
            sent: successCount,
            total: subscriptions.length,
            results
        };
    }

    /**
     * Send no-show alert push notification
     */
    async sendNoShowAlert(irctcId, data) {
        return await this.sendPushNotification(irctcId, {
            title: '⚠️ NO-SHOW Alert',
            body: `You have been marked as NO-SHOW for PNR ${data.pnr}. Contact TTE if present.`,
            icon: '/logo192.png',
            badge: '/badge.png',
            url: 'http://localhost:5175/#/',
            data: {
                type: 'NO_SHOW_MARKED',
                pnr: data.pnr,
                berth: data.berth
            }
        });
    }

    /**
     * Send upgrade offer push notification
     */
    async sendUpgradeOfferAlert(irctcId, data) {
        return await this.sendPushNotification(irctcId, {
            title: '🎉 Upgrade Offer Available!',
            body: `Berth ${data.berth} is now available for upgrade. Check your offers!`,
            icon: '/logo192.png',
            badge: '/badge.png',
            url: 'http://localhost:5175/#/upgrades',
            data: {
                type: 'UPGRADE_OFFER',
                pnr: data.pnr,
                berth: data.berth,
                offerId: data.offerId
            }
        });
    }

    /**
     * Send no-show reverted push notification
     */
    async sendNoShowRevertedAlert(irctcId, data) {
        return await this.sendPushNotification(irctcId, {
            title: '✅ NO-SHOW Status Cleared',
            body: `Your NO-SHOW status has been cleared for PNR ${data.pnr}. Welcome back!`,
            icon: '/logo192.png',
            badge: '/badge.png',
            url: 'http://localhost:5175/#/',
            data: {
                type: 'NO_SHOW_REVERTED',
                pnr: data.pnr
            }
        });
    }

    /**
     * Get VAPID public key (for frontend)
     */
    getVapidPublicKey() {
        return VAPID_PUBLIC_KEY;
    }

    /**
     * Send push to ALL TTE portals (for offline passenger upgrades)
     */
    async sendPushToAllTTEs(payload) {
        const subscriptions = await PushSubscriptionService.getAllTTESubscriptions();

        if (subscriptions.length === 0) {
            console.log('⚠️  No TTE subscriptions');
            return { sent: 0, failed: 0 };
        }

        console.log(`📡 Broadcasting to ${subscriptions.length} TTE devices`);

        const promises = subscriptions.map(async (sub) => {
            try {
                await webPush.sendNotification(sub, JSON.stringify(payload));
                return { success: true };
            } catch (err) {
                console.error('❌ TTE push failed:', err.message);
                return { success: false };
            }
        });

        const results = await Promise.allSettled(promises);
        const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

        console.log(`📊 TTE Push: ${sent}/${subscriptions.length} sent`);
        return { sent, failed: subscriptions.length - sent };
    }

    /**
     * Send push to ALL Admin portals
     */
    async sendPushToAllAdmins(payload) {
        const subscriptions = await PushSubscriptionService.getAllAdminSubscriptions();

        if (subscriptions.length === 0) {
            console.log('⚠️  No Admin subscriptions');
            return { sent: 0, failed: 0 };
        }

        console.log(`📡 Broadcasting to ${subscriptions.length} Admin devices`);

        const promises = subscriptions.map(async (sub) => {
            try {
                await webPush.sendNotification(sub, JSON.stringify(payload));
                return { success: true };
            } catch (err) {
                console.error('❌ Admin push failed:', err.message);
                return { success: false };
            }
        });

        const results = await Promise.allSettled(promises);
        const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

        console.log(`📊 Admin Push: ${sent}/${subscriptions.length} sent`);
        return { sent, failed: subscriptions.length - sent };
    }

    /**
     * Notify TTEs when RAC passengers are sent for approval
     */
    async sendRACApprovalRequestToTTEs(data) {
        return await this.sendPushToAllTTEs({
            title: '🔔 RAC Upgrades Pending Approval',
            body: `${data.count} RAC passenger(s) need your approval at ${data.station}`,
            icon: '/logo192.png',
            badge: '/badge.png',
            url: 'http://localhost:5174/#/station-approval',
            data: {
                type: 'RAC_APPROVAL_REQUIRED',
                count: data.count,
                station: data.station,
                timestamp: new Date().toISOString()
            }
        });
    }

    /**
     * Notify Admins when TTE approves an upgrade
     */
    async sendApprovalNotificationToAdmins(data) {
        return await this.sendPushToAllAdmins({
            title: '✅ RAC Upgrade Approved',
            body: `${data.passengerName} (${data.pnr}) upgraded to ${data.berth}`,
            icon: '/logo192.png',
            badge: '/badge.png',
            url: 'http://localhost:3000/#/phase-one',
            data: {
                type: 'RAC_UPGRADE_APPROVED',
                pnr: data.pnr,
                passengerName: data.passengerName,
                berth: data.berth,
                timestamp: new Date().toISOString()
            }
        });
    }

    /**
     * ✅ DUAL-APPROVAL: Send upgrade offer to Online passenger
     * Called when RAC passengers are sent for approval and passenger is Online
     */
    async sendUpgradeOfferToPassenger(irctcId, data) {
        return await this.sendPushNotification(irctcId, {
            title: '🎉 Upgrade Offer Available!',
            body: `You can upgrade from ${data.currentBerth} to ${data.offeredBerth}. Tap to approve!`,
            icon: '/logo192.png',
            badge: '/badge.png',
            url: 'http://localhost:5175/#/dashboard',
            data: {
                type: 'DUAL_APPROVAL_UPGRADE_OFFER',
                pnr: data.pnr,
                currentBerth: data.currentBerth,
                offeredBerth: data.offeredBerth,
                offeredBerthType: data.offeredBerthType,
                offeredCoach: data.offeredCoach,
                timestamp: new Date().toISOString()
            }
        });
    }
}

module.exports = new WebPushService();

