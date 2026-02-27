/**
 * StationWiseApprovalService.js
 * Handles TTE approval workflow for station-wise RAC reallocations
 * Creates pending reallocations that require TTE approval before execution
 */

const { ObjectId } = require('mongodb');
const db = require('../config/db');
const { COLLECTIONS } = require('../config/collections');
const wsManager = require('../config/websocket');
const EligibilityService = require('./reallocation/EligibilityService');
const VacancyService = require('./reallocation/VacancyService');
const AllocationService = require('./reallocation/AllocationService');
const CacheService = require('./CacheService');

class StationWiseApprovalService {
    /**
     * Process station arrival and create pending reallocations for TTE approval
     * Called from StationEventService when APPROVAL mode is enabled
     */
    async createPendingReallocations(trainState, newlyVacantBerths) {
        try {
            console.log('\n🎯 Creating pending reallocations for TTE approval...');

            if (!newlyVacantBerths || newlyVacantBerths.length === 0) {
                console.log('   No newly vacant berths - skipping');
                return { count: 0, pending: [] };
            }

            const currentStation = trainState.getCurrentStation();
            const currentIdx = trainState.currentStationIdx;

            // Get vacant segment ranges for newly vacant berths
            const vacantSegments = [];
            for (const vacantBerth of newlyVacantBerths) {
                const ranges = this._getVacantSegmentRangesForBerth(
                    vacantBerth.berth,
                    trainState.stations,
                    { coachNo: vacantBerth.coachNo, class: vacantBerth.class }
                );
                vacantSegments.push(...ranges);
            }

            if (vacantSegments.length === 0) {
                console.log('   No vacant segments found');
                return { count: 0, pending: [] };
            }

            console.log(`   Found ${vacantSegments.length} vacant segment(s)`);

            const pendingReallocations = [];

            // For each vacant segment, find eligible RAC passengers
            for (const vacantSegment of vacantSegments) {
                const eligiblePassengers = this._getEligiblePassengersForSegment(
                    vacantSegment,
                    currentIdx,
                    trainState
                );

                if (eligiblePassengers.length === 0) {
                    console.log(`   No eligible passengers for ${vacantSegment.berth.fullBerthNo}`);
                    continue;
                }

                // Create pending reallocation for top candidate (highest priority)
                const topCandidate = eligiblePassengers[0];

                const pendingReallocation = {
                    trainId: trainState.trainNo,
                    stationIdx: currentIdx,
                    stationName: currentStation.name,
                    stationCode: currentStation.code,

                    // Passenger details
                    passengerPNR: topCandidate.pnr,
                    passengerName: topCandidate.name,
                    currentRAC: topCandidate.racStatus,
                    currentBerth: `${topCandidate.coach}-${topCandidate.seat}`,
                    passengerFrom: topCandidate.from,
                    passengerTo: topCandidate.to,
                    passengerFromIdx: topCandidate.fromIdx,
                    passengerToIdx: topCandidate.toIdx,
                    passengerStatus: topCandidate.passengerStatus || 'Offline',

                    // Proposed berth details
                    proposedCoach: vacantSegment.berth.coachNo,
                    proposedBerth: vacantSegment.berth.berthNo,
                    proposedBerthFull: vacantSegment.berth.fullBerthNo,
                    proposedBerthType: vacantSegment.berth.type,
                    berthVacantFrom: vacantSegment.fromStation,
                    berthVacantTo: vacantSegment.toStation,
                    berthVacantFromIdx: vacantSegment.fromIdx,
                    berthVacantToIdx: vacantSegment.toIdx,

                    // Metadata
                    status: 'pending',
                    createdAt: new Date(),
                    processedAt: null,
                    processedBy: null,
                    rejectionReason: null
                };

                pendingReallocations.push(pendingReallocation);
                console.log(`   ✅ Created pending: ${topCandidate.name} → ${vacantSegment.berth.fullBerthNo}`);
            }

            // Save to MongoDB
            if (pendingReallocations.length > 0) {
                await this._savePendingReallocations(pendingReallocations);

                // Notify TTEs via WebSocket (targeted — only TTEs need this)
                wsManager.sendToTTEs({
                    type: 'PENDING_REALLOCATIONS',
                    target: 'TTE',
                    count: pendingReallocations.length,
                    station: currentStation.name
                });
            }

            console.log(`\n✨ Created ${pendingReallocations.length} pending reallocation(s)`);

            return {
                count: pendingReallocations.length,
                pending: pendingReallocations
            };
        } catch (error) {
            console.error('❌ Error creating pending reallocations:', error.message);
            return { count: 0, pending: [], error: error.message };
        }
    }

