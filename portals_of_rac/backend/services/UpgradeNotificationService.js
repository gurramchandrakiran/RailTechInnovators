// backend/services/UpgradeNotificationService.js
// UPDATED: Now uses MongoDB for persistence (survives server restarts)

const db = require("../config/db");
const { COLLECTIONS } = require('../config/collections');

class UpgradeNotificationService {
    constructor() {
        this.collectionName = COLLECTIONS.UPGRADE_NOTIFICATIONS;
        this.denialLogCollection = process.env.UPGRADE_DENIAL_LOG_COLLECTION || 'upgrade_denial_log';
        this.initialized = false;
        // ✅ Offer expiration time: 15 minutes
        this.OFFER_EXPIRY_MS = 15 * 60 * 1000;
        console.log('📩 UpgradeNotificationService initialized (MongoDB-backed, 15-min expiry)');
    }

    /**
     * Get MongoDB collection
     */
    async getCollection() {
        const racDb = await db.getDb();
        return racDb.collection(this.collectionName);
    }

    /**
     * Get denial log collection
     */
    async getDenialCollection() {
        const racDb = await db.getDb();
        return racDb.collection(this.denialLogCollection);
    }

    /**
     * Create upgrade notification for RAC passenger
     * Clears any old PENDING notifications for this station before creating new ones
     * @param {string} trainNo - Train number for scoping
     */
    async createUpgradeNotification(racPassenger, vacantBerth, currentStation, clearOldFirst = true, trainNo = null) {
        const collection = await this.getCollection();

        // Clear old pending notifications for this station AND this train (prevents duplicates)
        if (clearOldFirst) {
            const filter = { stationCode: currentStation.code, status: 'PENDING' };
            if (trainNo) filter.trainNo = String(trainNo);
            const deleteResult = await collection.deleteMany(filter);
            if (deleteResult.deletedCount > 0) {
                console.log(`   🗑️ Cleared ${deleteResult.deletedCount} old pending notifications for station ${currentStation.code} (train ${trainNo})`);
            }
        }

        const notification = {
            id: `UPGRADE_${Date.now()}_${racPassenger.pnr}`,
            trainNo: trainNo ? String(trainNo) : null,
            pnr: racPassenger.pnr,
            name: racPassenger.name,
            currentBerth: `${racPassenger.coach}-${racPassenger.seatNo}`,
            offeredBerth: vacantBerth.fullBerthNo,
            offeredCoach: vacantBerth.coachNo,
            offeredSeatNo: vacantBerth.berthNo,
            offeredBerthType: vacantBerth.type,
            station: currentStation.name,
            stationCode: currentStation.code,
            timestamp: new Date().toISOString(),
            status: 'PENDING', // PENDING, ACCEPTED, DENIED
            vacantSegment: vacantBerth.vacantSegment,
            createdAt: new Date()
        };

        await collection.insertOne(notification);

        console.log(`📩 [Train ${trainNo}] Upgrade notification created for ${racPassenger.name} (${racPassenger.pnr})`);
        console.log(`   Offered: ${vacantBerth.fullBerthNo} (${vacantBerth.type})`);

        return notification;
    }

    /**
     * Clear ALL pending notifications for a specific train
     * Called when new batch is being created at a new station
     * Old station offers should disappear when new ones arrive
     * @param {string} trainNo - Train number for scoping
     */
    async clearPendingNotificationsForStation(stationCode, trainNo = null) {
        const collection = await this.getCollection();
        // Clear pending notifications scoped to this train
        const filter = { status: 'PENDING' };
        if (trainNo) filter.trainNo = String(trainNo);
        const result = await collection.deleteMany(filter);
        if (result.deletedCount > 0) {
            console.log(`🗑️ [Train ${trainNo}] Cleared ${result.deletedCount} old pending notifications (new station: ${stationCode})`);
        }
        return result.deletedCount;
    }

    /**
     * Accept upgrade offer
     * @param {string} trainNo - Train number for scoping
     */
    async acceptUpgrade(pnr, notificationId, trainNo = null) {
        const collection = await this.getCollection();

        const filter = { id: notificationId, pnr };
        if (trainNo) filter.trainNo = String(trainNo);
        const notification = await collection.findOne(filter);

        if (!notification) {
            throw new Error(`Notification ${notificationId} not found for PNR ${pnr}`);
        }

        if (notification.status !== 'PENDING') {
            throw new Error(`Notification already ${notification.status}`);
        }

        await collection.updateOne(
            { id: notificationId },
            {
                $set: {
                    status: 'ACCEPTED',
                    acceptedAt: new Date().toISOString()
                }
            }
        );

        console.log(`✅ [Train ${trainNo}] Upgrade accepted by ${notification.name} (${pnr})`);

        return { ...notification, status: 'ACCEPTED', acceptedAt: new Date().toISOString() };
    }

