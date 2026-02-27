/**
 * tteController MEGA TEST - Comprehensive expansion to reach 70% coverage
 * Covers: revertNoShow, getActionHistory, undoAction, getUpgradedPassengers
 */

const controller = require('../../controllers/tteController');
const db = require('../../config/db');
const wsManager = require('../../config/websocket');
const trainController = require('../../controllers/trainController');

jest.mock('../../config/db');
jest.mock('../../config/websocket');
jest.mock('../../controllers/trainController');

describe('tteController - MEGA Coverage Tests', () => {
    let req, res, mockTrainState, mockPassengersCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockPassengersCollection = {
            findOne: jest.fn(),
            updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
            find: jest.fn(() => ({
                toArray: jest.fn().mockResolvedValue([])
            }))
        };

        db.getPassengersCollection = jest.fn(() => mockPassengersCollection);
        db.getConfig = jest.fn(() => ({
            passengersDb: 'test_db',
            passengersCollection: 'test_collection'
        }));

        wsManager.broadcastTrainUpdate = jest.fn();

        mockTrainState = {
            trainNo: '17225',
            currentStationIdx: 1,
            stations: [
                { code: 'STA', name: 'Station A', idx: 0 },
                { code: 'STB', name: 'Station B', idx: 1 }
            ],
            revertBoardedPassengerNoShow: jest.fn().mockResolvedValue({
                pnr: 'P001',
                passenger: { pnr: 'P001', name: 'John' }
            }),
            getActionHistory: jest.fn().mockReturnValue([
                { id: 'A001', type: 'APPLY_UPGRADE', timestamp: new Date() }
            ]),
            undoLastAction: jest.fn().mockResolvedValue({
                action: { id: 'A001', type: 'APPLY_UPGRADE' }
            })
        };

        trainController.getGlobalTrainState = jest.fn(() => mockTrainState);

        req = { params: {}, body: {}, query: {}, user: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    describe('revertNoShow', () => {
        it('should revert no-show status successfully', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.findOne.mockResolvedValue({
                PNR_Number: 'P001',
                NO_show_timestamp: new Date(Date.now() - 10 * 60 * 1000)
            });

            await controller.revertNoShow(req, res);

            expect(mockTrainState.revertBoardedPassengerNoShow).toHaveBeenCalledWith('P001');
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });

        it('should return 400 if PNR not provided', async () => {
            req.body = {};

            await controller.revertNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if train not initialized', async () => {
            req.body.pnr = 'P001';
            trainController.getGlobalTrainState.mockReturnValue(null);

            await controller.revertNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 403 if 30-minute window expired', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.findOne.mockResolvedValue({
                PNR_Number: 'P001',
                NO_show_timestamp: new Date(Date.now() - 35 * 60 * 1000)
            });

            await controller.revertNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should return 404 if passenger not found in DB', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.findOne.mockResolvedValue(null);

            await controller.revertNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should handle "not marked as NO-SHOW" error', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.findOne.mockResolvedValue({ PNR_Number: 'P001' });
            mockTrainState.revertBoardedPassengerNoShow.mockRejectedValue(
                new Error('Passenger is not marked as NO-SHOW')
            );

            await controller.revertNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle "Cannot revert" conflict error', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.findOne.mockResolvedValue({ PNR_Number: 'P001' });
            mockTrainState.revertBoardedPassengerNoShow.mockRejectedValue(
                new Error('Cannot revert - berth occupied')
            );

            await controller.revertNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
        });
    });

    describe('getActionHistory', () => {
        it('should return action history', async () => {
            await controller.getActionHistory(req, res);

            expect(mockTrainState.getActionHistory).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.any(Array)
            });
        });

        it('should return 400 if train not initialized', async () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            await controller.getActionHistory(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle errors', async () => {
            mockTrainState.getActionHistory.mockImplementation(() => {
                throw new Error('History error');
            });

            await controller.getActionHistory(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('undoAction', () => {
        it('should undo action successfully', async () => {
            req.body.actionId = 'A001';

            await controller.undoAction(req, res);

            expect(mockTrainState.undoLastAction).toHaveBeenCalledWith('A001');
            expect(wsManager.broadcastTrainUpdate).toHaveBeenCalledWith(
                'ACTION_UNDONE',
                expect.any(Object)
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });

        it('should return 400 if actionId missing', async () => {
            req.body = {};

            await controller.undoAction(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if train not initialized', async () => {
            req.body.actionId = 'A001';
            trainController.getGlobalTrainState.mockReturnValue(null);

            await controller.undoAction(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 for "Action not found" error', async () => {
            req.body.actionId = 'A999';
            mockTrainState.undoLastAction.mockRejectedValue(
                new Error('Action not found')
            );

            await controller.undoAction(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'ACTION_NOT_FOUND' })
            );
        });

        it('should return 409 for "already undone" error', async () => {
            req.body.actionId = 'A001';
            mockTrainState.undoLastAction.mockRejectedValue(
                new Error('Action already undone')
            );

            await controller.undoAction(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'ACTION_ALREADY_UNDONE' })
            );
        });

        it('should return 410 for "too old to undo" error', async () => {
            req.body.actionId = 'A001';
            mockTrainState.undoLastAction.mockRejectedValue(
                new Error('Action too old to undo')
            );

            await controller.undoAction(req, res);

            expect(res.status).toHaveBeenCalledWith(410);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'ACTION_EXPIRED' })
            );
        });

        it('should return 409 for station mismatch error', async () => {
            req.body.actionId = 'A001';
            mockTrainState.undoLastAction.mockRejectedValue(
                new Error('Cannot undo actions from previous stations')
            );

            await controller.undoAction(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'STATION_MISMATCH' })
            );
        });

        it('should return 409 for berth collision error', async () => {
            req.body.actionId = 'A001';
            mockTrainState.undoLastAction.mockRejectedValue(
                new Error('Cannot undo - berth is now occupied')
            );

            await controller.undoAction(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'BERTH_COLLISION' })
            );
        });

        it('should return 400 for unknown action type error', async () => {
            req.body.actionId = 'A001';
            mockTrainState.undoLastAction.mockRejectedValue(
                new Error('Unknown action type')
            );

            await controller.undoAction(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'UNKNOWN_ACTION_TYPE' })
            );
        });
    });

    describe('getUpgradedPassengers', () => {
        it('should return upgraded passengers from MongoDB', async () => {
            mockPassengersCollection.find.mockReturnValue({
                toArray: jest.fn().mockResolvedValue([
                    {
                        PNR_Number: 'P001',
                        Name: 'John',
                        Age: 30,
                        Upgraded_From: 'RAC'
                    }
                ])
            });

            await controller.getUpgradedPassengers(req, res);

            expect(mockPassengersCollection.find).toHaveBeenCalledWith({
                Upgraded_From: 'RAC'
            });
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    count: 1,
                    passengers: expect.any(Array)
                })
            });
        });

        it('should handle database errors', async () => {
            mockPassengersCollection.find.mockReturnValue({
                toArray: jest.fn().mockRejectedValue(new Error('DB error'))
            });

            await controller.getUpgradedPassengers(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('addOfflineUpgrade', () => {
        beforeEach(() => {
            controller.offlineUpgradesQueue = [];
            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC Pass 1', pnrStatus: 'RAC', from: 'STA', to: 'STB' }
            ];
        });

        it('should add passenger to offline upgrade queue', async () => {
            req.body = {
                pnr: 'R001',
                berthDetails: { coach: 'S1', berthNo: 15, type: 'Lower' }
            };

            await controller.addOfflineUpgrade(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining('Added')
                })
            );
            expect(controller.offlineUpgradesQueue).toHaveLength(1);
        });

        it('should return 400 if fields missing', async () => {
            req.body = { pnr: 'R001' };

            await controller.addOfflineUpgrade(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not in RAC queue', async () => {
            req.body = {
                pnr: 'R999',
                berthDetails: { coach: 'S1', berthNo: 15 }
            };

            await controller.addOfflineUpgrade(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should update existing entry if already in queue', async () => {
            req.body = {
                pnr: 'R001',
                berthDetails: { coach: 'S1', berthNo: 15 }
            };

            await controller.addOfflineUpgrade(req, res);
            await controller.addOfflineUpgrade(req, res);

            expect(controller.offlineUpgradesQueue).toHaveLength(1);
        });
    });

    describe('getOfflineUpgrades', () => {
        beforeEach(() => {
            controller.offlineUpgradesQueue = [
                { id: 'O1', pnr: 'R001', status: 'pending' },
                { id: 'O2', pnr: 'R002', status: 'confirmed' },
                { id: 'O3', pnr: 'R003', status: 'pending' }
            ];
        });

        it('should return only pending offline upgrades', async () => {
            await controller.getOfflineUpgrades(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    total: 2,
                    upgrades: expect.arrayContaining([
                        expect.objectContaining({ status: 'pending' })
                    ])
                }
            });
        });

        it('should handle errors', async () => {
            controller.offlineUpgradesQueue = null;

            await controller.getOfflineUpgrades(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('confirmOfflineUpgrade', () => {
        beforeEach(() => {
            controller.offlineUpgradesQueue = [
                { id: 'O1', pnr: 'R001', status: 'pending', coach: 'S1', berthNo: 15, passengerName: 'John' }
            ];
            const ReallocationService = require('../../services/ReallocationService');
            ReallocationService.upgradeRACPassengerWithCoPassenger = jest.fn().mockResolvedValue({
                success: true
            });
        });

        it('should confirm offline upgrade successfully', async () => {
            req.body.upgradeId = 'O1';

            await controller.confirmOfflineUpgrade(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
            expect(controller.offlineUpgradesQueue[0].status).toBe('confirmed');
        });

        it('should return 400 if upgradeId missing', async () => {
            req.body = {};

            await controller.confirmOfflineUpgrade(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if upgrade not found', async () => {
            req.body.upgradeId = 'O999';

            await controller.confirmOfflineUpgrade(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('rejectOfflineUpgrade', () => {
        beforeEach(() => {
            controller.offlineUpgradesQueue = [
                { id: 'O1', pnr: 'R001', status: 'pending', passengerName: 'John' }
            ];
        });

        it('should reject offline upgrade successfully', async () => {
            req.body.upgradeId = 'O1';

            await controller.rejectOfflineUpgrade(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
            expect(controller.offlineUpgradesQueue[0].status).toBe('rejected');
        });

        it('should return 404 if upgrade not found', async () => {
            req.body.upgradeId = 'O999';

            await controller.rejectOfflineUpgrade(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getSentUpgradeOffers', () => {
        it('should return sent upgrade offers with stats', () => {
            const UpgradeNotificationService = require('../../services/UpgradeNotificationService');
            UpgradeNotificationService.getAllSentNotifications = jest.fn(() => [
                { id: 'N1', status: 'pending' },
                { id: 'N2', status: 'accepted' },
                { id: 'N3', status: 'denied' }
            ]);

            controller.getSentUpgradeOffers(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.any(Array),
                count: 3,
                stats: {
                    total: 3,
                    pending: 1,
                    accepted: 1,
                    denied: 1
                }
            });
        });

        it('should handle errors', () => {
            const UpgradeNotificationService = require('../../services/UpgradeNotificationService');
            UpgradeNotificationService.getAllSentNotifications = jest.fn(() => {
                throw new Error('Service error');
            });

            controller.getSentUpgradeOffers(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