    /**
     * Get eligible passengers for a vacant segment
     * Reuses existing EligibilityService logic
     */
    _getEligiblePassengersForSegment(vacantSegment, currentIdx, trainState) {
        try {
            const boardedRAC = trainState.getBoardedRACPassengers();
            const eligible = [];

            for (const rac of boardedRAC) {
                // Stage 1: Hard constraints
                const stage1Result = EligibilityService.checkStage1Eligibility(
                    rac,
                    vacantSegment,
                    currentIdx,
                    trainState
                );

                if (!stage1Result.eligible) {
                    continue;
                }

                // Stage 2: Refinement filters
                const stage2Result = EligibilityService.checkStage2Eligibility(
                    rac,
                    vacantSegment,
                    currentIdx,
                    trainState
                );

                if (stage2Result.eligible) {
                    eligible.push({
                        ...rac,
                        eligibilityScore: this._calculateEligibilityScore(rac, vacantSegment)
                    });
                }
            }

            // Sort by RAC priority (RAC 1 > RAC 2 > RAC 3)
            eligible.sort((a, b) => {
                const getRACNum = (status) => {
                    const match = status?.match(/RAC\s*(\d+)/i);
                    return match ? parseInt(match[1]) : 999;
                };
                return getRACNum(a.racStatus) - getRACNum(b.racStatus);
            });

            return eligible;
        } catch (error) {
            console.error('Error getting eligible passengers:', error.message);
            return [];
        }
    }

    /**
     * Calculate eligibility score for sorting
     */
    _calculateEligibilityScore(passenger, vacantSegment) {
        let score = 0;

        // Higher priority for lower RAC numbers
        const racNum = parseInt(passenger.racStatus?.match(/\d+/)?.[0] || 999);
        score += (1000 - racNum);

        // Bonus for journey overlap
        const overlap = Math.min(passenger.toIdx, vacantSegment.toIdx) -
            Math.max(passenger.fromIdx, vacantSegment.fromIdx);
        score += overlap * 10;

        return score;
    }

    /**
     * Get vacant segment ranges for a berth
     * Copied from StationEventService for consistency
     */
    _getVacantSegmentRangesForBerth(berth, stations, coach) {
        const ranges = [];
        let rangeStart = null;

        for (let i = 0; i < berth.segmentOccupancy.length; i++) {
            if (berth.segmentOccupancy[i] === null) {
                if (rangeStart === null) {
                    rangeStart = i;
                }
            } else {
                if (rangeStart !== null) {
                    ranges.push({
                        berth: berth,
                        coachNo: coach.coachNo,
                        class: coach.class,
                        fromIdx: rangeStart,
                        toIdx: i,
                        fromStation: stations[rangeStart]?.code || `S${rangeStart}`,
                        toStation: stations[i]?.code || `S${i}`,
                    });
                    rangeStart = null;
                }
            }
        }

        if (rangeStart !== null) {
            ranges.push({
                berth: berth,
                coachNo: coach.coachNo,
                class: coach.class,
                fromIdx: rangeStart,
                toIdx: berth.segmentOccupancy.length,
                fromStation: stations[rangeStart]?.code || `S${rangeStart}`,
                toStation: stations[berth.segmentOccupancy.length]?.code || `S${berth.segmentOccupancy.length}`,
            });
        }

        return ranges;
    }

