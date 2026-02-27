// backend/services/InAppNotificationService.js
// UPDATED: Now uses MongoDB for persistence (survives server restarts)

/**
 * In-App Notification Service
 * Manages real-time notifications for passenger portal
 */

const db = require('../config/db');
const { COLLECTIONS } = require('../config/collections');

class InAppNotificationService {
    constructor() {
        this.collectionName = COLLECTIONS.IN_APP_NOTIFICATIONS;
        console.log('📱 InAppNotificationService initialized (MongoDB-backed)');
    }

    /**
     * Get MongoDB collection
     */
    async getCollection() {
        const racDb = await db.getDb();
        return racDb.collection(this.collectionName);
    }

    /**
     * Create a new notification
     */
    async createNotification(irctcId, type, data) {
        if (!irctcId) {
            console.error('❌ Cannot create notification: IRCTC ID is required');
            return null;
        }

        const collection = await this.getCollection();

        const notification = {
            id: `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            irctcId,
            type, // 'NO_SHOW_MARKED', 'UPGRADE_OFFER', 'NO_SHOW_REVERTED'
            data,
            read: false,
            createdAt: new Date()
        };

        await collection.insertOne(notification);

        console.log(`📬 Created ${type} notification for ${irctcId}`);
        return notification;
    }

    /**
     * Get all notifications for a user
     */
    async getNotifications(irctcId, limit = null) {
        const collection = await this.getCollection();

        let query = collection.find({ irctcId }).sort({ createdAt: -1 });

        if (limit) {
            query = query.limit(limit);
        }

        return await query.toArray();
    }

    /**
     * Get unread notifications
     */
    async getUnreadNotifications(irctcId) {
        const collection = await this.getCollection();
        return await collection.find({ irctcId, read: false }).sort({ createdAt: -1 }).toArray();
    }

    /**
     * Get unread count
     */
    async getUnreadCount(irctcId) {
        const collection = await this.getCollection();
        return await collection.countDocuments({ irctcId, read: false });
    }

    /**
     * Mark notification as read
     */
    async markAsRead(irctcId, notificationId) {
        const collection = await this.getCollection();

        const notification = await collection.findOne({ irctcId, id: notificationId });

        if (!notification) {
            throw new Error('Notification not found');
        }

        await collection.updateOne(
            { id: notificationId },
            { $set: { read: true, readAt: new Date() } }
        );

        console.log(`✅ Marked notification ${notificationId} as read`);
        return { ...notification, read: true };
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(irctcId) {
        const collection = await this.getCollection();

        const result = await collection.updateMany(
            { irctcId, read: false },
            { $set: { read: true, readAt: new Date() } }
        );

        console.log(`✅ Marked ${result.modifiedCount} notifications as read for ${irctcId}`);
        return result.modifiedCount;
    }

    /**
     * Delete notification
     */
    async deleteNotification(irctcId, notificationId) {
        const collection = await this.getCollection();

        const result = await collection.deleteOne({ irctcId, id: notificationId });

        if (result.deletedCount === 0) {
            throw new Error('Notification not found');
        }

        console.log(`🗑️  Deleted notification ${notificationId}`);
        return true;
    }

    /**
     * Clear all notifications for a user
     */
    async clearAllNotifications(irctcId) {
        const collection = await this.getCollection();
        await collection.deleteMany({ irctcId });
        console.log(`🗑️  Cleared all notifications for ${irctcId}`);
        return true;
    }

    /**
     * Get notification statistics
     */
    async getStats(irctcId) {
        const collection = await this.getCollection();

        const [total, unread, noShowMarked, upgradeOffer, noShowReverted] = await Promise.all([
            collection.countDocuments({ irctcId }),
            collection.countDocuments({ irctcId, read: false }),
            collection.countDocuments({ irctcId, type: 'NO_SHOW_MARKED' }),
            collection.countDocuments({ irctcId, type: 'UPGRADE_OFFER' }),
            collection.countDocuments({ irctcId, type: 'NO_SHOW_REVERTED' })
        ]);

        return {
            total,
            unread,
            read: total - unread,
            byType: {
                NO_SHOW_MARKED: noShowMarked,
                UPGRADE_OFFER: upgradeOffer,
                NO_SHOW_REVERTED: noShowReverted
            }
        };
    }
}

module.exports = new InAppNotificationService();
