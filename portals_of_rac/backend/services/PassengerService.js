// backend/services/PassengerService.js

const UpgradeNotificationService = require('./UpgradeNotificationService');
const db = require('../config/db');

/**
 * Service for passenger-related business logic
 * Separates business logic from HTTP controllers
 */
class PassengerService {
    /**
     * Accept upgrade offer - PERFORMS ACTUAL UPGRADE
     * @param {string} pnr - Passenger PNR
     * @param {string} notificationId - Notification ID
     * @param {TrainState} trainState - Current train state
     * @returns {Promise<Object>} Acceptance result
     * @throws {Error} If notification not found or invalid status
     */
    async acceptUpgrade(pnr, notificationId, trainState) {
        const AllocationService = require('./reallocation/AllocationService');

        // Get notification
        const allNotifications = await UpgradeNotificationService.getAllNotifications(pnr, trainState.trainNo);
        const notification = allNotifications.find(n => n.id === notificationId);

        if (!notification) {
            throw new Error('Notification not found');
        }

        // Validate status
        if (notification.status !== 'PENDING') {
            throw new Error(`Notification already ${notification.status.toLowerCase()}`);
        }

        // Check if notification has expired
        if (notification.expiresAt && new Date(notification.expiresAt) < new Date()) {
            throw new Error('Notification has expired');
        }

        // ✅ PERFORM ACTUAL UPGRADE using AllocationService
        // Extract coach and berth from offeredBerth (format: "S1-42" or "A1-15")
        const berthParts = notification.offeredBerth.split('-');
        const coach = berthParts[0];
        const berth = parseInt(berthParts[1]);

        console.log(`🎫 Passenger ${pnr} accepting upgrade: ${notification.currentBerth} → ${notification.offeredBerth}`);

        const allocationResult = await AllocationService.applyReallocation(trainState, [{
            pnr: pnr,
            coach: coach,
            berth: berth
        }]);

        if (!allocationResult.success) {
            throw new Error(allocationResult.message || 'Failed to apply upgrade');
        }

        // Mark notification as accepted
        const acceptedNotification = await UpgradeNotificationService.acceptUpgrade(pnr, notificationId, trainState.trainNo);

        // Update MongoDB passenger record with new status
        const passengersCollection = db.getPassengersCollection();
        await passengersCollection.updateOne(
            { PNR_Number: pnr },
            {
                $set: {
                    PNR_Status: 'CNF',
                    Assigned_Coach: coach,
                    Assigned_berth: berth,
                    Berth_Type: notification.offeredBerthType,
                    Preference_Matched: true,
                    Upgraded_From_RAC: true,
                    Upgraded_At: new Date()
                }
            }
        );

        console.log(`✅ Upgrade completed: ${pnr} is now CNF in ${notification.offeredBerth}`);

        // Find passenger in train state
        const passenger = trainState.findPassengerByPNR(pnr);

        return {
            success: true,
            notification: acceptedNotification,
            passenger: passenger ? {
                pnr: passenger.pnr,
                name: passenger.name,
                oldBerth: notification.currentBerth,
                newBerth: notification.offeredBerth,
                newStatus: 'CNF'
            } : null,
            message: 'Upgrade completed! You are now confirmed.'
        };
    }

    /**
     * Deny upgrade offer
     * @param {string} pnr - Passenger PNR
     * @param {string} notificationId - Notification ID
     * @param {string} trainNo - Train number for scoping
     * @returns {Promise<Object>} Denial result
     * @throws {Error} If notification not found or invalid status
     */
    async denyUpgrade(pnr, notificationId, trainNo = null) {
        // Get notification
        const allNotifications = await UpgradeNotificationService.getAllNotifications(pnr, trainNo);
        const notification = allNotifications.find(n => n.id === notificationId);

        if (!notification) {
            throw new Error('Notification not found');
        }

        // Validate status
        if (notification.status !== 'PENDING') {
            throw new Error(`Notification already ${notification.status.toLowerCase()}`);
        }

        // Deny the notification
        const deniedNotification = await UpgradeNotificationService.denyUpgrade(pnr, notificationId, 'Passenger declined', trainNo);

        return {
            success: true,
            notification: deniedNotification,
            message: 'Upgrade offer declined successfully'
        };
    }

    /**
     * Get upgrade notifications for passenger
     * @param {string} pnr - Passenger PNR
     * @param {string} trainNo - Train number for scoping
     * @returns {Array} Array of notifications
     */
    async getUpgradeNotifications(pnr, trainNo = null) {
        return await UpgradeNotificationService.getAllNotifications(pnr, trainNo);
    }

