// backend/services/GroupUpgradeService.js
// Manages group upgrade offers, timeouts, and status tracking

const db = require('../config/db');

class GroupUpgradeService {
    /**
     * Create a group upgrade offer with 15-minute timeout
     * @param {string} pnr - PNR number
     * @param {Array} passengerIds - Array of passenger IDs in the group
     * @param {number} vacantSeatsCount - Number of vacant seats available
     * @returns {Object} Created offer details
     */
    async createGroupUpgradeOffer(pnr, passengerIds, vacantSeatsCount) {
        try {
            const passengersCollection = db.getPassengersCollection();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

            // Update all passengers in the group with offer details
            const updateResult = await passengersCollection.updateMany(
                { PNR_Number: pnr },
                {
                    $set: {
                        'groupUpgradeStatus.isEligible': true,
                        'groupUpgradeStatus.offerCreatedAt': now,
                        'groupUpgradeStatus.expiresAt': expiresAt,
                        'groupUpgradeStatus.vacantSeatsCount': vacantSeatsCount,
                        'groupUpgradeStatus.offerExpired': false,
                        'groupUpgradeStatus.visibleToPassenger': true,
                        'groupUpgradeStatus.selectedBy': null
                    }
                }
            );

            console.log(`✅ Created group upgrade offer for PNR ${pnr} (expires at ${expiresAt.toISOString()})`);

            return {
                success: true,
                pnr,
                passengerCount: passengerIds.length,
                vacantSeatsCount,
                expiresAt,
                updatedCount: updateResult.modifiedCount
            };
        } catch (error) {
            console.error('Error creating group upgrade offer:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get active group upgrade offers that haven't expired
     * @returns {Array} List of active offers
     */
    async getActiveOffers() {
        try {
            const passengersCollection = db.getPassengersCollection();
            const now = new Date();

            const activeOffers = await passengersCollection.aggregate([
                {
                    $match: {
                        'groupUpgradeStatus.isEligible': true,
                        'groupUpgradeStatus.offerExpired': false,
                        'groupUpgradeStatus.expiresAt': { $gt: now }
                    }
                },
                {
                    $group: {
                        _id: '$PNR_Number',
                        pnr: { $first: '$PNR_Number' },
                        passengers: { $push: '$$ROOT' },
                        expiresAt: { $first: '$groupUpgradeStatus.expiresAt' },
                        vacantSeatsCount: { $first: '$groupUpgradeStatus.vacantSeatsCount' },
                        visibleToPassenger: { $first: '$groupUpgradeStatus.visibleToPassenger' }
                    }
                }
            ]).toArray();

            return activeOffers;
        } catch (error) {
            console.error('Error fetching active offers:', error);
            return [];
        }
    }

    /**
     * Mark offer as selected by TTE or passenger
     * @param {string} pnr - PNR number
     * @param {string} selectedBy - 'tte' or 'passenger'
     */
    async markOfferAsSelected(pnr, selectedBy) {
        try {
            const passengersCollection = db.getPassengersCollection();

            await passengersCollection.updateMany(
                { PNR_Number: pnr },
                {
                    $set: {
                        'groupUpgradeStatus.selectedBy': selectedBy,
                        'groupUpgradeStatus.selectedAt': new Date()
                    }
                }
            );

            console.log(`✅ Marked offer for PNR ${pnr} as selected by ${selectedBy}`);
            return { success: true };
        } catch (error) {
            console.error('Error marking offer as selected:', error);
            return { success: false, error: error.message };
        }
    }

    /**
   * Reject a group upgrade offer (marks entire PNR as rejected)
   * @param {string} pnr - PNR number
   * @param {string} reason - Optional rejection reason
   */
    async rejectGroupUpgradeOffer(pnr, reason = 'User declined') {
        try {
            const passengersCollection = db.getPassengersCollection();

            // Mark all RAC passengers in PNR with rejection flag
            const result = await passengersCollection.updateMany(
                {
                    PNR_Number: pnr,
                    PNR_Status: 'RAC'  // Only RAC passengers can reject
                },
                {
                    $set: {
                        hasRejectedGroupUpgrade: true,
                        groupUpgradeRejectedAt: new Date(),
                        groupUpgradeRejectionReason: reason
                    },
                    $unset: {
                        groupUpgradeStatus: ''  // Remove offer data
                    }
                }
            );

            console.log(`❌ PNR ${pnr} rejected group upgrade offer (${result.modifiedCount} passengers marked)`);
            return { success: true, modifiedCount: result.modifiedCount };
        } catch (error) {
            console.error('Error rejecting group upgrade offer:', error);
            return { success: false, error: error.message };
        }
    }

    /**
       * Expire an offer (called after 15 minutes timeout)
       * @param {string} pnr - PNR number
       */
    async expireOffer(pnr) {
        try {
            const passengersCollection = db.getPassengersCollection();

            const result = await passengersCollection.updateMany(
                { PNR_Number: pnr },
                {
                    $set: {
                        'groupUpgradeStatus.offerExpired': true,
                        'groupUpgradeStatus.visibleToPassenger': false,
                        'groupUpgradeStatus.expiredAt': new Date()
                    }
                }
            );

            console.log(`⏰ Expired offer for PNR ${pnr} (hidden from passenger, TTE-only now)`);
            return { success: true, modifiedCount: result.modifiedCount };
        } catch (error) {
            console.error('Error expiring offer:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check for expired offers and update them
     * Should be called periodically (e.g., every minute)
     */
    async processExpiredOffers() {
        try {
            // Skip if no train configured yet (bootstrap mode)
            let passengersCollection;
            try {
                passengersCollection = db.getPassengersCollection();
            } catch {
                return { processedCount: 0 }; // No train configured yet
            }
            const now = new Date();

            // Find all offers that have expired but aren't marked as such
            const expiredOffers = await passengersCollection.aggregate([
                {
                    $match: {
                        'groupUpgradeStatus.isEligible': true,
                        'groupUpgradeStatus.offerExpired': false,
                        'groupUpgradeStatus.expiresAt': { $lte: now },
                        'groupUpgradeStatus.selectedBy': null // Not yet selected
                    }
                },
                {
                    $group: {
                        _id: '$PNR_Number',
                        pnr: { $first: '$PNR_Number' }
                    }
                }
            ]).toArray();

            if (expiredOffers.length === 0) {
                return { processedCount: 0 };
            }

            console.log(`⏰ Processing ${expiredOffers.length} expired offer(s)...`);

            // Expire each offer
            for (const offer of expiredOffers) {
                await this.expireOffer(offer.pnr);
            }

            // ✅ AUTO-FALLBACK: Try to offer to the next eligible group
            try {
                const trainController = require('../controllers/trainController');
                const trainState = trainController.getGlobalTrainState();

                if (trainState) {
                    const ReallocationService = require('./ReallocationService');
                    const eligibleData = ReallocationService.getEligibleGroupsForVacantSeats(trainState);

                    if (eligibleData.eligibleGroups && eligibleData.eligibleGroups.length > 0) {
                        const nextGroup = eligibleData.eligibleGroups[0];
                        const offerResult = await this.createGroupUpgradeOffer(
                            nextGroup.pnr,
                            nextGroup.racPassengers.map(p => p.id),
                            eligibleData.totalVacantSeats
                        );

                        if (offerResult.success) {
                            console.log(`🔄 Auto-fallback: Offered upgrade to next group PNR ${nextGroup.pnr}`);

                            // Send to specific group's passenger portal
                            const wsManager = require('../config/websocket');
                            // Find the group leader's IRCTC ID from trainState
                            const trainController = require('../controllers/trainController');
                            const trainState = trainController.getGlobalTrainState();
                            const leader = trainState?.findPassengerByPNR(nextGroup.pnr);
                            if (leader?.irctcId) {
                                wsManager.sendToUser(leader.irctcId, {
                                    type: 'GROUP_UPGRADE_AVAILABLE',
                                    data: {
                                        pnr: nextGroup.pnr,
                                        passengerCount: nextGroup.eligibleCount,
                                        vacantSeatsCount: eligibleData.totalVacantSeats,
                                        expiresAt: offerResult.expiresAt
                                    }
                                });
                            } else {
                                // Fallback to broadcast if leader not identified
                                wsManager.broadcast({
                                    type: 'GROUP_UPGRADE_AVAILABLE',
                                    data: {
                                        pnr: nextGroup.pnr,
                                        passengerCount: nextGroup.eligibleCount,
                                        vacantSeatsCount: eligibleData.totalVacantSeats,
                                        expiresAt: offerResult.expiresAt
                                    }
                                });
                            }
                        }
                    }
                }
            } catch (fallbackError) {
                console.warn('⚠️ Auto-fallback failed (non-critical):', fallbackError.message);
            }

            return { processedCount: expiredOffers.length, pnrs: expiredOffers.map(o => o.pnr) };
        } catch (error) {
            console.error('Error processing expired offers:', error);
            return { processedCount: 0, error: error.message };
        }
    }

    /**
     * Clean up completed/cancelled offers
     * @param {string} pnr - PNR number
     */
    async cleanupOffer(pnr) {
        try {
            const passengersCollection = db.getPassengersCollection();

            await passengersCollection.updateMany(
                { PNR_Number: pnr },
                {
                    $unset: { groupUpgradeStatus: '' }
                }
            );

            console.log(`🧹 Cleaned up group upgrade offer for PNR ${pnr}`);
            return { success: true };
        } catch (error) {
            console.error('Error cleaning up offer:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if a PNR has an active offer
     * @param {string} pnr - PNR number
     * @returns {Object} Offer status
     */
    async getOfferStatus(pnr) {
        try {
            const passengersCollection = db.getPassengersCollection();

            const passenger = await passengersCollection.findOne(
                { PNR_Number: pnr },
                { projection: { groupUpgradeStatus: 1 } }
            );

            if (!passenger || !passenger.groupUpgradeStatus) {
                return { hasOffer: false };
            }

            const now = new Date();
            const expiresAt = new Date(passenger.groupUpgradeStatus.expiresAt);
            const isExpired = expiresAt <= now;

            return {
                hasOffer: true,
                isEligible: passenger.groupUpgradeStatus.isEligible,
                isExpired: isExpired || passenger.groupUpgradeStatus.offerExpired,
                visibleToPassenger: passenger.groupUpgradeStatus.visibleToPassenger,
                selectedBy: passenger.groupUpgradeStatus.selectedBy,
                expiresAt: expiresAt,
                timeRemaining: Math.max(0, Math.floor((expiresAt - now) / 1000)) // seconds
            };
        } catch (error) {
            console.error('Error getting offer status:', error);
            return { hasOffer: false, error: error.message };
        }
    }

    /**
     * Start the background timeout processor
     * Checks every 30 seconds for expired offers
     */
    startTimeoutProcessor() {
        console.log('🕐 Starting group upgrade timeout processor (checks every 30s)...');

        // Run immediately on startup
        this.processExpiredOffers();

        // Then run every 30 seconds
        this.timeoutInterval = setInterval(() => {
            this.processExpiredOffers();
        }, 30000); // 30 seconds
    }

    /**
     * Stop the background timeout processor
     */
    stopTimeoutProcessor() {
        if (this.timeoutInterval) {
            clearInterval(this.timeoutInterval);
            console.log('⏹️ Stopped group upgrade timeout processor');
        }
    }
}

module.exports = new GroupUpgradeService();
