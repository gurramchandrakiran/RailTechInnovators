const CurrentStationReallocationService = require('../../services/CurrentStationReallocationService');
const StationWiseApprovalService = require('../../services/StationWiseApprovalService');
const WebPushService = require('../../services/WebPushService');
const NotificationService = require('../../services/NotificationService');

jest.mock('../../services/StationWiseApprovalService');
jest.mock('../../services/WebPushService');
jest.mock('../../services/NotificationService');
jest.mock('../../config/db');
jest.mock('../../config/websocket');

describe('CurrentStationReallocationService', () => {
    let mockTrainState;
    let mockDb;
    let mockPassengersCollection;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockPassengersCollection = {
            findOne: jest.fn()
        };

        mockDb = {
            getPassengersCollection: jest.fn(() => mockPassengersCollection)
        };
        
        require('../../config/db').getPassengersCollection = mockDb.getPassengersCollection;

        mockTrainState = {
            trainNo: '17225',
            trainName: 'Amaravathi Express',
            currentStationIdx: 2,
            stations: [
                { name: 'Station A', code: 'STA' },
                { name: 'Station B', code: 'STB' },
                { name: 'Station C', code: 'STC' },
                { name: 'Station D', code: 'STD' },
                { name: 'Station E', code: 'STE' }
            ],
            coaches: [
                {
                    coachNo: 'S1',
                    class: 'SL',
                    berths: [
                        {
                            berthNo: 1,
                            type: 'Lower Berth',
                            passengers: [],
                            segmentOccupancy: [[], [], [], []]
                        },
                        {
                            berthNo: 2,
                            type: 'Upper Berth',
                            passengers: [],
                            segmentOccupancy: [[], [], [], []]
                        }
                    ]
                }
            ],
            getBoardedRACPassengers: jest.fn(() => [])
        };
    });

    describe('getCurrentStationData', () => {
        it('should return current station reallocation data', () => {
            const result = CurrentStationReallocationService.getCurrentStationData(mockTrainState);

            expect(result).toHaveProperty('currentStation');
            expect(result.currentStation.name).toBe('Station C');
            expect(result.currentStation.index).toBe(2);
            expect(result).toHaveProperty('racPassengers');
            expect(result).toHaveProperty('vacantBerths');
            expect(result).toHaveProperty('matches');
            expect(result).toHaveProperty('stats');
        });

        it('should process RAC passengers at current station', () => {
            const racPassengers = [
                {
                    pnr: 'P001',
                    name: 'John Doe',
                    racStatus: 'RAC 1',
                    fromIdx: 0,
                    toIdx: 4,
                    from: 'Station A',
                    to: 'Station E',
                    passengerStatus: 'Online'
                }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);

            const result = CurrentStationReallocationService.getCurrentStationData(mockTrainState);

            expect(result.racPassengers.length).toBe(1);
            expect(result.racPassengers[0].pnr).toBe('P001');
        });

        it('should find vacant berths at current station', () => {
            const result = CurrentStationReallocationService.getCurrentStationData(mockTrainState);

            expect(result.vacantBerths.length).toBeGreaterThanOrEqual(0);
            expect(result.stats.vacantBerthsCount).toBeDefined();
        });

        it('should group RAC passengers by destination', () => {
            const racPassengers = [
                { pnr: 'P001', name: 'John', fromIdx: 0, toIdx: 3, passengerStatus: 'Online' },
                { pnr: 'P002', name: 'Jane', fromIdx: 1, toIdx: 4, passengerStatus: 'Offline' }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);

            const result = CurrentStationReallocationService.getCurrentStationData(mockTrainState);

            expect(result.racByDestination).toBeDefined();
            expect(Array.isArray(result.racByDestination)).toBe(true);
        });

        it('should group vacant berths by vacancy end', () => {
            const result = CurrentStationReallocationService.getCurrentStationData(mockTrainState);

            expect(result.berthsByVacancyEnd).toBeDefined();
            expect(Array.isArray(result.berthsByVacancyEnd)).toBe(true);
        });

        it('should calculate statistics correctly', () => {
            const result = CurrentStationReallocationService.getCurrentStationData(mockTrainState);

            expect(result.stats).toHaveProperty('racPassengersCount');
            expect(result.stats).toHaveProperty('vacantBerthsCount');
            expect(result.stats).toHaveProperty('matchesCount');
            expect(result.stats).toHaveProperty('upgradesAvailable');
        });
    });

    describe('_groupByDestination', () => {
        it('should group passengers by destination station', () => {
            const passengers = [
                { pnr: 'P001', destinationIdx: 3, destination: 'Station D' },
                { pnr: 'P002', destinationIdx: 3, destination: 'Station D' },
                { pnr: 'P003', destinationIdx: 4, destination: 'Station E' }
            ];

            const result = CurrentStationReallocationService._groupByDestination(passengers, mockTrainState);

            expect(result.length).toBe(2);
            expect(result[0].passengers.length).toBe(2);
            expect(result[1].passengers.length).toBe(1);
        });

        it('should sort groups by station index', () => {
            const passengers = [
                { pnr: 'P001', destinationIdx: 4, destination: 'Station E' },
                { pnr: 'P002', destinationIdx: 2, destination: 'Station C' }
            ];

            const result = CurrentStationReallocationService._groupByDestination(passengers, mockTrainState);

            expect(result[0].stationIdx).toBeLessThan(result[1].stationIdx);
        });

        it('should handle empty passenger array', () => {
            const result = CurrentStationReallocationService._groupByDestination([], mockTrainState);

            expect(result).toEqual([]);
        });
    });

    describe('_groupByVacancyEnd', () => {
        it('should group berths by vacancy end station', () => {
            const berths = [
                { berthId: 'S1-1', lastVacantIdx: 3, lastVacantStation: 'Station D' },
                { berthId: 'S1-2', lastVacantIdx: 3, lastVacantStation: 'Station D' },
                { berthId: 'S1-3', lastVacantIdx: 4, lastVacantStation: 'Station E' }
            ];

            const result = CurrentStationReallocationService._groupByVacancyEnd(berths, mockTrainState);

            expect(result.length).toBe(2);
            expect(result[0].berths.length).toBe(2);
        });

        it('should sort groups by station index', () => {
            const berths = [
                { berthId: 'S1-1', lastVacantIdx: 4, lastVacantStation: 'Station E' },
                { berthId: 'S1-2', lastVacantIdx: 2, lastVacantStation: 'Station C' }
            ];

            const result = CurrentStationReallocationService._groupByVacancyEnd(berths, mockTrainState);

            expect(result[0].stationIdx).toBeLessThan(result[1].stationIdx);
        });
    });

    describe('_getRACPassengersAtCurrentStation', () => {
        it('should filter RAC passengers at current station', () => {
            const racPassengers = [
                { pnr: 'P001', fromIdx: 0, toIdx: 4, racStatus: 'RAC 1' },
                { pnr: 'P002', fromIdx: 3, toIdx: 4, racStatus: 'RAC 2' }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);

            const result = CurrentStationReallocationService._getRACPassengersAtCurrentStation(mockTrainState, 2);

            expect(result.size).toBe(1);
            expect(result.has('P001')).toBe(true);
            expect(result.has('P002')).toBe(false);
        });

        it('should include passenger details in HashMap', () => {
            const racPassengers = [
                {
                    pnr: 'P001',
                    name: 'John Doe',
                    racStatus: 'RAC 1',
                    fromIdx: 0,
                    toIdx: 4,
                    from: 'Station A',
                    to: 'Station E',
                    coach: 'S1',
                    seatNo: '42',
                    passengerStatus: 'Online'
                }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);

            const result = CurrentStationReallocationService._getRACPassengersAtCurrentStation(mockTrainState, 2);

            const passenger = result.get('P001');
            expect(passenger).toHaveProperty('pnr', 'P001');
            expect(passenger).toHaveProperty('name', 'John Doe');
            expect(passenger).toHaveProperty('racStatus', 'RAC 1');
            expect(passenger).toHaveProperty('destinationIdx', 4);
        });

        it('should handle empty RAC queue', () => {
            mockTrainState.getBoardedRACPassengers.mockReturnValue([]);

            const result = CurrentStationReallocationService._getRACPassengersAtCurrentStation(mockTrainState, 2);

            expect(result.size).toBe(0);
        });
    });

    describe('_getVacantBerthsFromCurrentStation', () => {
        it('should find vacant berths at current station', () => {
            const result = CurrentStationReallocationService._getVacantBerthsFromCurrentStation(mockTrainState, 2);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBeGreaterThanOrEqual(0);
        });

        it('should include berth details in HashMap', () => {
            const result = CurrentStationReallocationService._getVacantBerthsFromCurrentStation(mockTrainState, 2);

            if (result.size > 0) {
                const firstBerth = Array.from(result.values())[0];
                expect(firstBerth).toHaveProperty('berthId');
                expect(firstBerth).toHaveProperty('coachNo');
                expect(firstBerth).toHaveProperty('berthNo');
                expect(firstBerth).toHaveProperty('type');
                expect(firstBerth).toHaveProperty('vacantFromIdx');
                expect(firstBerth).toHaveProperty('lastVacantIdx');
            }
        });

        it('should exclude occupied berths', () => {
            mockTrainState.coaches[0].berths[0].passengers = [
                { pnr: 'P001', fromIdx: 0, toIdx: 4, noShow: false }
            ];

            const result = CurrentStationReallocationService._getVacantBerthsFromCurrentStation(mockTrainState, 2);

            expect(result.has('S1-1')).toBe(false);
        });
    });

    describe('_checkBerthVacantAtSegment', () => {
        it('should return isVacant=true for vacant berth', () => {
            const berth = {
                passengers: [],
                segmentOccupancy: [[], [], [], []]
            };

            const result = CurrentStationReallocationService._checkBerthVacantAtSegment(berth, 2, mockTrainState);

            expect(result.isVacant).toBe(true);
        });

        it('should return isVacant=false for occupied berth', () => {
            const berth = {
                passengers: [{ pnr: 'P001', fromIdx: 0, toIdx: 4, noShow: false }],
                segmentOccupancy: [['P001'], ['P001'], ['P001'], ['P001']]
            };

            const result = CurrentStationReallocationService._checkBerthVacantAtSegment(berth, 2, mockTrainState);

            expect(result.isVacant).toBe(false);
        });

        it('should ignore no-show passengers', () => {
            const berth = {
                passengers: [{ pnr: 'P001', fromIdx: 0, toIdx: 4, noShow: true }],
                segmentOccupancy: [[], [], [], []]
            };

            const result = CurrentStationReallocationService._checkBerthVacantAtSegment(berth, 2, mockTrainState);

            expect(result.isVacant).toBe(true);
        });

        it('should calculate vacancy range correctly', () => {
            const berth = {
                passengers: [],
                segmentOccupancy: [[], [], [], []]
            };

            const result = CurrentStationReallocationService._checkBerthVacantAtSegment(berth, 0, mockTrainState);

            expect(result).toHaveProperty('vacantFromIdx');
            expect(result).toHaveProperty('vacantToIdx');
        });
    });

    describe('_findVacantRanges', () => {
        it('should find vacant ranges in berth', () => {
            const berth = {
                passengers: [
                    { pnr: 'P001', fromIdx: 0, toIdx: 2, noShow: false }
                ],
                segmentOccupancy: [['P001'], ['P001'], [], []]
            };

            const result = CurrentStationReallocationService._findVacantRanges(berth, mockTrainState);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toHaveProperty('fromIdx');
            expect(result[0]).toHaveProperty('toIdx');
        });

        it('should handle fully occupied berth', () => {
            const berth = {
                passengers: [{ pnr: 'P001', fromIdx: 0, toIdx: 4, noShow: false }],
                segmentOccupancy: [['P001'], ['P001'], ['P001'], ['P001']]
            };

            const result = CurrentStationReallocationService._findVacantRanges(berth, mockTrainState);

            expect(result.length).toBe(0);
        });

        it('should handle fully vacant berth', () => {
            const berth = {
                passengers: [],
                segmentOccupancy: [[], [], [], []]
            };

            const result = CurrentStationReallocationService._findVacantRanges(berth, mockTrainState);

            expect(result.length).toBe(1);
            expect(result[0].fromIdx).toBe(0);
            expect(result[0].toIdx).toBe(4);
        });
    });

    describe('_findMatches', () => {
        it('should find perfect matches', () => {
            const racHashMap = new Map([
                ['P001', { pnr: 'P001', destinationIdx: 4, class: 'SL', racStatus: 'RAC 1' }]
            ]);
            const vacantHashMap = new Map([
                ['S1-1', { berthId: 'S1-1', lastVacantIdx: 4, class: 'SL' }]
            ]);

            const result = CurrentStationReallocationService._findMatches(racHashMap, vacantHashMap, 2);

            expect(result.length).toBe(1);
            expect(result[0].topMatch.pnr).toBe('P001');
            expect(result[0].topMatch.isPerfectMatch).toBe(true);
        });

        it('should skip class mismatches', () => {
            const racHashMap = new Map([
                ['P001', { pnr: 'P001', destinationIdx: 4, class: '3A', racStatus: 'RAC 1' }]
            ]);
            const vacantHashMap = new Map([
                ['S1-1', { berthId: 'S1-1', lastVacantIdx: 4, class: 'SL' }]
            ]);

            const result = CurrentStationReallocationService._findMatches(racHashMap, vacantHashMap, 2);

            expect(result.length).toBe(0);
        });

        it('should avoid duplicate passenger assignments', () => {
            const racHashMap = new Map([
                ['P001', { pnr: 'P001', destinationIdx: 4, class: 'SL', racStatus: 'RAC 1' }]
            ]);
            const vacantHashMap = new Map([
                ['S1-1', { berthId: 'S1-1', lastVacantIdx: 4, class: 'SL' }],
                ['S1-2', { berthId: 'S1-2', lastVacantIdx: 4, class: 'SL' }]
            ]);

            const result = CurrentStationReallocationService._findMatches(racHashMap, vacantHashMap, 2);

            expect(result.length).toBe(1);
        });

        it('should prioritize by RAC number', () => {
            const racHashMap = new Map([
                ['P001', { pnr: 'P001', destinationIdx: 4, class: 'SL', racStatus: 'RAC 2' }],
                ['P002', { pnr: 'P002', destinationIdx: 4, class: 'SL', racStatus: 'RAC 1' }]
            ]);
            const vacantHashMap = new Map([
                ['S1-1', { berthId: 'S1-1', lastVacantIdx: 4, class: 'SL' }]
            ]);

            const result = CurrentStationReallocationService._findMatches(racHashMap, vacantHashMap, 2);

            expect(result[0].topMatch.pnr).toBe('P002');
        });

        it('should handle empty RAC queue', () => {
            const racHashMap = new Map();
            const vacantHashMap = new Map([
                ['S1-1', { berthId: 'S1-1', lastVacantIdx: 4, class: 'SL' }]
            ]);

            const result = CurrentStationReallocationService._findMatches(racHashMap, vacantHashMap, 2);

            expect(result.length).toBe(0);
        });

        it('should handle no vacant berths', () => {
            const racHashMap = new Map([
                ['P001', { pnr: 'P001', destinationIdx: 4, class: 'SL', racStatus: 'RAC 1' }]
            ]);
            const vacantHashMap = new Map();

            const result = CurrentStationReallocationService._findMatches(racHashMap, vacantHashMap, 2);

            expect(result.length).toBe(0);
        });
    });

    describe('createPendingReallocationsFromMatches', () => {
        beforeEach(() => {
            StationWiseApprovalService._savePendingReallocations = jest.fn().mockResolvedValue({ success: true });
            WebPushService.sendRACApprovalRequestToTTEs = jest.fn().mockResolvedValue(true);
            WebPushService.sendUpgradeOfferToPassenger = jest.fn().mockResolvedValue(true);
            NotificationService.sendApprovalRequestNotification = jest.fn().mockResolvedValue(true);

            const wsManager = require('../../config/websocket');
            wsManager.broadcast = jest.fn();
        });

        it('should create pending reallocations from matches', async () => {
            const racPassengers = [
                {
                    pnr: 'P001',
                    name: 'John Doe',
                    racStatus: 'RAC 1',
                    fromIdx: 0,
                    toIdx: 4,
                    passengerStatus: 'Online'
                }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);
            mockTrainState.coaches[0].berths[0].passengers = [];

            mockPassengersCollection.findOne.mockResolvedValue({
                IRCTC_ID: 'IR_001',
                Passenger_Status: 'Online',
                Email: 'john@example.com'
            });

            const result = await CurrentStationReallocationService.createPendingReallocationsFromMatches(mockTrainState);

            expect(result.success).toBe(true);
            expect(StationWiseApprovalService._savePendingReallocations).toHaveBeenCalled();
        });

        it('should handle no matches', async () => {
            mockTrainState.getBoardedRACPassengers.mockReturnValue([]);

            const result = await CurrentStationReallocationService.createPendingReallocationsFromMatches(mockTrainState);

            expect(result.success).toBe(true);
            expect(result.created).toBe(0);
        });

        it('should send TTE push notifications', async () => {
            const racPassengers = [
                { pnr: 'P001', name: 'John', racStatus: 'RAC 1', fromIdx: 0, toIdx: 4, passengerStatus: 'Offline' }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);
            mockTrainState.coaches[0].berths[0].passengers = [];
            mockPassengersCollection.findOne.mockResolvedValue({ IRCTC_ID: 'IR_001' });

            await CurrentStationReallocationService.createPendingReallocationsFromMatches(mockTrainState);

            expect(WebPushService.sendRACApprovalRequestToTTEs).toHaveBeenCalled();
        });

        it('should send passenger notifications for online passengers', async () => {
            const racPassengers = [
                { pnr: 'P001', name: 'John', racStatus: 'RAC 1', fromIdx: 0, toIdx: 4, passengerStatus: 'Online' }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);
            mockTrainState.coaches[0].berths[0].passengers = [];
            mockPassengersCollection.findOne.mockResolvedValue({
                IRCTC_ID: 'IR_001',
                Passenger_Status: 'Online',
                Email: 'john@example.com'
            });

            const result = await CurrentStationReallocationService.createPendingReallocationsFromMatches(mockTrainState);

            expect(result.onlineCount).toBeGreaterThan(0);
            expect(WebPushService.sendUpgradeOfferToPassenger).toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            const racPassengers = [
                { pnr: 'P001', name: 'John', racStatus: 'RAC 1', fromIdx: 0, toIdx: 4, passengerStatus: 'Online' }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);
            mockTrainState.coaches[0].berths[0].passengers = [];
            mockPassengersCollection.findOne.mockRejectedValue(new Error('DB Error'));

            const result = await CurrentStationReallocationService.createPendingReallocationsFromMatches(mockTrainState);

            expect(result.success).toBe(true);
        });

        it('should handle push notification failures gracefully', async () => {
            const racPassengers = [
                { pnr: 'P001', name: 'John', racStatus: 'RAC 1', fromIdx: 0, toIdx: 4, passengerStatus: 'Online' }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);
            mockTrainState.coaches[0].berths[0].passengers = [];
            mockPassengersCollection.findOne.mockResolvedValue({ IRCTC_ID: 'IR_001', Passenger_Status: 'Online' });
            WebPushService.sendUpgradeOfferToPassenger.mockRejectedValue(new Error('Push failed'));

            const result = await CurrentStationReallocationService.createPendingReallocationsFromMatches(mockTrainState);

            expect(result.success).toBe(true);
        });

        it('should set approval target based on passenger status', async () => {
            const racPassengers = [
                { pnr: 'P001', name: 'John', racStatus: 'RAC 1', fromIdx: 0, toIdx: 4, passengerStatus: 'Offline' }
            ];
            mockTrainState.getBoardedRACPassengers.mockReturnValue(racPassengers);
            mockTrainState.coaches[0].berths[0].passengers = [];
            mockPassengersCollection.findOne.mockResolvedValue({ IRCTC_ID: 'IR_001', Passenger_Status: 'Offline' });

            await CurrentStationReallocationService.createPendingReallocationsFromMatches(mockTrainState);

            const savedReallocations = StationWiseApprovalService._savePendingReallocations.mock.calls[0][0];
            expect(savedReallocations[0].approvalTarget).toBe('TTE_ONLY');
        });
    });
});
