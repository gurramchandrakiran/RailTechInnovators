// backend/services/PushSubscriptionService.js
/**
 * Push Subscription Service
 * Manages browser push notification subscriptions
 * Uses MongoDB for persistent storage
 */

const db = require('../config/db');
const { COLLECTIONS } = require('../config/collections');

class PushSubscriptionService {
    constructor() {
        console.log('📱 PushSubscriptionService initialized (MongoDB persistent)');
    }

    /**
     * Get the push subscriptions collection
     * Uses 'rac' database (same as auth)
     */
    async getCollection() {
        const racDb = await db.getDb();
        return racDb.collection(COLLECTIONS.PUSH_SUBSCRIPTIONS);
    }

    /**
     * Add a new push subscription for a passenger
     */
    async addSubscription(irctcId, subscription, userAgent = '') {
        if (!irctcId) {
            throw new Error('IRCTC ID is required');
        }

        if (!subscription || !subscription.endpoint) {
            throw new Error('Invalid subscription object');
        }

        try {
            const collection = await this.getCollection();

            // Check if subscription already exists (same endpoint)
            const query = {
                type: 'passenger',
                userId: irctcId,
                'subscription.endpoint': subscription.endpoint
            };

            const update = {
                $set: {
                    type: 'passenger',
                    userId: irctcId,
                    subscription: subscription,
                    userAgent: userAgent,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            };

            await collection.updateOne(query, update, { upsert: true });
            console.log(`✅ Added/Updated push subscription for ${irctcId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to add subscription: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all subscriptions for a passenger
     */
    async getSubscriptions(irctcId) {
        try {
            const collection = await this.getCollection();
            const docs = await collection.find({
                type: 'passenger',
                userId: irctcId
            }).toArray();

            return docs.map(doc => doc.subscription);
        } catch (error) {
            console.error(`❌ Failed to get subscriptions: ${error.message}`);
            return [];
        }
    }

    /**
     * Remove a specific subscription
     */
    async removeSubscription(irctcId, endpoint) {
        try {
            const collection = await this.getCollection();
            const result = await collection.deleteOne({
                type: 'passenger',
                userId: irctcId,
                'subscription.endpoint': endpoint
            });

            if (result.deletedCount > 0) {
                console.log(`🗑️  Removed subscription for ${irctcId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to remove subscription: ${error.message}`);
            return false;
        }
    }

    /**
     * Delete a subscription by endpoint (for invalid subscriptions)
     */
    async deleteSubscription(endpoint) {
        try {
            const collection = await this.getCollection();
            const result = await collection.deleteOne({
                'subscription.endpoint': endpoint
            });

            if (result.deletedCount > 0) {
                console.log(`🗑️  Deleted invalid subscription`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to delete subscription: ${error.message}`);
            return false;
        }
    }

    /**
     * Remove all subscriptions for a passenger
     */
    async clearSubscriptions(irctcId) {
        try {
            const collection = await this.getCollection();
            const result = await collection.deleteMany({
                type: 'passenger',
                userId: irctcId
            });

            if (result.deletedCount > 0) {
                console.log(`🗑️  Cleared all subscriptions for ${irctcId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to clear subscriptions: ${error.message}`);
            return false;
        }
    }

    /**
     * Get total subscription count
     */
    async getTotalCount() {
        try {
            const collection = await this.getCollection();
            return await collection.countDocuments({ type: 'passenger' });
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get statistics
     */
    async getStats() {
        try {
            const collection = await this.getCollection();

            const totalPassengers = await collection.distinct('userId', { type: 'passenger' });
            const totalPassengerSubs = await collection.countDocuments({ type: 'passenger' });

            const totalTTEs = await collection.distinct('userId', { type: 'tte' });
            const totalTTESubs = await collection.countDocuments({ type: 'tte' });

            return {
                passengers: {
                    users: totalPassengers.length,
                    subscriptions: totalPassengerSubs
                },
                ttes: {
                    users: totalTTEs.length,
                    subscriptions: totalTTESubs
                }
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    // ============ TTE SUBSCRIPTION METHODS ============

    /**
     * Add a push subscription for a TTE
     */
    async addTTESubscription(tteId, subscription, userAgent = '') {
        if (!tteId) {
            throw new Error('TTE ID is required');
        }

        if (!subscription || !subscription.endpoint) {
            throw new Error('Invalid subscription object');
        }

        try {
            const collection = await this.getCollection();

            const query = {
                type: 'tte',
                userId: tteId,
                'subscription.endpoint': subscription.endpoint
            };

            const update = {
                $set: {
                    type: 'tte',
                    userId: tteId,
                    subscription: subscription,
                    userAgent: userAgent,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            };

            await collection.updateOne(query, update, { upsert: true });
            console.log(`✅ Added/Updated TTE push subscription for ${tteId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to add TTE subscription: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all subscriptions for a TTE
     */
    async getTTESubscriptions(tteId) {
        try {
            const collection = await this.getCollection();
            const docs = await collection.find({
                type: 'tte',
                userId: tteId
            }).toArray();

            return docs.map(doc => doc.subscription);
        } catch (error) {
            console.error(`❌ Failed to get TTE subscriptions: ${error.message}`);
            return [];
        }
    }

    /**
     * Get ALL TTE subscriptions (for broadcasting to all TTEs)
     */
    async getAllTTESubscriptions() {
        try {
            const collection = await this.getCollection();
            const docs = await collection.find({ type: 'tte' }).toArray();
            return docs.map(doc => doc.subscription);
        } catch (error) {
            console.error(`❌ Failed to get all TTE subscriptions: ${error.message}`);
            return [];
        }
    }

    /**
     * Remove a TTE subscription
     */
    async removeTTESubscription(tteId, endpoint) {
        try {
            const collection = await this.getCollection();
            const result = await collection.deleteOne({
                type: 'tte',
                userId: tteId,
                'subscription.endpoint': endpoint
            });

            if (result.deletedCount > 0) {
                console.log(`🗑️  Removed TTE subscription for ${tteId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to remove TTE subscription: ${error.message}`);
            return false;
        }
    }

    /**
     * Clear all TTE subscriptions
     */
    async clearTTESubscriptions(tteId) {
        try {
            const collection = await this.getCollection();
            const result = await collection.deleteMany({
                type: 'tte',
                userId: tteId
            });

            if (result.deletedCount > 0) {
                console.log(`🗑️  Cleared all TTE subscriptions for ${tteId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to clear TTE subscriptions: ${error.message}`);
            return false;
        }
    }

    // ============ ADMIN SUBSCRIPTION METHODS ============

    /**
     * Add a push subscription for an Admin
     */
    async addAdminSubscription(adminId, subscription, userAgent = '') {
        if (!adminId) {
            throw new Error('Admin ID is required');
        }

        if (!subscription || !subscription.endpoint) {
            throw new Error('Invalid subscription object');
        }

        try {
            const collection = await this.getCollection();

            const query = {
                type: 'admin',
                userId: adminId,
                'subscription.endpoint': subscription.endpoint
            };

            const update = {
                $set: {
                    type: 'admin',
                    userId: adminId,
                    subscription: subscription,
                    userAgent: userAgent,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            };

            await collection.updateOne(query, update, { upsert: true });
            console.log(`✅ Added/Updated Admin push subscription for ${adminId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to add Admin subscription: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get ALL Admin subscriptions (for broadcasting to all Admins)
     */
    async getAllAdminSubscriptions() {
        try {
            const collection = await this.getCollection();
            const docs = await collection.find({ type: 'admin' }).toArray();
            return docs.map(doc => doc.subscription);
        } catch (error) {
            console.error(`❌ Failed to get all Admin subscriptions: ${error.message}`);
            return [];
        }
    }

    /**
     * Remove an Admin subscription
     */
    async removeAdminSubscription(adminId, endpoint) {
        try {
            const collection = await this.getCollection();
            const result = await collection.deleteOne({
                type: 'admin',
                userId: adminId,
                'subscription.endpoint': endpoint
            });

            if (result.deletedCount > 0) {
                console.log(`🗑️  Removed Admin subscription for ${adminId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to remove Admin subscription: ${error.message}`);
            return false;
        }
    }
}

module.exports = new PushSubscriptionService();