    /**
     * Get passenger details from database
     * @param {string} pnr - Passenger PNR
     * @param {TrainState} trainState - Current train state
     * @returns {Promise<Object>} Passenger details
     * @throws {Error} If passenger not found
     */
    async getPassengerDetails(pnr, trainState) {
        let passenger = null;

        // Strategy 1: Try configured collection first
        try {
            const col = db.getPassengersCollection();
            passenger = await col.findOne({ PNR_Number: pnr });
        } catch (_) {
            // Collection not configured — fall through
        }

        // Strategy 2: Search across all trains' passenger collections
        if (!passenger) {
            try {
                const passengersDb = db.getPassengersDb();
                const racDb = await db.getDb();
                const { COLLECTIONS } = require('../config/collections');
                const trainsCol = racDb.collection(COLLECTIONS.TRAINS_DETAILS);
                const trains = await trainsCol.find({}, {
                    projection: { Passengers_Collection_Name: 1, passengersCollection: 1 }
                }).toArray();

                const collectionNames = new Set();
                for (const t of trains) {
                    const name = t.passengersCollection || t.Passengers_Collection_Name;
                    if (name) collectionNames.add(name.trim());
                }

                for (const colName of collectionNames) {
                    try {
                        passenger = await passengersDb.collection(colName).findOne({ PNR_Number: pnr });
                        if (passenger) break;
                    } catch (e) { /* skip */ }
                }
            } catch (e) {
                // DB not ready
            }
        }

        if (!passenger) {
            throw new Error('PNR not found');
        }

        // Extract station code from "Station Name (CODE)" format
        const extractStationCode = (stationString) => {
            if (!stationString) return '';
            const match = stationString.match(/\(([^)]+)\)$/);
            return match ? match[1] : stationString;
        };

        const fromCode = passenger.From || extractStationCode(passenger.Boarding_Station);
        const stationData = trainState
            ? trainState.stations.find(s => s.code === fromCode)
            : null;

        return {
            pnr: passenger.PNR_Number,
            irctcId: passenger.IRCTC_ID || null,  // ✅ ADDED
            name: passenger.Name,
            age: passenger.Age,
            gender: passenger.Gender,
            mobile: passenger.Mobile,
            email: passenger.Email,
            trainNo: passenger.Train_Number,
            trainName: passenger.Train_Name || (trainState ? trainState.trainName : 'Unknown'),
            berth: `${passenger.Assigned_Coach}-${passenger.Assigned_berth}`,
            berthType: passenger.Berth_Type,
            pnrStatus: passenger.PNR_Status,
            racStatus: passenger.Rac_status || '-',
            class: passenger.Class,
            quota: passenger.Quota || 'GN',
            boardingStation: fromCode,
            boardingStationFull: passenger.Boarding_Station,
            boardingTime: stationData ? stationData.arrival : 'N/A',
            destinationStation: passenger.To || extractStationCode(passenger.Deboarding_Station),
            destinationStationFull: passenger.Deboarding_Station,
            boarded: passenger.Boarded || false,
            passengerStatus: passenger.Passenger_Status || 'Offline',
            noShow: passenger.NO_show || false,
            coach: passenger.Assigned_Coach,
            seatNo: passenger.Assigned_berth
        };
    }

    /**
     * Update passenger status for entire group
     * @param {string} pnr - PNR Number
     * @param {string} status - New status ('Online' or 'Offline')
     * @param {TrainState} trainState - Current train state
     */
    async updateGroupStatus(pnr, status, trainState) {
        if (!trainState) {
            console.warn('⚠️ TrainState not provided to updateGroupStatus');
            return;
        }

        try {
            console.log(`\n🔄 Syncing Group Status: Marking all passengers in PNR ${pnr} as ${status.toUpperCase()}`);

            // 1. Update In-Memory State
            const passengers = trainState.findPassengersByPNR(pnr);
            let updateCount = 0;

            passengers.forEach(p => {
                if (p.passengerStatus !== status) {
                    p.passengerStatus = status;
                    updateCount++;
                    console.log(`   ✅ Marked ${p.name} (${p.pnr}) as ${status}`);
                }
            });

            if (updateCount === 0) {
                console.log(`   (All ${passengers.length} already ${status})`);
            }

            // 2. Update Database (for persistence)
            const passengersCollection = db.getPassengersCollection();
            await passengersCollection.updateMany(
                { PNR_Number: pnr },
                { $set: { Passenger_Status: status, Last_Active: new Date() } }
            );

            console.log(`   💾 Updated Database for PNR ${pnr}`);

        } catch (error) {
            console.error('❌ Error syncing group status:', error);
        }
    }

    /**
     * Get passengers by status
     * @param {string} status - Status filter
     * @param {TrainState} trainState - Current train state
     * @returns {Array} Filtered passengers
     */
    getPassengersByStatus(status, trainState) {
        if (!trainState) {
            throw new Error('Train not initialized');
        }

        const allPassengers = trainState.getAllPassengers();

        switch (status?.toLowerCase()) {
            case 'boarded':
                return allPassengers.filter(p => p.boarded);
            case 'rac':
                return allPassengers.filter(p => p.pnrStatus === 'RAC');
            case 'cnf':
                return allPassengers.filter(p => p.pnrStatus === 'CNF');
            case 'no-show':
                return allPassengers.filter(p => p.noShow);
            default:
                return allPassengers;
        }
    }
}

module.exports = new PassengerService();
