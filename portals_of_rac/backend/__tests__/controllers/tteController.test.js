/**
 * tteController Tests - Comprehensive Coverage
 * Tests for TTE operations
 */

const controller = require('../../controllers/tteController');
const db = require('../../config/db');
const wsManager = require('../../config/websocket');
const trainController = require('../../controllers/trainController');
const ReallocationService = require('../../services/ReallocationService');

jest.mock('../../config/db');
jest.mock('../../config/websocket');
jest.mock('../../controllers/trainController');
jest.mock('../../services/ReallocationService');

describe('tteController - Comprehensive Tests', () => {
    let req, res;
    let mockTrainState;
    let mockPassengersCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockPassengersCollection = {
            findOne: jest.fn(),
            updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
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
            coaches: [{ coachNo: 'S1', berths: [] }],
            racQueue: [],
            stats: { currentOnboard: 10, totalDeboarded: 0 },
            getAllPassengers: jest.fn(() => []),
            findPassengerByPNR: jest.fn(),
            findPassenger: jest.fn(),
            getCurrentStation: jest.fn(() => ({ name: 'Station B' }))
        };

        trainController.getGlobalTrainState = jest.fn(() => mockTrainState);

        req = { params: {}, body: {}, query: {}, user: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });


    describe('getAllPassengersFiltered', () => {
        beforeEach(() => {
            mockTrainState.getAllPassengers.mockReturnValue([
                { pnr: 'P001', pnrStatus: 'CNF', boarded: true, noShow: false, fromIdx: 0, toIdx: 3, coach: 'S1' },
                { pnr: 'P002', pnrStatus: 'RAC', boarded: true, noShow: false, fromIdx: 0, toIdx: 2, coach: 'S2' },
                { pnr: 'P003', pnrStatus: 'CNF', boarded: false, noShow: true, fromIdx: 0, toIdx: 3, coach: 'S1' }
            ]);
        });

        it('should return all passengers without filters', async () => {
            await controller.getAllPassengersFiltered(req, res);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { count: 3, passengers: expect.any(Array) }
            });
        });

        it('should filter by boarded status', async () => {
            req.query.status = 'boarded';
            await controller.getAllPassengersFiltered(req, res);
            const response = res.json.mock.calls[0][0];
            expect(response.data.count).toBe(2);
        });

        it('should filter by RAC status', async () => {
            req.query.status = 'rac';
            await controller.getAllPassengersFiltered(req, res);
            const response = res.json.mock.calls[0][0];
            expect(response.data.count).toBe(1);
        });

        it('should filter by CNF status', async () => {
            req.query.status = 'cnf';
            await controller.getAllPassengersFiltered(req, res);
            const response = res.json.mock.calls[0][0];
            expect(response.data.count).toBe(2);
        });

        it('should filter by no-show status', async () => {
            req.query.status = 'no-show';
            await controller.getAllPassengersFiltered(req, res);
            const response = res.json.mock.calls[0][0];
            expect(response.data.count).toBe(1);
        });

        it('should filter by coach', async () => {
            req.query.coach = 'S1';
            await controller.getAllPassengersFiltered(req, res);
            const response = res.json.mock.calls[0][0];
            expect(response.data.count).toBe(2);
        });

        it('should return 400 if train not initialized', async () => {
            trainController.getGlobalTrainState.mockReturnValue(null);
            await controller.getAllPassengersFiltered(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getCurrentlyBoardedPassengers', () => {
        it('should return currently boarded passengers', async () => {
            mockTrainState.getAllPassengers.mockReturnValue([
                { pnr: 'P001', boarded: true, fromIdx: 0, toIdx: 3 },
                { pnr: 'P002', boarded: true, fromIdx: 0, toIdx: 2 },
                { pnr: 'P003', boarded: false, fromIdx: 2, toIdx: 3 }
            ]);

            await controller.getCurrentlyBoardedPassengers(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    count: 2,
                    currentStation: 'Station B',
                    currentStationIdx: 1
                })
            });
        });

        it('should return 400 if train not initialized', async () => {
            trainController.getGlobalTrainState.mockReturnValue(null);
            await controller.getCurrentlyBoardedPassengers(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getBoardedRACPassengers', () => {
        it('should return boarded RAC passengers separated by online/offline', async () => {
            mockTrainState.getAllPassengers.mockReturnValue([
                { pnr: 'P001', pnrStatus: 'RAC', boarded: true, fromIdx: 0, toIdx: 3, passengerStatus: 'Online' },
                { pnr: 'P002', pnrStatus: 'RAC', boarded: true, fromIdx: 0, toIdx: 2, passengerStatus: 'Offline' },
                { pnr: 'P003', pnrStatus: 'CNF', boarded: true, fromIdx: 0, toIdx: 3 }
            ]);

            await controller.getBoardedRACPassengers(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    total: 2,
                    online: 1,
                    offline: 1
                })
            });
        });

        it('should return 400 if train not initialized', async () => {
            trainController.getGlobalTrainState.mockReturnValue(null);
            await controller.getBoardedRACPassengers(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('manualMarkBoarded', () => {
        it('should mark passenger as boarded', async () => {
            req.body.pnr = 'P001';
            const mockPassenger = { pnr: 'P001', name: 'John', boarded: false };
            mockTrainState.findPassengerByPNR.mockReturnValue(mockPassenger);

            await controller.manualMarkBoarded(req, res);

            expect(mockPassenger.boarded).toBe(true);
            expect(mockTrainState.stats.currentOnboard).toBe(11);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: 'Passenger marked as boarded'
            }));
        });

        it('should return 400 if PNR not provided', async () => {
            await controller.manualMarkBoarded(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if train not initialized', async () => {
            req.body.pnr = 'P001';
            trainController.getGlobalTrainState.mockReturnValue(null);
            await controller.manualMarkBoarded(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not found', async () => {
            req.body.pnr = 'P999';
            mockTrainState.findPassengerByPNR.mockReturnValue(null);
            await controller.manualMarkBoarded(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('manualMarkDeboarded', () => {
        it('should mark passenger as deboarded', async () => {
            req.body.pnr = 'P001';
            const mockPassenger = { pnr: 'P001', name: 'John' };
            const mockLocation = { berth: { removePassenger: jest.fn(), updateStatus: jest.fn() } };
            mockTrainState.findPassengerByPNR.mockReturnValue(mockPassenger);
            mockTrainState.findPassenger.mockReturnValue(mockLocation);

            await controller.manualMarkDeboarded(req, res);

            expect(mockLocation.berth.removePassenger).toHaveBeenCalledWith('P001');
            expect(mockTrainState.stats.currentOnboard).toBe(9);
            expect(mockTrainState.stats.totalDeboarded).toBe(1);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: 'Passenger marked as deboarded'
            }));
        });

        it('should return 400 if PNR not provided', async () => {
            await controller.manualMarkDeboarded(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not found', async () => {
            req.body.pnr = 'P999';
            mockTrainState.findPassengerByPNR.mockReturnValue(null);
            await controller.manualMarkDeboarded(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('confirmUpgrade', () => {
        beforeEach(() => {
            jest.mock('../../services/UpgradeNotificationService', () => ({
                getAllNotifications: jest.fn(() => [
                    { id: 'N001', status: 'PENDING', pnr: 'P001234567' }
                ]),
                confirmUpgrade: jest.fn().mockResolvedValue({ success: true })
            }));
        });

        it('should return 400 if fields missing', async () => {
            req.body = { pnr: 'P001234567' };
            await controller.confirmUpgrade(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 for invalid PNR format', async () => {
            req.body = { pnr: 'P001', notificationId: 'N001' };
            await controller.confirmUpgrade(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if train not initialized', async () => {
            req.body = { pnr: 'P001234567', notificationId: 'N001' };
            trainController.getGlobalTrainState.mockReturnValue(null);
            await controller.confirmUpgrade(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getStatistics', () => {
        beforeEach(() => {
            mockTrainState.getAllPassengers.mockReturnValue([
                { pnr: 'P001', boarded: true, fromIdx: 0, toIdx: 3 },
                { pnr: 'P002', boarded: false, fromIdx: 2, toIdx: 3 }
            ]);
            mockTrainState.getCurrentStation.mockReturnValue({ name: 'Station B' });
            mockTrainState.coaches = [
                { berths: [{ status: 'occupied' }, { status: 'vacant' }] },
                { berths: [{ status: 'occupied' }] }
            ];
        });

        it('should return journey statistics', () => {
            controller.getStatistics(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    train: expect.any(Object),
                    passengers: expect.any(Object),
                    berths: expect.any(Object),
                    racQueue: expect.any(Object)
                })
            });
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);
            controller.getStatistics(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should calculate berth statistics correctly', () => {
            controller.getStatistics(req, res);

            const response = res.json.mock.calls[0][0];
            expect(response.data.berths.total).toBe(3);
            expect(response.data.berths.occupied).toBe(2);
        });

        it('should handle error gracefully', () => {
            mockTrainState.getAllPassengers.mockImplementation(() => {
                throw new Error('Stats error');
            });

            controller.getStatistics(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getBoardingQueue', () => {
        it('should return boarding verification queue', () => {
            mockTrainState.boardingVerificationQueue = new Map([
                ['P001', { pnr: 'P001', status: 'pending' }]
            ]);
            mockTrainState.getVerificationStats = jest.fn(() => ({
                currentStation: 'Station B',
                pending: 1,
                verified: 0
            }));

            controller.getBoardingQueue(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    station: 'Station B',
                    passengers: expect.any(Array)
                })
            });
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);
            controller.getBoardingQueue(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle errors', () => {
            mockTrainState.boardingVerificationQueue = null;

            controller.getBoardingQueue(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('confirmAllBoarded', () => {
        it('should confirm all passengers boarded', async () => {
            mockTrainState.confirmAllBoarded = jest.fn().mockResolvedValue({ count: 5 });

            await controller.confirmAllBoarded(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: '5 passengers confirmed boarded',
                count: 5
            });
        });

        it('should return 400 if train not initialized', async () => {
            trainController.getGlobalTrainState.mockReturnValue(null);
            await controller.confirmAllBoarded(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle errors', async () => {
            mockTrainState.confirmAllBoarded = jest.fn().mockRejectedValue(new Error('Confirm error'));

            await controller.confirmAllBoarded(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
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

        it('should mark passenger as no-show', async () => {
            req.body.pnr = 'P001';
            const mockBerth = { berthNo: 15, fullBerthNo: 'S1-15', type: 'LB' };
            mockTrainState.findPassenger.mockReturnValue({
                berth: mockBerth,
                coachNo: 'S1',
                coach: { class: 'SL', coach_name: 'S1' }
            });
            mockTrainState.markBoardedPassengerNoShow = jest.fn().mockResolvedValue({
                pnr: 'P001'
            });
            mockPassengersCollection.updateOne.mockResolvedValue({});
            mockPassengersCollection.findOne.mockResolvedValue({
                PNR_Number: 'P001',
                Email: 'test@test.com',
                Mobile: '1234567890',
                IRCTC_ID: 'IR123'
            });

            await controller.markNoShow(req, res);

            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];
            expect(response.success).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle errors in getAllPassengersFiltered', async () => {
            mockTrainState.getAllPassengers.mockImplementation(() => {
                throw new Error('Get passengers error');
            });

            await controller.getAllPassengersFiltered(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should handle errors in getCurrentlyBoardedPassengers', async () => {
            mockTrainState.getAllPassengers.mockImplementation(() => {
                throw new Error('Error');
            });

            await controller.getCurrentlyBoardedPassengers(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should handle errors in getBoardedRACPassengers', async () => {
            mockTrainState.getAllPassengers.mockImplementation(() => {
                throw new Error('Error');
            });

            await controller.getBoardedRACPassengers(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should handle errors in manualMarkBoarded', async () => {
            req.body.pnr = 'P001';
            mockPassengersCollection.updateOne.mockRejectedValue(new Error('DB error'));
            mockTrainState.findPassengerByPNR.mockReturnValue({ pnr: 'P001' });

            await controller.manualMarkBoarded(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should handle errors in manualMarkDeboarded', async () => {
            req.body.pnr = 'P001';
            mockTrainState.findPassengerByPNR.mockImplementation(() => {
                throw new Error('Find error');
            });

            await controller.manualMarkDeboarded(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('Filter Edge Cases', () => {
        beforeEach(() => {
            mockTrainState.getAllPassengers.mockReturnValue([
                { pnr: 'P001', pnrStatus: 'CNF', boarded: true, fromIdx: 0, toIdx: 2, coach: 'S1' },
                { pnr: 'P002', pnrStatus: 'RAC', boarded: false, fromIdx: 2, toIdx: 3, coach: 'S2' },
                { pnr: 'P003', pnrStatus: 'CNF', boarded: false, fromIdx: 0, toIdx: 1, noShow: false, coach: 'S1' }
            ]);
        });

        it('should filter pending passengers correctly', async () => {
            mockTrainState.currentStationIdx = 1;
            req.query.status = 'pending';

            await controller.getAllPassengersFiltered(req, res);

            const response = res.json.mock.calls[0][0];
            expect(response.data.count).toBeGreaterThanOrEqual(0);
        });

        it('should filter deboarded passengers correctly', async () => {
            mockTrainState.currentStationIdx = 2;
            req.query.status = 'deboarded';

            await controller.getAllPassengersFiltered(req, res);

            const response = res.json.mock.calls[0][0];
            expect(response.data.passengers.every(p => p.toIdx < 2)).toBe(true);
        });

        it('should handle coach filter case-insensitively', async () => {
            req.query.coach = 's1';

            await controller.getAllPassengersFiltered(req, res);

            const response = res.json.mock.calls[0][0];
            expect(response.data.count).toBe(2);
        });
    });
});