    /**
     * Save pending reallocations to MongoDB
     * STRATEGY: Delete ALL existing pending reallocations, then insert fresh batch
     * This ensures old/stale entries from ALL stations are cleared
     */
    async _savePendingReallocations(pendingReallocations) {
        try {
            const database = db.getPassengersCollection().s.db;
            const collection = database.collection(COLLECTIONS.STATION_REALLOCATIONS);

            if (pendingReallocations.length === 0) {
                return { insertedCount: 0, deletedCount: 0 };
            }

            const trainId = pendingReallocations[0].trainId;

            // STEP 1: Delete ALL existing PENDING reallocations for this train
            // This prevents accumulation of stale entries from previous stations
            const deleteResult = await collection.deleteMany({
                trainId: trainId,
                status: 'pending'
            });

            if (deleteResult.deletedCount > 0) {
                console.log(`   🗑️ Cleared ${deleteResult.deletedCount} old pending entries`);
            }

            // STEP 2: Insert the fresh batch for current station
            const insertResult = await collection.insertMany(pendingReallocations);

            console.log(`   💾 Saved ${insertResult.insertedCount} pending reallocations to MongoDB`);

            return {
                insertedCount: insertResult.insertedCount,
                deletedCount: deleteResult.deletedCount
            };
        } catch (error) {
            console.error('Error saving to MongoDB:', error.message);
            throw error;
        }
    }

    /**
     * Get all pending reallocations (for TTE portal)
     */
    async getPendingReallocations(trainId = null) {
        try {
            const database = db.getPassengersCollection().s.db;
            const collection = database.collection(COLLECTIONS.STATION_REALLOCATIONS);

            const query = { status: 'pending' };
            if (trainId) {
                query.trainId = trainId;
            }

            const pending = await collection.find(query).sort({ createdAt: -1 }).toArray();
            return pending;
        } catch (error) {
            console.error('Error getting pending reallocations:', error.message);
            return [];
        }
    }

    /**
     * Approve batch of reallocations
     */
    async approveBatch(reallocationIds, tteId, trainState) {
        try {
            console.log(`\n✅ Approving ${reallocationIds.length} reallocation(s)...`);

            const database = db.getPassengersCollection().s.db;
            const collection = database.collection(COLLECTIONS.STATION_REALLOCATIONS);
            const results = [];

            for (const id of reallocationIds) {
                try {
                    // Get pending reallocation
                    const pending = await collection.findOne({ _id: new ObjectId(id) });

                    if (!pending || pending.status !== 'pending') {
                        console.log(`   ⚠️  Reallocation ${id} not found or not pending`);
                        continue;
                    }

                    // Execute allocation using AllocationService
                    const allocationResult = await AllocationService.applyReallocation(trainState, [{
                        pnr: pending.passengerPNR,
                        coach: pending.proposedCoach,
                        berth: pending.proposedBerth
                    }]);

                    if (allocationResult.success) {
                        // Update status to approved
                        await collection.updateOne(
                            { _id: new ObjectId(id) },
                            {
                                $set: {
                                    status: 'approved',
                                    processedAt: new Date(),
                                    processedBy: tteId
                                }
                            }
                        );

                        console.log(`   ✅ Approved: ${pending.passengerName} → ${pending.proposedBerthFull}`);
                        results.push({ id, success: true, passenger: pending.passengerName });

                        // 📨 Send push notification to Admin portal
                        try {
                            const WebPushService = require('./WebPushService');
                            await WebPushService.sendApprovalNotificationToAdmins({
                                pnr: pending.passengerPNR,
                                passengerName: pending.passengerName,
                                berth: pending.proposedBerthFull
                            });
                        } catch (pushError) {
                            console.error('⚠️ Failed to send Admin push:', pushError.message);
                        }
                    }
                } catch (error) {
                    console.error(`   ❌ Error approving ${id}:`, error.message);
                    results.push({ id, success: false, error: error.message });
                }
            }

            return {
                success: true,
                totalProcessed: reallocationIds.length,
                totalApproved: results.filter(r => r.success).length,
                results
            };
        } catch (error) {
            console.error('Error approving batch:', error.message);
            throw error;
        }
    }

