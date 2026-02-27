/**
 * passengerController Tests - Comprehensive Coverage
 * Tests for passenger API endpoints
 */

const controller = require('../../controllers/passengerController');
const PassengerService = require('../../services/PassengerService');
const DataService = require('../../services/DataService');
const db = require('../../config/db');
const wsManager = require('../../config/websocket');
const trainController = require('../../controllers/trainController');

jest.mock('../../services/PassengerService');
jest.mock('../../services/DataService');
jest.mock('../../config/db');
jest.mock('../../config/websocket');
jest.mock('../../controllers/trainController');

describe('passengerController - Comprehensive Tests', () => {
    let req, res;
    let mockTrainState;
    let mockPassengersCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockPassengersCollection = {
            findOne: jest.fn(),
            updateOne: jest.fn(),
            insertOne: jest.fn()
        };

        db.getPassengersCollection = jest.fn(() => mockPassengersCollection);
        wsManager.broadcastTrainUpdate = jest.fn();
        wsManager.broadcast = jest.fn();

        mockTrainState = {
            trainNo: '17225',
            trainName: 'Test Express',
            currentStationIdx: 1,
            stations: [
                { code: 'STA', name: 'Station A', idx: 0 },
                { code: 'STB', name: 'Station B', idx: 1 },
                { code: 'STC', name: 'Station C', idx: 2 }
            ],
            coaches: [{ coachNo: 'S1', class: 'SL', berths: [{ berthNo: 15, segmentOccupancy: [null, null, null], updateStatus: jest.fn() }] }],
            racQueue: [],
            stats: { totalPassengers: 10, vacantBerths: 5, totalNoShows: 0 },
            findPassengerByPNR: jest.fn(),
            findPassenger: jest.fn(),
            getAllPassengers: jest.fn(() => []),
            updateStats: jest.fn()
        };

        trainController.getGlobalTrainState = jest.fn(() => mockTrainState);

        req = { params: {}, body: {}, query: {}, user: {}, headers: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    describe('getPNRDetails', () => {
        it('should return PNR details successfully', async () => {
            req.params.pnr = 'P001';
            PassengerService.getPassengerDetails.mockResolvedValue({ pnr: 'P001', name: 'John' });
            await controller.getPNRDetails(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: expect.any(Object) });
        });

        it('should return 400 if PNR not provided', async () => {
            await controller.getPNRDetails(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if PNR not found', async () => {
            req.params.pnr = 'P999';
            PassengerService.getPassengerDetails.mockRejectedValue(new Error('PNR not found'));
            await controller.getPNRDetails(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getPassengerByIRCTC', () => {
        it('should return passenger by IRCTC ID', async () => {
            req.params.irctcId = 'IR_001';
            mockPassengersCollection.findOne.mockResolvedValue({ IRCTC_ID: 'IR_001' });
            await controller.getPassengerByIRCTC(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: expect.any(Object) });
        });

        it('should return 400 if IRCTC ID not provided', async () => {
            await controller.getPassengerByIRCTC(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not found', async () => {
            req.params.irctcId = 'IR_999';
            mockPassengersCollection.findOne.mockResolvedValue(null);
            await controller.getPassengerByIRCTC(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getVacantBerths', () => {
        it('should return vacant berths list', async () => {
            global.trainState = mockTrainState;
            mockTrainState.coaches[0].berths[0].segments = [
                { status: 'vacant' },
                { status: 'vacant' },
                { status: 'occupied' }
            ];

            await controller.getVacantBerths(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        totalVacant: expect.any(Number),
                        vacantBerths: expect.any(Array)
                    })
                })
            );
        });

        it('should return 404 if train not initialized', async () => {
            global.trainState = null;

            await controller.getVacantBerths(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('markNoShow', () => {
        it('should return 400 if PNR not provided', async () => {
            req.body = {};

            await controller.markNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if train not initialized', async () => {
            req.body.pnr = 'P001';
            trainController.getGlobalTrainState.mockReturnValue(null);

            await controller.markNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if PNR not found', async () => {
            req.body.pnr = 'P999';
            mockPassengersCollection.updateOne.mockResolvedValue({ matchedCount: 0 });

            await controller.markNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should mark passenger as no-show', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.updateOne.mockResolvedValue({ matchedCount: 1 });
            const mockPassenger = { pnr: 'P001', noShow: false };
            mockTrainState.findPassengerByPNR.mockReturnValue(mockPassenger);
            mockTrainState.findPassenger.mockReturnValue({
                berth: {
                    removePassenger: jest.fn(),
                    updateStatus: jest.fn()
                }
            });

            await controller.markNoShow(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
            expect(mockPassenger.noShow).toBe(true);
        });

        it('should free up berth when marking no-show', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.updateOne.mockResolvedValue({ matchedCount: 1 });

            const mockBerth = {
                removePassenger: jest.fn(),
                updateStatus: jest.fn()
            };
            mockTrainState.findPassengerByPNR.mockReturnValue({ pnr: 'P001', noShow: false });
            mockTrainState.findPassenger.mockReturnValue({ berth: mockBerth });

            await controller.markNoShow(req, res);

            expect(mockBerth.removePassenger).toHaveBeenCalledWith('P001');
            expect(mockBerth.updateStatus).toHaveBeenCalled();
        });

        it('should broadcast update on no-show', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.updateOne.mockResolvedValue({ matchedCount: 1 });
            mockTrainState.findPassengerByPNR.mockReturnValue({ pnr: 'P001', noShow: false });
            mockTrainState.findPassenger.mockReturnValue(null);

            await controller.markNoShow(req, res);

            expect(wsManager.broadcastTrainUpdate).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.updateOne.mockRejectedValue(new Error('DB error'));

            await controller.markNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors in getPassengerByIRCTC', async () => {
            req.params.irctcId = 'IR_001';
            mockPassengersCollection.findOne.mockRejectedValue(new Error('DB connection error'));

            await controller.getPassengerByIRCTC(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'DB connection error'
                })
            );
        });

        it('should handle PassengerService errors in getPNRDetails', async () => {
            req.params.pnr = 'P001';
            PassengerService.getPassengerDetails.mockRejectedValue(new Error('Service error'));

            await controller.getPNRDetails(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('selfRevertNoShow', () => {
        it('should return 400 if PNR not provided', async () => {
            await controller.selfRevertNoShow(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('subscribeToPush', () => {
        it('should subscribe to push notifications', async () => {
            req.body = { irctcId: 'IR123', subscription: { endpoint: 'https://push.example.com' } };
            const PushSubscriptionService = require('../../services/PushSubscriptionService');
            PushSubscriptionService.saveSubscription = jest.fn().mockResolvedValue(true);

            await controller.subscribeToPush(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should return 400 if fields missing', async () => {
            req.body = { irctcId: 'IR123' };
            await controller.subscribeToPush(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('unsubscribeFromPush', () => {
        it('should unsubscribe from push notifications', async () => {
            req.body = { irctcId: 'IR123', endpoint: 'https://push.example.com' };
            const PushSubscriptionService = require('../../services/PushSubscriptionService');
            PushSubscriptionService.removeSubscription = jest.fn().mockResolvedValue(true);

            await controller.unsubscribeFromPush(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should return 400 if fields missing', async () => {
            req.body = { irctcId: 'IR123' };
            await controller.unsubscribeFromPush(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getAvailableBoardingStations', () => {
        it('should return available boarding stations', async () => {
            req.params.pnr = 'P001';
            mockPassengersCollection.findOne.mockResolvedValue({
                PNR_Number: 'P001',
                Boarding_Station: 'STA',
                boardingStationChanged: false
            });

            await controller.getAvailableBoardingStations(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should return 400 if PNR not provided', async () => {
            await controller.getAvailableBoardingStations(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not found', async () => {
            req.params.pnr = 'P999';
            mockPassengersCollection.findOne.mockResolvedValue(null);
            await controller.getAvailableBoardingStations(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('changeBoardingStation', () => {
        it('should return 400 if fields missing', async () => {
            req.body = { pnr: 'P001' };
            await controller.changeBoardingStation(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('selfCancelTicket', () => {
        it('should return 400 if fields missing', async () => {
            req.body = { pnr: 'P001' };
            await controller.selfCancelTicket(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('selfRevertNoShow', () => {
        it('should return 400 if PNR missing', async () => {
            req.body = {};

            await controller.selfRevertNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if train not initialized', async () => {
            req.body.pnr = 'P001234567';
            trainController.getGlobalTrainState.mockReturnValue(null);

            await controller.selfRevertNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should revert no-show successfully', async () => {
            req.body.pnr = 'P001234567';
            mockTrainState.revertBoardedPassengerNoShow = jest.fn().mockResolvedValue({
                pnr: 'P001234567',
                passenger: { name: 'John' }
            });

            await controller.selfRevertNoShow(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });
    });

    describe('getAllPassengers', () => {
        it('should return all passengers', () => {
            mockTrainState.getAllPassengers.mockReturnValue([
                { pnr: 'P001', name: 'John' },
                { pnr: 'P002', name: 'Jane' }
            ]);

            controller.getAllPassengers(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    total: 2,
                    passengers: expect.any(Array)
                }
            });
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            controller.getAllPassengers(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getPassengerCounts', () => {
        it('should return passenger counts', () => {
            mockTrainState.getAllPassengers.mockReturnValue([
                { pnrStatus: 'CNF', boarded: true, noShow: false },
                { pnrStatus: 'RAC', boarded: false, noShow: false },
                { pnrStatus: 'CNF', boarded: false, noShow: true }
            ]);

            controller.getPassengerCounts(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    total: 3,
                    cnf: expect.any(Number),
                    rac: expect.any(Number)
                })
            });
        });
    });

    describe('getUpgradeNotifications', () => {
        it('should return upgrade notifications', () => {
            req.params.pnr = 'P001234567';
            const UpgradeNotificationService = require('../../services/UpgradeNotificationService');
            UpgradeNotificationService.getPendingNotifications = jest.fn(() => [
                { id: 'N001', status: 'PENDING' }
            ]);

            controller.getUpgradeNotifications(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    pnr: 'P001234567',
                    count: 1,
                    notifications: expect.any(Array)
                }
            });
        });
    });

    describe('getInAppNotifications', () => {
        it('should return notifications', () => {
            req.query.irctcId = 'IR123';
            const InAppNotificationService = require('../../services/InAppNotificationService');
            InAppNotificationService.getNotifications = jest.fn(() => [
                { id: 'N001', type: 'UPGRADE_OFFER' }
            ]);
            InAppNotificationService.getStats = jest.fn(() => ({ total: 1, unread: 1 }));

            controller.getInAppNotifications(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });

        it('should return 400 if irctcId missing', () => {
            controller.getInAppNotifications(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getUnreadCount', () => {
        it('should return unread count', () => {
            req.query.irctcId = 'IR123';
            const InAppNotificationService = require('../../services/InAppNotificationService');
            InAppNotificationService.getUnreadCount = jest.fn(() => 5);

            controller.getUnreadCount(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { count: 5 }
            });
        });
    });

    describe('markNotificationRead', () => {
        it('should mark notification as read', () => {
            req.params.id = 'N001';
            req.body.irctcId = 'IR123';
            const InAppNotificationService = require('../../services/InAppNotificationService');
            InAppNotificationService.markAsRead = jest.fn(() => ({ id: 'N001', read: true }));

            controller.markNotificationRead(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });
    });

    describe('markAllNotificationsRead', () => {
        it('should mark all as read', () => {
            req.body.irctcId = 'IR123';
            const InAppNotificationService = require('../../services/InAppNotificationService');
            InAppNotificationService.markAllAsRead = jest.fn(() => 3);

            controller.markAllNotificationsRead(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining('3')
                })
            );
        });
    });

    describe('subscribeToPush', () => {
        it('should subscribe to push notifications', async () => {
            req.body = { irctcId: 'IR123', subscription: { endpoint: 'https://push.com/123' } };
            const PushSubscriptionService = require('../../services/PushSubscriptionService');
            PushSubscriptionService.addSubscription = jest.fn().mockResolvedValue(true);

            await controller.subscribeToPush(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });

        it('should return 400 if fields missing', async () => {
            req.body = { irctcId: 'IR123' };

            await controller.subscribeToPush(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('unsubscribeFromPush', () => {
        it('should unsubscribe successfully', async () => {
            req.body = { irctcId: 'IR123', endpoint: 'https://push.com/123' };
            const PushSubscriptionService = require('../../services/PushSubscriptionService');
            PushSubscriptionService.removeSubscription = jest.fn().mockResolvedValue(true);

            await controller.unsubscribeFromPush(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });
    });

    describe('getAvailableBoardingStations', () => {
        it('should return 400 if PNR missing', async () => {
            await controller.getAvailableBoardingStations(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not found', async () => {
            req.params.pnr = 'P999';
            mockPassengersCollection.findOne.mockResolvedValue(null);
            trainController.getGlobalTrainState.mockReturnValue(null);

            await controller.getAvailableBoardingStations(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('acceptUpgrade', () => {
        it('should return 400 if fields missing', async () => {
            req.body = { pnr: 'P001234567' };

            await controller.acceptUpgrade(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('denyUpgrade', () => {
        it('should return 400 if fields missing', async () => {
            req.body = { pnr: 'P001234567' };

            await controller.denyUpgrade(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('setPassengerStatus', () => {
        it('should return 400 for invalid status', async () => {
            req.body = { pnr: 'P001234567', status: 'invalid' };

            await controller.setPassengerStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not found', async () => {
            req.body = { pnr: 'P999', status: 'online' };
            mockTrainState.findPassenger.mockReturnValue(null);

            await controller.setPassengerStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });
});

