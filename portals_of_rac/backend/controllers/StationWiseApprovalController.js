/**
 * StationWiseApprovalController.js
 * Controller for station-wise RAC reallocation approval endpoints
 */

const StationWiseApprovalService = require('../services/StationWiseApprovalService');
const trainController = require('./trainController');
const db = require('../config/db');
const { COLLECTIONS } = require('../config/collections');

class StationWiseApprovalController {
    /**
     * Get all pending reallocations awaiting TTE approval
     * GET /reallocation/pending
     */
    async getPendingReallocations(req, res) {
        try {
            const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

            if (!trainState) {
                return res.status(400).json({
                    success: false,
                    message: 'Train not initialized'
                });
            }

            const pending = await StationWiseApprovalService.getPendingReallocations(trainState.trainNo);

            res.json({
                success: true,
                data: {
                    totalPending: pending.length,
                    reallocations: pending
                }
            });
        } catch (error) {
            console.error('Error getting pending reallocations:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to get pending reallocations',
                error: error.message
            });
        }
    }

    /**
     * Approve batch of reallocations
     * POST /reallocation/approve-batch
     * Body: { reallocationIds: [...], tteId: "..." }
     */
    async approveBatch(req, res) {
        try {
            const { reallocationIds, tteId } = req.body;

            if (!reallocationIds || !Array.isArray(reallocationIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid reallocationIds array'
                });
            }

            const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

            if (!trainState) {
                return res.status(400).json({
                    success: false,
                    message: 'Train not initialized'
                });
            }

            const result = await StationWiseApprovalService.approveBatch(
                reallocationIds,
                tteId || 'TTE',
                trainState
            );

            // Update train stats after approvals
            trainState.updateStats();

            // Broadcast approval to ALL clients (TTEs update dashboard, passengers fetch new status)
            const wsManager = require('../config/websocket');
            console.log(`🔔 Broadcasting RAC_REALLOCATION_APPROVED to all clients...`);
            wsManager.broadcast({
                type: 'RAC_REALLOCATION_APPROVED',
                data: {
                    totalApproved: result.totalApproved,
                    totalProcessed: result.totalProcessed,
                    approvedBy: tteId || 'TTE',
                    timestamp: new Date().toISOString()
                }
            });

            res.json({
                success: true,
                message: `Approved ${result.totalApproved} of ${result.totalProcessed} reallocations`,
                data: result
            });
        } catch (error) {
            console.error('Error approving batch:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to approve reallocations',
                error: error.message
            });
        }
    }

    /**
     * Reject a specific reallocation
     * POST /reallocation/reject/:id
     * Body: { reason: "...", tteId: "..." }
     */
    async rejectReallocation(req, res) {
        try {
            const { id } = req.params;
            const { reason, tteId } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    message: 'Rejection reason is required'
                });
            }

            const result = await StationWiseApprovalService.rejectReallocation(
                id,
                reason,
                tteId || 'TTE'
            );

            res.json(result);
        } catch (error) {
            console.error('Error rejecting reallocation:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to reject reallocation',
                error: error.message
            });
        }
    }

    /**
     * Get all approved reallocations
     * GET /reallocation/approved
     */
    async getApprovedReallocations(req, res) {
        try {
            const db = require('../config/db');
            const database = db.getPassengersCollection().s.db;
            const collection = database.collection(COLLECTIONS.STATION_REALLOCATIONS);

            const approved = await collection.find({ status: 'approved' }).sort({ processedAt: -1 }).toArray();

            res.json({
                success: true,
                data: approved,
                count: approved.length
            });
        } catch (error) {
            console.error('Error getting approved reallocations:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to get approved reallocations',
                error: error.message
            });
        }
    }

    /**
     * Get station-wise data for Admin portal
     * GET /reallocation/station-wise
     */
    async getStationWiseData(req, res) {
        try {
            const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

            if (!trainState) {
                return res.status(400).json({
                    success: false,
                    message: 'Train not initialized'
                });
            }

            if (!trainState.journeyStarted) {
                return res.status(400).json({
                    success: false,
                    message: 'Journey not started'
                });
            }

            const data = await StationWiseApprovalService.getStationWiseData(trainState);

            res.json({
                success: true,
                data: data
            });
        } catch (error) {
            console.error('Error getting station-wise data:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to get station-wise data',
                error: error.message
            });
        }
    }
}

module.exports = new StationWiseApprovalController();