    /**
     * Reject a specific reallocation
     */
    async rejectReallocation(reallocationId, reason, tteId) {
        try {
            const database = db.getPassengersCollection().s.db;
            const collection = database.collection(COLLECTIONS.STATION_REALLOCATIONS);

            // Get the pending reallocation first (for notification)
            const pending = await collection.findOne({ _id: new ObjectId(reallocationId) });

            const result = await collection.updateOne(
                { _id: new ObjectId(reallocationId) },
                {
                    $set: {
                        status: 'rejected',
                        processedAt: new Date(),
                        processedBy: tteId,
                        rejectionReason: reason
                    }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`   ❌ Rejected reallocation: ${reallocationId}`);

                // ✅ Notify the passenger about rejection
                if (pending && pending.passengerIrctcId) {
                    try {
                        // Send push notification
                        const WebPushService = require('./WebPushService');
                        await WebPushService.sendPushNotification(pending.passengerIrctcId, {
                            title: '❌ Upgrade Rejected',
                            body: `Your upgrade to ${pending.proposedBerthFull} was rejected. Reason: ${reason}`,
                            icon: '/logo192.png',
                            url: 'http://localhost:5175/#/dashboard',
                            data: {
                                type: 'RAC_UPGRADE_REJECTED',
                                pnr: pending.passengerPNR,
                                reason: reason
                            }
                        });
                        console.log(`   📲 Rejection push sent to ${pending.passengerIrctcId}`);
                    } catch (pushErr) {
                        console.error('   ⚠️ Rejection push failed:', pushErr.message);
                    }

                    // WebSocket — send rejection to specific passenger only
                    try {
                        wsManager.sendToUser(pending.passengerIrctcId, {
                            type: 'RAC_UPGRADE_REJECTED',
                            data: {
                                reallocationId: reallocationId,
                                irctcId: pending.passengerIrctcId,
                                pnr: pending.passengerPNR,
                                reason: reason,
                                rejectedBy: tteId
                            }
                        });
                    } catch (wsErr) {
                        console.error('   ⚠️ WebSocket send failed:', wsErr.message);
                    }
                }

                return { success: true, message: 'Reallocation rejected' };
            } else {
                return { success: false, message: 'Reallocation not found' };
            }
        } catch (error) {
            console.error('Error rejecting reallocation:', error.message);
            throw error;
        }
    }

    /**
     * Get station-wise view data (for Admin portal)
     * Uses caching to improve performance
     */
    async getStationWiseData(trainState) {
        try {
            const currentStation = trainState.getCurrentStation();
            const currentIdx = trainState.currentStationIdx;
            const trainNo = trainState.trainNo;

            // Check cache first
            const cacheKey = `${currentStation.code}`;
            const cached = CacheService.getReallocation(trainNo, cacheKey);
            if (cached) {
                console.log(`📦 Cache HIT for station-wise data: ${cacheKey}`);
                return cached;
            }

            // Get currently boarded RAC passengers
            const boardedRAC = trainState.getBoardedRACPassengers();

            // Get vacant berths from current station onwards
            const allVacancies = VacancyService.getVacantBerths(trainState);
            const currentStationVacancies = allVacancies.filter(v => v.fromIdx >= currentIdx);

            // Get pending reallocations
            const pending = await this.getPendingReallocations(trainState.trainNo);

            const result = {
                currentStation: {
                    name: currentStation.name,
                    code: currentStation.code,
                    idx: currentIdx
                },
                boardedRAC: boardedRAC.map(rac => ({
                    pnr: rac.pnr,
                    name: rac.name,
                    racStatus: rac.racStatus,
                    from: rac.from,
                    to: rac.to,
                    currentBerth: `${rac.coach}-${rac.seat}`,
                    passengerStatus: rac.passengerStatus
                })),
                vacantBerths: currentStationVacancies.map(v => ({
                    berth: v.berth,
                    coach: v.coach,
                    type: v.type,
                    class: v.class,
                    vacantFrom: v.vacantFrom,
                    vacantTo: v.vacantTo,
                    duration: v.duration
                })),
                pendingReallocations: pending,
                stats: {
                    boardedRACCount: boardedRAC.length,
                    vacantBerthsCount: currentStationVacancies.length,
                    pendingCount: pending.length
                },
                cachedAt: new Date().toISOString()
            };

            // Cache the result
            CacheService.setReallocation(trainNo, cacheKey, result);
            console.log(`📦 Cache SET for station-wise data: ${cacheKey}`);

            return result;
        } catch (error) {
            console.error('Error getting station-wise data:', error.message);
            throw error;
        }
    }
}

module.exports = new StationWiseApprovalService();