    /**
     * Deny upgrade offer
     * UPDATED: Now sets Upgrade_Status = 'REJECTED' on passenger to exclude from future offers
     * @param {string} trainNo - Train number for scoping
     */
    async denyUpgrade(pnr, notificationId, reason = 'Passenger declined', trainNo = null) {
        const collection = await this.getCollection();
        const denialCollection = await this.getDenialCollection();

        const filter = { id: notificationId, pnr };
        if (trainNo) filter.trainNo = String(trainNo);
        const notification = await collection.findOne(filter);

        if (!notification) {
            throw new Error(`Notification ${notificationId} not found for PNR ${pnr}`);
        }

        if (notification.status !== 'PENDING') {
            throw new Error(`Notification already ${notification.status}`);
        }

        const deniedAt = new Date().toISOString();

        await collection.updateOne(
            { id: notificationId },
            {
                $set: {
                    status: 'DENIED',
                    deniedAt,
                    denialReason: reason
                }
            }
        );

        // Log denial with trainNo
        await denialCollection.insertOne({
            trainNo: trainNo ? String(trainNo) : (notification.trainNo || null),
            pnr,
            name: notification.name,
            offeredBerth: notification.offeredBerth,
            station: notification.station,
            timestamp: deniedAt,
            reason,
            createdAt: new Date()
        });

        // ✅ Mark passenger as rejected in main passengers collection
        // This excludes them from future upgrade offers
        try {
            const passengersCollection = db.getPassengersCollection();
            await passengersCollection.updateOne(
                { PNR_Number: pnr },
                {
                    $set: {
                        Upgrade_Status: 'REJECTED',
                        Upgrade_Rejected_At: new Date(),
                        Upgrade_Rejected_Reason: reason
                    }
                }
            );
            console.log(`   📝 [Train ${trainNo}] Updated passenger ${pnr} with Upgrade_Status = 'REJECTED'`);
        } catch (updateErr) {
            console.error(`   ⚠️ Failed to update passenger Upgrade_Status:`, updateErr.message);
        }

        console.log(`❌ [Train ${trainNo}] Upgrade denied by ${notification.name} (${pnr}): ${reason}`);

        return { ...notification, status: 'DENIED', deniedAt, denialReason: reason };
    }

    /**
     * Get pending notifications for passenger
     * Automatically expires offers older than OFFER_EXPIRY_MS (15 minutes)
     * @param {string} trainNo - Train number for scoping
     */
    async getPendingNotifications(pnr, trainNo = null) {
        const collection = await this.getCollection();
        const filter = { pnr, status: 'PENDING' };
        if (trainNo) filter.trainNo = String(trainNo);
        const allPending = await collection.find(filter).toArray();

        const now = Date.now();
        const validOffers = [];
        const expiredIds = [];

        for (const notification of allPending) {
            const createdTime = new Date(notification.createdAt).getTime();
            const age = now - createdTime;

            if (age > this.OFFER_EXPIRY_MS) {
                // Offer has expired
                expiredIds.push(notification.id);
                console.log(`⏰ Offer ${notification.id} expired (age: ${Math.round(age / 1000)}s)`);
            } else {
                // Still valid - add remaining time info
                notification.expiresIn = this.OFFER_EXPIRY_MS - age;
                notification.expiresAt = new Date(createdTime + this.OFFER_EXPIRY_MS).toISOString();
                validOffers.push(notification);
            }
        }

        // Mark expired offers in database
        if (expiredIds.length > 0) {
            await collection.updateMany(
                { id: { $in: expiredIds } },
                { $set: { status: 'EXPIRED', expiredAt: new Date() } }
            );
            console.log(`   📝 Marked ${expiredIds.length} offers as EXPIRED`);
        }

        return validOffers;
    }

    /**
     * Get all notifications for passenger
     * @param {string} trainNo - Train number for scoping
     */
    async getAllNotifications(pnr, trainNo = null) {
        const collection = await this.getCollection();
        const filter = { pnr };
        if (trainNo) filter.trainNo = String(trainNo);
        return await collection.find(filter).sort({ createdAt: -1 }).toArray();
    }

    /**
     * Clear notifications for passenger
     * @param {string} trainNo - Train number for scoping
     */
    async clearNotifications(pnr, trainNo = null) {
        const collection = await this.getCollection();
        const filter = { pnr };
        if (trainNo) filter.trainNo = String(trainNo);
        await collection.deleteMany(filter);
    }

    /**
     * Get denial log
     */
    async getDenialLog() {
        const denialCollection = await this.getDenialCollection();
        return await denialCollection.find({}).sort({ createdAt: -1 }).toArray();
    }

    /**
     * Check if passenger has denied this specific berth recently
     * @param {string} trainNo - Train number for scoping
     */
    async hasDeniedBerth(pnr, berthNo, trainNo = null) {
        const collection = await this.getCollection();
        const filter = { pnr, offeredBerth: berthNo, status: 'DENIED' };
        if (trainNo) filter.trainNo = String(trainNo);
        const denial = await collection.findOne(filter);
        return !!denial;
    }

    /**
     * Get all sent notifications (for TTE portal tracking)
     * @param {string} trainNo - Train number for scoping
     */
    async getAllSentNotifications(trainNo = null) {
        const collection = await this.getCollection();
        const filter = {};
        if (trainNo) filter.trainNo = String(trainNo);
        const notifications = await collection.find(filter).sort({ createdAt: -1 }).toArray();

        return notifications.map(notification => ({
            trainNo: notification.trainNo,
            pnr: notification.pnr,
            passengerName: notification.name,
            offeredBerth: notification.offeredBerth,
            coach: notification.offeredCoach,
            berthNo: notification.offeredSeatNo,
            berthType: notification.offeredBerthType,
            sentAt: notification.timestamp,
            expiresAt: null,
            status: notification.status.toLowerCase(),
            respondedAt: notification.acceptedAt || notification.deniedAt || null,
            offerId: notification.id
        }));
    }
}

module.exports = new UpgradeNotificationService();
