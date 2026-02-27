/**
 * reallocationController Tests
 * Tests based on ACTUAL implementation
 * Controller handles RAC reallocation logic
 */

// Mock dependencies BEFORE requiring controller
jest.mock('../../services/ReallocationService');
jest.mock('../../services/ValidationService');
jest.mock('../../services/NotificationService');
jest.mock('../../services/InAppNotificationService');
jest.mock('../../services/WebPushService');
jest.mock('../../services/PushNotificationService');
jest.mock('../../config/db');
jest.mock('../../config/websocket', () => ({
    broadcastNoShow: jest.fn(),
    broadcastStatsUpdate: jest.fn(),
    broadcastRACReallocation: jest.fn()
}));
jest.mock('../../controllers/trainController', () => ({
    getGlobalTrainState: jest.fn()
}));

const reallocationController = require('../../controllers/reallocationController');
const ReallocationService = require('../../services/ReallocationService');
const ValidationService = require('../../services/ValidationService');
const trainController = require('../../controllers/trainController');
const db = require('../../config/db');

describe('reallocationController', () => {
    let req, res;
    let mockTrainState;

    beforeEach(() => {
        // Reset request and response objects
        req = {
            body: {},
            params: {},
            query: {}
        };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        // Mock train state object
        mockTrainState = {
            trainNo: '17225',
            currentStationIdx: 1,
            stations: [
                { code: 'BZA', name: 'Vijayawada', idx: 0 },
                { code: 'RJY', name: 'Rajahmundry', idx: 1 },
                { code: 'VZM', name: 'Vizianagaram', idx: 2 }
            ],
            racQueue: [
                { pnr: 'PNR001', name: 'Passenger 1', racStatus: 'RAC1' },
                { pnr: 'PNR002', name: 'Passenger 2', racStatus: 'RAC2' }
            ],
            stats: {
                totalPassengers: 150,
                cnfPassengers: 120,
                racPassengers: 30
            },
            getCurrentStation: jest.fn().mockReturnValue({ code: 'RJY', name: 'Rajahmundry', idx: 1 }),
            findPassenger: jest.fn()
        };

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('markPassengerNoShow', () => {
        beforeEach(() => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
        });

        it('should mark passenger as no-show successfully', async () => {
            req.body = { pnr: '1234567890' };

            const mockLocation = {
                berth: { berthNo: 10, fullBerthNo: 'S1-10', type: 'Lower' },
                coachNo: 'S1',
                coach: { class: 'SL', coach_name: 'S1' }
            };

            const mockPassenger = {
                pnr: '1234567890',
                name: 'Test Passenger',
                coach: 'S1',
                berth: 10
            };

            mockTrainState.findPassenger.mockReturnValue(mockLocation);
            ValidationService.validatePNR.mockReturnValue({ valid: true });
            ReallocationService.markNoShow.mockResolvedValue({ passenger: mockPassenger });
            ReallocationService.processVacancyForUpgrade.mockResolvedValue({ offersCreated: 1 });
            
            db.getPassengersCollection.mockReturnValue({
                findOne: jest.fn().mockResolvedValue({
                    Email: 'test@example.com',
                    Mobile: '9876543210',
                    IRCTC_ID: 'TEST123'
                })
            });

            await reallocationController.markPassengerNoShow(req, res);

            expect(ValidationService.validatePNR).toHaveBeenCalledWith('1234567890');
            expect(ReallocationService.markNoShow).toHaveBeenCalledWith(mockTrainState, '1234567890');
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining('marked as no-show')
                })
            );
        });

        it('should return 400 if PNR is missing', async () => {
            req.body = {};

            await reallocationController.markPassengerNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'PNR is required'
                })
            );
        });

        it('should return 400 if PNR format is invalid', async () => {
            req.body = { pnr: '123' }; // Too short

            await reallocationController.markPassengerNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('Invalid PNR format')
                })
            );
        });

        it('should return 400 if PNR validation fails', async () => {
            req.body = { pnr: '1234567890' };
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
            ValidationService.validatePNR.mockReturnValue({ valid: false, reason: 'Invalid PNR' });

            await reallocationController.markPassengerNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Invalid PNR'
                })
            );
        });

        it('should return 400 if train not initialized', async () => {
            req.body = { pnr: '1234567890' };
            ValidationService.validatePNR.mockReturnValue({ valid: true }); // Pass validation first
            trainController.getGlobalTrainState.mockReturnValue(null);

            await reallocationController.markPassengerNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Train not initialized'
                })
            );
        });

        it('should handle passenger not found error', async () => {
            req.body = { pnr: '1234567890' };
            ValidationService.validatePNR.mockReturnValue({ valid: true });
            ReallocationService.markNoShow.mockRejectedValue(new Error('Passenger not found'));

            await reallocationController.markPassengerNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Passenger not found'
                })
            );
        });
    });

    describe('getRACQueue', () => {
        beforeEach(() => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
        });

        it('should return RAC queue successfully', () => {
            const mockRACQueue = [
                { pnr: 'PNR001', name: 'Passenger 1', racStatus: 'RAC1' },
                { pnr: 'PNR002', name: 'Passenger 2', racStatus: 'RAC2' }
            ];

            ReallocationService.getRACQueue.mockReturnValue(mockRACQueue);

            reallocationController.getRACQueue(req, res);

            expect(ReallocationService.getRACQueue).toHaveBeenCalledWith(mockTrainState);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        total: 2,
                        queue: mockRACQueue
                    })
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            reallocationController.getRACQueue(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle empty RAC queue', () => {
            ReallocationService.getRACQueue.mockReturnValue([]);

            reallocationController.getRACQueue(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        total: 0,
                        queue: []
                    })
                })
            );
        });
    });

    describe('getVacantBerths', () => {
        beforeEach(() => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
        });

        it('should return vacant berths with station details', () => {
            const mockVacancies = [
                {
                    coach: 'S1',
                    berthNo: 10,
                    berth: 'S1-10',
                    type: 'Lower',
                    class: 'SL',
                    vacantFrom: 'BZA',
                    vacantTo: 'VZM',
                    fromIdx: 0,
                    toIdx: 2,
                    duration: 2
                }
            ];

            ReallocationService.getVacantBerths.mockReturnValue(mockVacancies);

            reallocationController.getVacantBerths(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        total: 1,
                        vacancies: expect.any(Array)
                    })
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            reallocationController.getVacantBerths(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should enhance vacancies with station names', () => {
            const mockVacancies = [
                {
                    coach: 'S1',
                    berthNo: 10,
                    berth: 'S1-10',
                    type: 'Lower',
                    class: 'SL',
                    vacantFrom: 'BZA',
                    vacantTo: 'VZM',
                    fromIdx: 0,
                    toIdx: 2,
                    duration: 2
                }
            ];

            ReallocationService.getVacantBerths.mockReturnValue(mockVacancies);

            reallocationController.getVacantBerths(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.data.vacancies[0]).toHaveProperty('vacantFromStation', 'Vijayawada');
            expect(call.data.vacancies[0]).toHaveProperty('vacantToStation', 'Vizianagaram');
        });

        it('should handle errors gracefully', () => {
            ReallocationService.getVacantBerths.mockImplementation(() => {
                throw new Error('Database error');
            });

            reallocationController.getVacantBerths(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('searchPassenger', () => {
        beforeEach(() => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
        });

        it('should find passenger by PNR', () => {
            req.params = { pnr: '1234567890' };
            const mockPassenger = {
                pnr: '1234567890',
                name: 'Test Passenger',
                status: 'CNF'
            };

            ReallocationService.searchPassenger.mockReturnValue(mockPassenger);

            reallocationController.searchPassenger(req, res);

            expect(ReallocationService.searchPassenger).toHaveBeenCalledWith(mockTrainState, '1234567890');
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: mockPassenger
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            req.params = { pnr: '1234567890' };
            trainController.getGlobalTrainState.mockReturnValue(null);

            reallocationController.searchPassenger(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not found', () => {
            req.params = { pnr: 'INVALID' };
            ReallocationService.searchPassenger.mockImplementation(() => {
                throw new Error('Passenger not found');
            });

            reallocationController.searchPassenger(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getStage1Eligible', () => {
        beforeEach(() => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
        });

        it('should return stage 1 eligibility matrix', () => {
            const mockMatrix = [
                { berth: 'S1-10', eligiblePassengers: ['PNR001', 'PNR002'] },
                { berth: 'S1-11', eligiblePassengers: ['PNR003'] }
            ];

            ReallocationService.getStage1Eligible.mockReturnValue(mockMatrix);

            reallocationController.getStage1Eligible(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        stage1Matrix: mockMatrix,
                        totalVacantBerths: 2
                    })
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            reallocationController.getStage1Eligible(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getStage2Results', () => {
        beforeEach(() => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
        });

        it('should return stage 2 results for berth', () => {
            req.query = { coach: 'S1', berthNo: '10' };
            const mockResults = {
                online: ['PNR001'],
                offline: ['PNR002'],
                notEligible: ['PNR003']
            };

            ReallocationService.getStage2Results.mockReturnValue(mockResults);

            reallocationController.getStage2Results(req, res);

            expect(ReallocationService.getStage2Results).toHaveBeenCalledWith(
                mockTrainState,
                { coach: 'S1', berthNo: '10' }
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: mockResults
                })
            );
        });

        it('should return 400 if coach is missing', () => {
            req.query = { berthNo: '10' };

            reallocationController.getStage2Results(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('required')
                })
            );
        });

        it('should return 400 if berthNo is missing', () => {
            req.query = { coach: 'S1' };

            reallocationController.getStage2Results(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getEligibilityMatrix', () => {
        beforeEach(() => {
            mockTrainState.racQueue = [
                { pnr: 'PNR001', pnrStatus: 'RAC', passengerStatus: 'Online', boarded: true },
                { pnr: 'PNR002', pnrStatus: 'RAC', passengerStatus: 'Online', boarded: true }
            ];
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
        });

        it('should return complete eligibility matrix', () => {
            const mockMatrix = [
                { berth: 'S1-10', eligibleCount: 2 },
                { berth: 'S1-11', eligibleCount: 1 }
            ];

            ReallocationService.getEligibilityMatrix.mockReturnValue(mockMatrix);

            reallocationController.getEligibilityMatrix(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        eligibility: mockMatrix,
                        summary: expect.objectContaining({
                            totalVacantBerths: 2,
                            totalBoardedRAC: 2
                        })
                    })
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            reallocationController.getEligibilityMatrix(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should calculate vacancy summary correctly', () => {
            const mockMatrix = [
                { berth: 'S1-10', eligibleCount: 2 },
                { berth: 'S1-11', eligibleCount: 0 },
                { berth: 'S1-12', eligibleCount: 1 }
            ];

            ReallocationService.getEligibilityMatrix.mockReturnValue(mockMatrix);

            reallocationController.getEligibilityMatrix(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.data.summary.totalVacantBerths).toBe(3);
            expect(call.data.summary.vacanciesWithEligible).toBe(2);
            expect(call.data.summary.vacanciesWithoutEligible).toBe(1);
        });
    });

    describe('applyReallocation', () => {
        beforeEach(() => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
        });

        it('should apply reallocations successfully', () => {
            req.body = {
                allocations: [
                    { pnr: 'PNR001', coach: 'S1', berth: 10 },
                    { pnr: 'PNR002', coach: 'S1', berth: 11 }
                ]
            };

            const mockResults = {
                success: [
                    { pnr: 'PNR001', allocated: true },
                    { pnr: 'PNR002', allocated: true }
                ],
                failed: []
            };

            ReallocationService.applyReallocation.mockReturnValue(mockResults);

            reallocationController.applyReallocation(req, res);

            expect(ReallocationService.applyReallocation).toHaveBeenCalledWith(
                mockTrainState,
                req.body.allocations
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining('2 reallocations')
                })
            );
        });

        it('should return 400 if allocations array is missing', () => {
            req.body = {};

            reallocationController.applyReallocation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Allocations array is required'
                })
            );
        });

        it('should return 400 if allocations is not an array', () => {
            req.body = { allocations: 'invalid' };

            reallocationController.applyReallocation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle partial failures', () => {
            req.body = {
                allocations: [
                    { pnr: 'PNR001', coach: 'S1', berth: 10 },
                    { pnr: 'INVALID', coach: 'S1', berth: 11 }
                ]
            };

            const mockResults = {
                success: [{ pnr: 'PNR001', allocated: true }],
                failed: [{ pnr: 'INVALID', error: 'Not found' }]
            };

            ReallocationService.applyReallocation.mockReturnValue(mockResults);

            reallocationController.applyReallocation(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        success: expect.arrayContaining([
                            expect.objectContaining({ pnr: 'PNR001' })
                        ]),
                        failed: expect.arrayContaining([
                            expect.objectContaining({ pnr: 'INVALID' })
                        ])
                    })
                })
            );
        });
    });

    describe('sendUpgradeOffer', () => {
        beforeEach(() => {
            mockTrainState.racQueue = [
                { 
                    pnr: 'PNR001', 
                    name: 'Test Passenger',
                    passengerStatus: 'Online',
                    irctcId: 'TEST123',
                    pnrStatus: 'RAC'
                }
            ];
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
        });

        it('should send upgrade offer to online passenger', async () => {
            req.body = {
                pnr: 'PNR001',
                berthDetails: { coach: 'S1', berthNo: 10, type: 'Lower' }
            };

            const PushNotificationService = require('../../services/PushNotificationService');
            PushNotificationService.sendUpgradeOffer = jest.fn().mockResolvedValue({ sent: true });

            await reallocationController.sendUpgradeOffer(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining('offer sent')
                })
            );
        });

        it('should return 400 if PNR is missing', async () => {
            req.body = { berthDetails: {} };

            await reallocationController.sendUpgradeOffer(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if berthDetails is missing', async () => {
            req.body = { pnr: 'PNR001' };

            await reallocationController.sendUpgradeOffer(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not found', async () => {
            req.body = {
                pnr: 'INVALID',
                berthDetails: { coach: 'S1', berthNo: 10 }
            };

            await reallocationController.sendUpgradeOffer(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should return 400 if passenger is offline', async () => {
            mockTrainState.racQueue = [
                { 
                    pnr: 'PNR001', 
                    passengerStatus: 'Offline'
                }
            ];

            req.body = {
                pnr: 'PNR001',
                berthDetails: { coach: 'S1', berthNo: 10 }
            };

            await reallocationController.sendUpgradeOffer(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('offline')
                })
            );
        });
    });
});

// 25 comprehensive tests for reallocationController
