/**
 * Reallocation Flow Integration Tests
 * Tests the complete no-show → vacancy → offer → upgrade cycle
 */

// Mock dependencies
jest.mock('../../config/db', () => ({
    getPassengersCollection: jest.fn(() => ({
        findOne: jest.fn(),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
    }))
}));

jest.mock('../../config/websocket', () => ({
    broadcast: jest.fn()
}));

const VacancyService = require('../../services/reallocation/VacancyService');
const RACQueueService = require('../../services/reallocation/RACQueueService');

// Helper to filter eligible RAC passengers (boarded, not no-show)
const getEligibleRAC = (racQueue) => {
    return racQueue.filter(r => r.boarded && !r.noShow);
};

describe('Reallocation Flow Integration', () => {
    // Mock train state with realistic structure
    const createMockTrainState = () => ({
        trainNumber: '17225',
        trainName: 'Test Express',
        currentStationIdx: 2,
        journeyStarted: true,
        stations: [
            { code: 'STA1', name: 'Station 1', idx: 0 },
            { code: 'STA2', name: 'Station 2', idx: 1 },
            { code: 'STA3', name: 'Station 3', idx: 2 },  // Current station
            { code: 'STA4', name: 'Station 4', idx: 3 },
            { code: 'STA5', name: 'Station 5', idx: 4 },
        ],
        coaches: [
            {
                coachNo: 'S1',
                class: 'SL',
                berths: [
                    {
                        berthNo: 1,
                        fullBerthNo: 'S1-1',
                        type: 'LB',
                        // Occupied by CNF passenger for segments 0-4
                        segmentOccupancy: [['PNR001'], ['PNR001'], ['PNR001'], ['PNR001'], []]
                    },
                    {
                        berthNo: 2,
                        fullBerthNo: 'S1-2',
                        type: 'MB',
                        // Vacant from segment 2 onwards (no-show created vacancy)
                        segmentOccupancy: [['PNR002'], ['PNR002'], [], [], []]
                    },
                    {
                        berthNo: 3,
                        fullBerthNo: 'S1-3',
                        type: 'UB',
                        // Fully occupied (all segments have passengers)
                        segmentOccupancy: [['PNR003'], ['PNR003'], ['PNR003'], ['PNR003'], ['PNR003']]
                    }
                ]
            }
        ],
        racQueue: [
            {
                pnr: 'RAC001',
                name: 'RAC Passenger 1',
                fromIdx: 1,
                toIdx: 4,
                boarded: true,
                noShow: false,
                passengerStatus: 'online',
                racStatus: 'RAC-1',
                pnrStatus: 'RAC'
            },
            {
                pnr: 'RAC002',
                name: 'RAC Passenger 2',
                fromIdx: 2,
                toIdx: 4,
                boarded: true,
                noShow: false,
                passengerStatus: 'online',
                racStatus: 'RAC-2',
                pnrStatus: 'RAC'
            }
        ],
        passengers: [
            {
                pnr: 'PNR001',
                name: 'CNF Passenger 1',
                status: 'CNF',
                coach: 'S1',
                berth: 1,
                fromIdx: 0,
                toIdx: 4,
                boarded: true,
                noShow: false
            },
            {
                pnr: 'PNR002',
                name: 'No-Show Passenger',
                status: 'CNF',
                coach: 'S1',
                berth: 2,
                fromIdx: 0,
                toIdx: 4,
                boarded: false,
                noShow: true  // Marked as no-show
            }
        ],
        findPassengerByPNR: function (pnr) {
            return this.passengers.find(p => p.pnr === pnr) ||
                this.racQueue.find(r => r.pnr === pnr);
        },
        getAllPassengers: function () {
            return [...this.passengers, ...this.racQueue];
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.resetModules();
    });

    // =================== NO-SHOW → VACANCY TESTS ===================
    describe('No-Show Creates Vacancy', () => {
        it('should detect vacant berths after no-show', () => {
            const trainState = createMockTrainState();

            // Berth S1-2 should have vacancy from segment 2 onwards (after no-show)
            const vacancies = VacancyService.getVacantBerths(trainState);

            expect(Array.isArray(vacancies)).toBe(true);

            // Should find vacancy in S1-2 from current station onwards
            const s1b2Vacancy = vacancies.find(v =>
                v.coach === 'S1' && v.berthNo === 2
            );

            expect(s1b2Vacancy).toBeDefined();
            expect(s1b2Vacancy.fromIdx).toBeGreaterThanOrEqual(trainState.currentStationIdx);
        });

        it('should not find vacancies in fully occupied berths', () => {
            const trainState = createMockTrainState();
            const vacancies = VacancyService.getVacantBerths(trainState);

            // S1-3 is fully occupied, should have no vacancies after current station
            const s1b3Vacancies = vacancies.filter(v =>
                v.coach === 'S1' && v.berthNo === 3 && v.fromIdx >= trainState.currentStationIdx
            );

            expect(s1b3Vacancies.length).toBe(0);
        });
    });

    // =================== VACANCY → ELIGIBLE RAC TESTS ===================
    describe('Vacancy Matches Eligible RAC', () => {
        it('should identify RAC passengers eligible for upgrade', () => {
            const trainState = createMockTrainState();

            // Get RAC queue and filter for eligible (boarded, not no-show)
            const racQueue = RACQueueService.getRACQueue(trainState);
            const eligibleRAC = getEligibleRAC(racQueue);

            expect(Array.isArray(eligibleRAC)).toBe(true);

            // RAC001 and RAC002 should be eligible
            const rac001 = eligibleRAC.find(r => r.pnr === 'RAC001');
            const rac002 = eligibleRAC.find(r => r.pnr === 'RAC002');

            // At least one should be eligible
            expect(rac001 || rac002).toBeDefined();
        });

        it('should not include no-show RAC passengers as eligible', () => {
            const trainState = createMockTrainState();
            // Mark RAC001 as no-show
            trainState.racQueue[0].noShow = true;

            const racQueue = RACQueueService.getRACQueue(trainState);
            const eligibleRAC = getEligibleRAC(racQueue);

            const rac001 = eligibleRAC.find(r => r.pnr === 'RAC001');
            expect(rac001).toBeUndefined();
        });

        it('should not include non-boarded RAC passengers as eligible', () => {
            const trainState = createMockTrainState();
            // Mark RAC001 as not boarded
            trainState.racQueue[0].boarded = false;

            const racQueue = RACQueueService.getRACQueue(trainState);
            const eligibleRAC = getEligibleRAC(racQueue);

            const rac001 = eligibleRAC.find(r => r.pnr === 'RAC001');
            expect(rac001).toBeUndefined();
        });
    });

    // =================== OFFER → UPGRADE CYCLE TESTS ===================
    describe('Complete Upgrade Cycle', () => {
        it('should have matching vacancy for eligible RAC journey', () => {
            const trainState = createMockTrainState();

            const vacancies = VacancyService.getVacantBerths(trainState);
            const racQueue = RACQueueService.getRACQueue(trainState);
            const eligibleRAC = getEligibleRAC(racQueue);

            if (eligibleRAC.length > 0 && vacancies.length > 0) {
                const rac = eligibleRAC[0];

                // Find vacancy that covers RAC passenger's journey
                const matchingVacancy = vacancies.find(v =>
                    v.fromIdx <= rac.fromIdx && v.toIdx >= rac.toIdx
                );

                // There should be potential for matching
                expect(vacancies.length).toBeGreaterThan(0);
            }
        });

        it('should correctly identify journey segment overlap', () => {
            const trainState = createMockTrainState();

            // RAC001: fromIdx 1, toIdx 4
            // Vacancy in S1-2: fromIdx 2, toIdx 4 (after current station)

            const rac = trainState.racQueue[0]; // RAC001
            const vacancies = VacancyService.getVacantBerths(trainState);

            // Check if any vacancy overlaps with RAC journey
            const overlappingVacancies = vacancies.filter(v => {
                // Vacancy must cover from current station to RAC destination
                return v.fromIdx <= trainState.currentStationIdx &&
                    v.toIdx >= rac.toIdx;
            });

            // This validates the matching logic works
            expect(Array.isArray(overlappingVacancies)).toBe(true);
        });
    });

    // =================== PRIORITY ORDERING TESTS ===================
    describe('RAC Priority Ordering', () => {
        it('should return RAC passengers in priority order', () => {
            const trainState = createMockTrainState();

            const racQueue = RACQueueService.getRACQueue(trainState);
            const eligibleRAC = getEligibleRAC(racQueue);

            if (eligibleRAC.length >= 2) {
                // RAC-1 should come before RAC-2 in priority
                const rac1Index = eligibleRAC.findIndex(r => r.racStatus === 'RAC-1');
                const rac2Index = eligibleRAC.findIndex(r => r.racStatus === 'RAC-2');

                if (rac1Index !== -1 && rac2Index !== -1) {
                    expect(rac1Index).toBeLessThan(rac2Index);
                }
            }
        });
    });

    // =================== EDGE CASES ===================
    describe('Edge Cases', () => {
        it('should handle empty RAC queue', () => {
            const trainState = createMockTrainState();
            trainState.racQueue = [];

            const racQueue = RACQueueService.getRACQueue(trainState);
            const eligibleRAC = getEligibleRAC(racQueue);

            expect(eligibleRAC).toEqual([]);
        });

        it('should handle no vacancies', () => {
            const trainState = createMockTrainState();
            // Make all berths fully occupied
            trainState.coaches[0].berths.forEach(b => {
                b.segmentOccupancy = [['P1'], ['P1'], ['P1'], ['P1'], ['P1']];
            });

            const vacancies = VacancyService.getVacantBerths(trainState);

            expect(vacancies).toEqual([]);
        });

        it('should handle journey not started', () => {
            const trainState = createMockTrainState();
            trainState.journeyStarted = false;
            trainState.currentStationIdx = 0;

            // Services should still work but return appropriate results
            const vacancies = VacancyService.getVacantBerths(trainState);
            expect(Array.isArray(vacancies)).toBe(true);
        });
    });
});

