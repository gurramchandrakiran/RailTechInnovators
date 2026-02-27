/**
 * StationWiseApprovalController Tests - Comprehensive Coverage
 * Tests for station-wise RAC reallocation approval endpoints
 */

const controller = require('../../controllers/StationWiseApprovalController');
const StationWiseApprovalService = require('../../services/StationWiseApprovalService');
const trainController = require('../../controllers/trainController');
const db = require('../../config/db');
const wsManager = require('../../config/websocket');

jest.mock('../../services/StationWiseApprovalService');
jest.mock('../../controllers/trainController');
jest.mock('../../config/db');
jest.mock('../../config/websocket');

describe('StationWiseApprovalController - Comprehensive Tests', () => {
    let req, res;
    let mockTrainState;
    let mockDatabase;
    let mockCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCollection = {
            find: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([])
        };

        mockDatabase = {
            collection: jest.fn(() => mockCollection)
        };

        db.getPassengersCollection = jest.fn(() => ({
            s: { db: mockDatabase }
        }));

        wsManager.broadcast = jest.fn();

        mockTrainState = {
            trainNo: '17225',
            trainName: 'Test Express',
            updateStats: jest.fn()
        };

        trainController.getGlobalTrainState = jest.fn(() => mockTrainState);

        req = { params: {}, body: {}, query: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    describe('getPendingReallocations', () => {
        it('should return pending reallocations successfully', async () => {
            const mockPending = [
                { id: 'R001', pnr: 'P001', status: 'pending' },
                { id: 'R002', pnr: 'P002', status: 'pending' }
            ];
            StationWiseApprovalService.getPendingReallocations.mockResolvedValue(mockPending);

            await controller.getPendingReallocations(req, res);

            expect(StationWiseApprovalService.getPendingReallocations).toHaveBeenCalledWith('17225');
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    totalPending: 2,
                    reallocations: mockPending
                }
            });
        });

        it('should return 400 if train not initialized', async () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            await controller.getPendingReallocations(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Train not initialized'
            });
        });

        it('should handle service errors gracefully', async () => {
            StationWiseApprovalService.getPendingReallocations.mockRejectedValue(
                new Error('Database error')
            );

            await controller.getPendingReallocations(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to get pending reallocations',
                error: 'Database error'
            });
        });

        it('should return empty array if no pending reallocations', async () => {
            StationWiseApprovalService.getPendingReallocations.mockResolvedValue([]);

            await controller.getPendingReallocations(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    totalPending: 0,
                    reallocations: []
                }
            });
        });
    });

    describe('approveBatch', () => {
        it('should approve batch of reallocations successfully', async () => {
            req.body = {
                reallocationIds: ['R001', 'R002', 'R003'],
                tteId: 'TTE123'
            };

            const mockResult = {
                totalApproved: 3,
                totalProcessed: 3,
                approved: ['R001', 'R002', 'R003'],
                failed: []
            };

            StationWiseApprovalService.approveBatch.mockResolvedValue(mockResult);

            await controller.approveBatch(req, res);

            expect(StationWiseApprovalService.approveBatch).toHaveBeenCalledWith(
                ['R001', 'R002', 'R003'],
                'TTE123',
                mockTrainState
            );
            expect(mockTrainState.updateStats).toHaveBeenCalled();
            expect(wsManager.broadcast).toHaveBeenCalledWith({
                type: 'RAC_REALLOCATION_APPROVED',
                data: expect.objectContaining({
                    totalApproved: 3,
                    totalProcessed: 3,
                    approvedBy: 'TTE123'
                })
            });
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Approved 3 of 3 reallocations',
                data: mockResult
            });
        });

        it('should return 400 if reallocationIds not provided', async () => {
            req.body = { tteId: 'TTE123' };

            await controller.approveBatch(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid reallocationIds array'
            });
        });

        it('should return 400 if reallocationIds is not an array', async () => {
            req.body = { reallocationIds: 'R001', tteId: 'TTE123' };

            await controller.approveBatch(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid reallocationIds array'
            });
        });

        it('should return 400 if train not initialized', async () => {
            req.body = { reallocationIds: ['R001'], tteId: 'TTE123' };
            trainController.getGlobalTrainState.mockReturnValue(null);

            await controller.approveBatch(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Train not initialized'
            });
        });

        it('should use default TTE if tteId not provided', async () => {
            req.body = { reallocationIds: ['R001'] };

            const mockResult = { totalApproved: 1, totalProcessed: 1 };
            StationWiseApprovalService.approveBatch.mockResolvedValue(mockResult);

            await controller.approveBatch(req, res);

            expect(StationWiseApprovalService.approveBatch).toHaveBeenCalledWith(
                ['R001'],
                'TTE',
                mockTrainState
            );
        });

        it('should handle partial approval scenario', async () => {
            req.body = {
                reallocationIds: ['R001', 'R002', 'R003'],
                tteId: 'TTE123'
            };

            const mockResult = {
                totalApproved: 2,
                totalProcessed: 3,
                approved: ['R001', 'R002'],
                failed: [{ id: 'R003', error: 'Passenger not found' }]
            };

            StationWiseApprovalService.approveBatch.mockResolvedValue(mockResult);

            await controller.approveBatch(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Approved 2 of 3 reallocations',
                data: mockResult
            });
        });

        it('should handle service errors gracefully', async () => {
            req.body = { reallocationIds: ['R001'], tteId: 'TTE123' };
            StationWiseApprovalService.approveBatch.mockRejectedValue(
                new Error('Approval failed')
            );

            await controller.approveBatch(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to approve reallocations',
                error: 'Approval failed'
            });
        });

        it('should handle empty reallocationIds array', async () => {
            req.body = { reallocationIds: [], tteId: 'TTE123' };

            const mockResult = { totalApproved: 0, totalProcessed: 0 };
            StationWiseApprovalService.approveBatch.mockResolvedValue(mockResult);

            await controller.approveBatch(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Approved 0 of 0 reallocations',
                data: mockResult
            });
        });
    });

    describe('rejectReallocation', () => {
        it('should reject reallocation successfully', async () => {
            req.params.id = 'R001';
            req.body = { reason: 'Passenger declined', tteId: 'TTE123' };

            const mockResult = {
                success: true,
                message: 'Reallocation rejected',
                reallocation: { id: 'R001', status: 'rejected' }
            };

            StationWiseApprovalService.rejectReallocation.mockResolvedValue(mockResult);

            await controller.rejectReallocation(req, res);

            expect(StationWiseApprovalService.rejectReallocation).toHaveBeenCalledWith(
                'R001',
                'Passenger declined',
                'TTE123'
            );
            expect(res.json).toHaveBeenCalledWith(mockResult);
        });

        it('should return 400 if reason not provided', async () => {
            req.params.id = 'R001';
            req.body = { tteId: 'TTE123' };

            await controller.rejectReallocation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Rejection reason is required'
            });
        });

        it('should use default TTE if tteId not provided', async () => {
            req.params.id = 'R001';
            req.body = { reason: 'Not suitable' };

            const mockResult = { success: true };
            StationWiseApprovalService.rejectReallocation.mockResolvedValue(mockResult);

            await controller.rejectReallocation(req, res);

            expect(StationWiseApprovalService.rejectReallocation).toHaveBeenCalledWith(
                'R001',
                'Not suitable',
                'TTE'
            );
        });

        it('should handle service errors gracefully', async () => {
            req.params.id = 'R001';
            req.body = { reason: 'Invalid', tteId: 'TTE123' };

            StationWiseApprovalService.rejectReallocation.mockRejectedValue(
                new Error('Rejection failed')
            );

            await controller.rejectReallocation(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to reject reallocation',
                error: 'Rejection failed'
            });
        });
    });

    describe('getApprovedReallocations', () => {
        it('should return approved reallocations successfully', async () => {
            const mockApproved = [
                { id: 'R001', status: 'approved', processedAt: new Date() },
                { id: 'R002', status: 'approved', processedAt: new Date() }
            ];

            mockCollection.toArray.mockResolvedValue(mockApproved);

            await controller.getApprovedReallocations(req, res);

            expect(mockCollection.find).toHaveBeenCalledWith({ status: 'approved' });
            expect(mockCollection.sort).toHaveBeenCalledWith({ processedAt: -1 });
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockApproved,
                count: 2
            });
        });

        it('should return empty array if no approved reallocations', async () => {
            mockCollection.toArray.mockResolvedValue([]);

            await controller.getApprovedReallocations(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: [],
                count: 0
            });
        });

        it('should handle database errors gracefully', async () => {
            mockCollection.toArray.mockRejectedValue(new Error('DB connection failed'));

            await controller.getApprovedReallocations(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to get approved reallocations',
                error: 'DB connection failed'
            });
        });
    });

    describe('getStationWiseData', () => {
        it('should return station-wise data successfully', async () => {
            mockTrainState.journeyStarted = true;
            const mockData = {
                currentStation: 'Station B',
                totalStations: 3,
                reallocationsByStation: []
            };

            StationWiseApprovalService.getStationWiseData.mockResolvedValue(mockData);

            await controller.getStationWiseData(req, res);

            expect(StationWiseApprovalService.getStationWiseData).toHaveBeenCalledWith(mockTrainState);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockData
            });
        });

        it('should return 400 if train not initialized', async () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            await controller.getStationWiseData(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Train not initialized'
            });
        });

        it('should return 400 if journey not started', async () => {
            mockTrainState.journeyStarted = false;

            await controller.getStationWiseData(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Journey not started'
            });
        });

        it('should handle service errors gracefully', async () => {
            mockTrainState.journeyStarted = true;
            StationWiseApprovalService.getStationWiseData.mockRejectedValue(
                new Error('Data retrieval failed')
            );

            await controller.getStationWiseData(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Failed to get station-wise data',
                error: 'Data retrieval failed'
            });
        });
    });
});
