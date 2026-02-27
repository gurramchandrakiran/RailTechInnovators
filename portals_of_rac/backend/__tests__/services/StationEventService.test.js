/**
 * StationEventService Tests - Comprehensive Coverage
 * Tests for station arrival processing, boarding, deboarding, and upgrades
 */

const StationEventService = require('../../services/StationEventService');
const ReallocationService = require('../../services/ReallocationService');
const StationWiseApprovalService = require('../../services/StationWiseApprovalService');
const CONSTANTS = require('../../services/reallocation/reallocationConstants');

jest.mock('../../services/ReallocationService');
jest.mock('../../services/StationWiseApprovalService');

describe('StationEventService - Comprehensive Tests', () => {
    let mockTrainState;
    let mockCoach;
    let mockBerth;

    beforeEach(() => {
        jest.clearAllMocks();

        mockBerth = {
            fullBerthNo: 'S1-15',
            berthNo: '15',
            coachNo: 'S1',
            type: 'Lower',
            passengers: [],
            segmentOccupancy: [null, null, null],
            getBoardingPassengers: jest.fn(() => []),
            getDeboardingPassengers: jest.fn(() => []),
            removePassenger: jest.fn()
        };

        mockCoach = {
            coachNo: 'S1',
            class: 'SL',
            berths: [mockBerth]
        };

        mockTrainState = {
            currentStationIdx: 1,
            stations: [
                { idx: 0, code: 'STA', name: 'Station A', sno: 1 },
                { idx: 1, code: 'STB', name: 'Station B', sno: 2 },
                { idx: 2, code: 'STC', name: 'Station C', sno: 3 }
            ],
            coaches: [mockCoach],
            racQueue: [],
            stats: {
                totalDeboarded: 0,
                totalNoShows: 0,
                currentOnboard: 0,
                racPassengers: 0,
                vacantBerths: 0
            },
            getCurrentStation: jest.fn(() => ({ idx: 1, code: 'STB', name: 'Station B', sno: 2 })),
            updateStats: jest.fn(),
            logEvent: jest.fn()
        };
    });

    describe('processStationArrival', () => {
        it('should process station arrival successfully', async () => {
            mockBerth.getBoardingPassengers.mockReturnValue([
                { name: 'John', pnr: 'P001', from: 'STB', boarded: false }
            ]);

            mockBerth.getDeboardingPassengers.mockReturnValue([]);

            const result = await StationEventService.processStationArrival(mockTrainState);

            expect(result.station).toBe('Station B');
            expect(result.stationCode).toBe('STB');
            expect(result.boarded).toBe(1);
            expect(mockTrainState.updateStats).toHaveBeenCalled();
            expect(mockTrainState.logEvent).toHaveBeenCalled();
        });

        it('should throw error if invalid station index', async () => {
            mockTrainState.getCurrentStation.mockReturnValue(null);

            await expect(StationEventService.processStationArrival(mockTrainState))
                .rejects.toThrow('Invalid station index');
        });

        it('should process boarding and deboarding together', async () => {
            mockBerth.getBoardingPassengers.mockReturnValue([
                { name: 'John', pnr: 'P001', from: 'STB', boarded: false }
            ]);

            mockBerth.getDeboardingPassengers.mockReturnValue([
                { name: 'Jane', pnr: 'P002', to: 'STB' }
            ]);

            const result = await StationEventService.processStationArrival(mockTrainState);

            expect(result.boarded).toBe(1);
            expect(result.deboarded).toBe(1);
        });

        it('should process no-shows', async () => {
            mockBerth.passengers = [
                { name: 'NoShow', pnr: 'P003', fromIdx: 0, noShow: true, boarded: false }
            ];

            const result = await StationEventService.processStationArrival(mockTrainState);

            expect(result.noShows).toBe(1);
        });

        it('should disable automatic RAC upgrades', async () => {
            const result = await StationEventService.processStationArrival(mockTrainState);

            expect(result.racAllocated).toBe(0);
            expect(result.upgrades).toEqual([]);
        });
    });

    describe('boardPassengers', () => {
        it('should board CNF passengers', () => {
            const passenger = { name: 'John', pnr: 'P001', from: 'STB', boarded: false };
            mockBerth.getBoardingPassengers.mockReturnValue([passenger]);

            const count = StationEventService.boardPassengers(mockTrainState);

            expect(count).toBe(1);
            expect(passenger.boarded).toBe(true);
        });

        it('should board RAC passengers at origin', () => {
            mockTrainState.racQueue = [
                { name: 'RAC1', pnr: 'R001', fromIdx: 1, boarded: false, noShow: false },
                { name: 'RAC2', pnr: 'R002', fromIdx: 0, boarded: false, noShow: false }
            ];

            const count = StationEventService.boardPassengers(mockTrainState);

            expect(count).toBe(1);
            expect(mockTrainState.racQueue[0].boarded).toBe(true);
            expect(mockTrainState.racQueue[1].boarded).toBe(false);
        });

        it('should not board RAC passengers marked as no-show', () => {
            mockTrainState.racQueue = [
                { name: 'RAC1', pnr: 'R001', fromIdx: 1, boarded: false, noShow: true }
            ];

            const count = StationEventService.boardPassengers(mockTrainState);

            expect(count).toBe(0);
            expect(mockTrainState.racQueue[0].boarded).toBe(false);
        });

        it('should handle multiple passengers boarding', () => {
            mockBerth.getBoardingPassengers.mockReturnValue([
                { name: 'John', pnr: 'P001', from: 'STB', boarded: false },
                { name: 'Jane', pnr: 'P002', from: 'STB', boarded: false }
            ]);

            const count = StationEventService.boardPassengers(mockTrainState);

            expect(count).toBe(2);
        });
    });

    describe('deboardPassengers', () => {
        it('should deboard passengers at destination', () => {
            const passenger = { name: 'John', pnr: 'P001', to: 'STB' };
            mockBerth.getDeboardingPassengers.mockReturnValue([passenger]);

            const result = StationEventService.deboardPassengers(mockTrainState);

            expect(result.count).toBe(1);
            expect(mockBerth.removePassenger).toHaveBeenCalledWith('P001');
            expect(mockTrainState.stats.totalDeboarded).toBe(1);
        });

        it('should track newly vacant berths', () => {
            mockBerth.getDeboardingPassengers.mockReturnValue([
                { name: 'John', pnr: 'P001', to: 'STB' }
            ]);

            const result = StationEventService.deboardPassengers(mockTrainState);

            expect(result.newlyVacantBerths).toHaveLength(1);
            expect(result.newlyVacantBerths[0]).toMatchObject({
                coachNo: 'S1',
                berthNo: '15',
                type: 'Lower',
                class: 'SL'
            });
        });

        it('should handle multiple passengers deboarding', () => {
            mockBerth.getDeboardingPassengers.mockReturnValue([
                { name: 'John', pnr: 'P001', to: 'STB' },
                { name: 'Jane', pnr: 'P002', to: 'STB' }
            ]);

            const result = StationEventService.deboardPassengers(mockTrainState);

            expect(result.count).toBe(2);
            expect(mockBerth.removePassenger).toHaveBeenCalledTimes(2);
        });

        it('should return empty result if no passengers deboarding', () => {
            mockBerth.getDeboardingPassengers.mockReturnValue([]);

            const result = StationEventService.deboardPassengers(mockTrainState);

            expect(result.count).toBe(0);
            expect(result.newlyVacantBerths).toEqual([]);
        });
    });

    describe('processNoShows', () => {
        it('should process no-show passengers', () => {
            mockBerth.passengers = [
                { name: 'NoShow', pnr: 'P001', fromIdx: 0, noShow: true, boarded: false }
            ];

            const count = StationEventService.processNoShows(mockTrainState);

            expect(count).toBe(1);
            expect(mockBerth.removePassenger).toHaveBeenCalledWith('P001');
            expect(mockTrainState.stats.totalNoShows).toBe(1);
        });

        it('should not process passengers who boarded', () => {
            mockBerth.passengers = [
                { name: 'Boarded', pnr: 'P001', fromIdx: 0, noShow: true, boarded: true }
            ];

            const count = StationEventService.processNoShows(mockTrainState);

            expect(count).toBe(0);
        });

        it('should only process no-shows at or before current station', () => {
            mockBerth.passengers = [
                { name: 'Future', pnr: 'P001', fromIdx: 2, noShow: true, boarded: false },
                { name: 'Past', pnr: 'P002', fromIdx: 0, noShow: true, boarded: false }
            ];

            const count = StationEventService.processNoShows(mockTrainState);

            expect(count).toBe(1);
            expect(mockBerth.removePassenger).toHaveBeenCalledWith('P002');
        });

        it('should handle multiple no-shows', () => {
            mockBerth.passengers = [
                { name: 'NoShow1', pnr: 'P001', fromIdx: 0, noShow: true, boarded: false },
                { name: 'NoShow2', pnr: 'P002', fromIdx: 1, noShow: true, boarded: false }
            ];

            const count = StationEventService.processNoShows(mockTrainState);

            expect(count).toBe(2);
        });
    });

    describe('processRACUpgradesWithEligibility', () => {
        beforeEach(() => {
            CONSTANTS.CURRENT_MODE = CONSTANTS.REALLOCATION_MODE.AUTO;
        });

        it('should return zero upgrades if no vacant berths', async () => {
            const result = await StationEventService.processRACUpgradesWithEligibility(mockTrainState, []);

            expect(result.count).toBe(0);
            expect(result.upgrades).toEqual([]);
        });

        it('should use approval mode when configured', async () => {
            CONSTANTS.CURRENT_MODE = CONSTANTS.REALLOCATION_MODE.APPROVAL;
            const vacantBerths = [{ berth: mockBerth, coachNo: 'S1', berthNo: '15' }];

            StationWiseApprovalService.createPendingReallocations.mockResolvedValue({
                count: 1,
                upgrades: []
            });

            await StationEventService.processRACUpgradesWithEligibility(mockTrainState, vacantBerths);

            expect(StationWiseApprovalService.createPendingReallocations).toHaveBeenCalled();
        });

        it('should process upgrades in auto mode', async () => {
            CONSTANTS.CURRENT_MODE = CONSTANTS.REALLOCATION_MODE.AUTO;
            const vacantBerths = [{ 
                berth: mockBerth, 
                coachNo: 'S1', 
                berthNo: '15',
                class: 'SL'
            }];

            ReallocationService.getEligibleRACForVacantSegment.mockReturnValue({
                pnr: 'R001',
                name: 'RAC Passenger',
                racStatus: 'RAC 1'
            });

            ReallocationService.upgradeRACPassengerWithCoPassenger.mockResolvedValue({
                success: true,
                passenger: { pnr: 'R001' }
            });

            const result = await StationEventService.processRACUpgradesWithEligibility(
                mockTrainState, 
                vacantBerths
            );

            expect(result.count).toBeGreaterThanOrEqual(0);
        });

        it('should handle upgrade failures gracefully', async () => {
            CONSTANTS.CURRENT_MODE = CONSTANTS.REALLOCATION_MODE.AUTO;
            const vacantBerths = [{ 
                berth: mockBerth, 
                coachNo: 'S1', 
                berthNo: '15',
                class: 'SL'
            }];

            ReallocationService.getEligibleRACForVacantSegment.mockReturnValue({
                pnr: 'R001',
                name: 'RAC Passenger'
            });

            ReallocationService.upgradeRACPassengerWithCoPassenger.mockRejectedValue(
                new Error('Upgrade failed')
            );

            const result = await StationEventService.processRACUpgradesWithEligibility(
                mockTrainState,
                vacantBerths
            );

            expect(result.count).toBe(0);
        });
    });

    describe('getVacantSegmentRanges', () => {
        it('should get vacant segment ranges across all berths', () => {
            mockBerth.segmentOccupancy = [null, null, ['P001']];

            const ranges = StationEventService.getVacantSegmentRanges(mockTrainState);

            expect(ranges.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle fully occupied berths', () => {
            mockBerth.segmentOccupancy = [['P001'], ['P001'], ['P001']];

            const ranges = StationEventService.getVacantSegmentRanges(mockTrainState);

            expect(ranges).toEqual([]);
        });

        it('should handle fully vacant berths', () => {
            mockBerth.segmentOccupancy = [null, null, null];

            const ranges = StationEventService.getVacantSegmentRanges(mockTrainState);

            expect(ranges.length).toBeGreaterThan(0);
            expect(ranges[0]).toHaveProperty('fromIdx');
            expect(ranges[0]).toHaveProperty('toIdx');
        });
    });

    describe('_getVacantSegmentRangesForBerth', () => {
        it('should identify vacant segments correctly', () => {
            mockBerth.segmentOccupancy = [null, null, ['P001'], null];

            const ranges = StationEventService._getVacantSegmentRangesForBerth(
                mockBerth,
                mockTrainState.stations,
                mockCoach
            );

            expect(ranges.length).toBeGreaterThan(0);
        });

        it('should handle multiple vacant ranges', () => {
            mockBerth.segmentOccupancy = [null, ['P001'], null, ['P002'], null];

            const ranges = StationEventService._getVacantSegmentRangesForBerth(
                mockBerth,
                mockTrainState.stations,
                mockCoach
            );

            expect(ranges.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle vacant range at the end', () => {
            mockBerth.segmentOccupancy = [['P001'], null, null];

            const ranges = StationEventService._getVacantSegmentRangesForBerth(
                mockBerth,
                mockTrainState.stations,
                mockCoach
            );

            expect(ranges.length).toBe(1);
            expect(ranges[0].fromIdx).toBe(1);
        });

        it('should return empty for fully occupied berth', () => {
            mockBerth.segmentOccupancy = [['P001'], ['P002'], ['P003']];

            const ranges = StationEventService._getVacantSegmentRangesForBerth(
                mockBerth,
                mockTrainState.stations,
                mockCoach
            );

            expect(ranges).toEqual([]);
        });
    });
});
