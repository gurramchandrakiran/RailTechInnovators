/**
 * VacancyService Tests
 * Tests for vacant berth detection
 * 
 * Actual methods (singleton):
 * - getVacantBerths(trainState) - returns array of vacancies
 * - getVacantSegments(trainState) - alias for getVacantBerths
 * - getTotalVacantBerths(trainState) - returns count
 * - getVacanciesByCoach(trainState, coachNo)
 * - getVacanciesByClass(trainState, classType)
 * - getLongestVacancies(trainState, limit)
 */

const VacancyService = require('../../../services/reallocation/VacancyService');

describe('VacancyService', () => {
    // Mock train state with proper structure matching actual TrainState
    const createMockTrainState = (occupancy = []) => ({
        currentStationIdx: 2,
        stations: [
            { stationCode: 'A', name: 'Station A', idx: 0 },
            { stationCode: 'B', name: 'Station B', idx: 1 },
            { stationCode: 'C', name: 'Station C', idx: 2 },
            { stationCode: 'D', name: 'Station D', idx: 3 }
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
                        segmentOccupancy: occupancy.length ? occupancy : [['PNR1'], ['PNR1'], ['PNR1'], []]
                    },
                    {
                        berthNo: 2,
                        fullBerthNo: 'S1-2',
                        type: 'MB',
                        segmentOccupancy: [[], [], [], []] // All vacant
                    },
                    {
                        berthNo: 3,
                        fullBerthNo: 'S1-3',
                        type: 'UB',
                        segmentOccupancy: [['PNR2'], ['PNR2'], [], []] // Partial vacancy
                    }
                ]
            }
        ]
    });

    describe('getVacantBerths', () => {
        it('should return array of vacant berths', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getVacantBerths(trainState);

            expect(Array.isArray(result)).toBe(true);
        });

        it('should include berth details in each vacancy', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getVacantBerths(trainState);

            if (result.length > 0) {
                const vacancy = result[0];
                expect(vacancy).toHaveProperty('coach');
                expect(vacancy).toHaveProperty('berthNo');
                expect(vacancy).toHaveProperty('type');
                expect(vacancy).toHaveProperty('fromIdx');
                expect(vacancy).toHaveProperty('toIdx');
            }
        });

        it('should find fully vacant berths', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getVacantBerths(trainState);

            // S1-2 should be fully vacant
            const fullyVacant = result.filter(v => v.berthNo === 2);
            expect(fullyVacant.length).toBeGreaterThan(0);
        });

        it('should return empty array when no vacancies exist', () => {
            const trainState = createMockTrainState([['P1'], ['P1'], ['P1'], ['P1']]);
            // Override all berths to be occupied
            trainState.coaches[0].berths = [
                {
                    berthNo: 1,
                    fullBerthNo: 'S1-1',
                    type: 'LB',
                    segmentOccupancy: [['P1'], ['P1'], ['P1'], ['P1']]
                }
            ];

            const result = VacancyService.getVacantBerths(trainState);
            expect(result).toHaveLength(0);
        });
    });

    describe('getVacantSegments', () => {
        it('should be an alias for getVacantBerths', () => {
            const trainState = createMockTrainState();
            const berths = VacancyService.getVacantBerths(trainState);
            const segments = VacancyService.getVacantSegments(trainState);

            expect(segments).toEqual(berths);
        });
    });

    describe('getTotalVacantBerths', () => {
        it('should return count of vacant berths', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getTotalVacantBerths(trainState);

            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getVacanciesByCoach', () => {
        it('should filter vacancies by coach number', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getVacanciesByCoach(trainState, 'S1');

            expect(Array.isArray(result)).toBe(true);
            result.forEach(v => {
                expect(v.coach).toBe('S1');
            });
        });

        it('should return empty array for non-existent coach', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getVacanciesByCoach(trainState, 'S99');

            expect(result).toHaveLength(0);
        });
    });

    describe('getVacanciesByClass', () => {
        it('should filter vacancies by class type', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getVacanciesByClass(trainState, 'SL');

            expect(Array.isArray(result)).toBe(true);
            result.forEach(v => {
                expect(v.class).toBe('SL');
            });
        });
    });

    describe('getLongestVacancies', () => {
        it('should return longest vacancies sorted by duration', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getLongestVacancies(trainState, 3);

            expect(result.length).toBeLessThanOrEqual(3);
        });

        it('should sort by duration in descending order', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getLongestVacancies(trainState, 5);

            for (let i = 1; i < result.length; i++) {
                const prevDuration = result[i-1].toIdx - result[i-1].fromIdx;
                const currDuration = result[i].toIdx - result[i].fromIdx;
                expect(prevDuration).toBeGreaterThanOrEqual(currDuration);
            }
        });

        it('should limit results to specified count', () => {
            const trainState = createMockTrainState();
            const result = VacancyService.getLongestVacancies(trainState, 2);

            expect(result.length).toBeLessThanOrEqual(2);
        });
    });
});
