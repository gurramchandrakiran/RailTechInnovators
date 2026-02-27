/**
 * SegmentService Expanded Tests - Additional Coverage
 * Tests for segment-based operations
 */

const SegmentService = require('../../services/SegmentService');

describe('SegmentService - Expanded Tests', () => {
    describe('findEligibleRACForBerth', () => {
        it('should find eligible RAC passengers for available berth', () => {
            const mockBerth = {
                isAvailableForSegment: jest.fn().mockReturnValue(true)
            };
            const mockTrainState = {
                racQueue: [
                    {
                        pnr: 'P001',
                        name: 'John',
                        racNumber: 1,
                        pnrStatus: 'RAC',
                        from: 'A',
                        to: 'C',
                        fromIdx: 0,
                        toIdx: 3
                    },
                    {
                        pnr: 'P002',
                        name: 'Jane',
                        racNumber: 2,
                        pnrStatus: 'RAC',
                        from: 'B',
                        to: 'D',
                        fromIdx: 1,
                        toIdx: 4
                    }
                ]
            };

            const result = SegmentService.findEligibleRACForBerth(mockTrainState, mockBerth, {});

            expect(result).toHaveLength(2);
            expect(result[0].pnr).toBe('P001');
            expect(result[0].segmentCount).toBe(3);
        });

        it('should return empty array when no RAC passengers eligible', () => {
            const mockBerth = {
                isAvailableForSegment: jest.fn().mockReturnValue(false)
            };
            const mockTrainState = {
                racQueue: [
                    { pnr: 'P001', fromIdx: 0, toIdx: 3 }
                ]
            };

            const result = SegmentService.findEligibleRACForBerth(mockTrainState, mockBerth, {});

            expect(result).toHaveLength(0);
        });

        it('should include segmentsNeeded for each passenger', () => {
            const mockBerth = {
                isAvailableForSegment: jest.fn().mockReturnValue(true)
            };
            const mockTrainState = {
                racQueue: [
                    { pnr: 'P001', name: 'Test', fromIdx: 1, toIdx: 4 }
                ]
            };

            const result = SegmentService.findEligibleRACForBerth(mockTrainState, mockBerth, {});

            expect(result[0].segmentsNeeded).toEqual([1, 2, 3]);
            expect(result[0].segmentCount).toBe(3);
        });

        it('should handle empty RAC queue', () => {
            const mockBerth = {
                isAvailableForSegment: jest.fn()
            };
            const mockTrainState = { racQueue: [] };

            const result = SegmentService.findEligibleRACForBerth(mockTrainState, mockBerth, {});

            expect(result).toEqual([]);
        });
    });

    describe('getBerthOccupancyTimeline', () => {
        it('should return null when berth not found', () => {
            const mockTrainState = {
                findBerth: jest.fn().mockReturnValue(null)
            };

            const result = SegmentService.getBerthOccupancyTimeline(mockTrainState, 'S1', 15);

            expect(result).toBeNull();
        });

        it('should return timeline for berth with occupancy', () => {
            const mockBerth = {
                segmentOccupancy: ['P001', null, 'P002', null],
                passengers: [
                    { pnr: 'P001', name: 'John', pnrStatus: 'CNF' },
                    { pnr: 'P002', name: 'Jane', pnrStatus: 'CNF' }
                ]
            };
            const mockTrainState = {
                findBerth: jest.fn().mockReturnValue(mockBerth),
                segmentMatrix: {
                    segments: [
                        { from: 'A', to: 'B' },
                        { from: 'B', to: 'C' },
                        { from: 'C', to: 'D' },
                        { from: 'D', to: 'E' }
                    ]
                }
            };

            const result = SegmentService.getBerthOccupancyTimeline(mockTrainState, 'S1', 15);

            expect(result).toHaveLength(4);
            expect(result[0].occupied).toBe(true);
            expect(result[0].pnr).toBe('P001');
            expect(result[0].passengerName).toBe('John');
            expect(result[1].occupied).toBe(false);
            expect(result[1].pnr).toBeNull();
        });

        it('should handle berth with no passengers', () => {
            const mockBerth = {
                segmentOccupancy: [null, null, null],
                passengers: []
            };
            const mockTrainState = {
                findBerth: jest.fn().mockReturnValue(mockBerth),
                segmentMatrix: {
                    segments: [
                        { from: 'A', to: 'B' },
                        { from: 'B', to: 'C' },
                        { from: 'C', to: 'D' }
                    ]
                }
            };

            const result = SegmentService.getBerthOccupancyTimeline(mockTrainState, 'S1', 15);

            expect(result).toHaveLength(3);
            result.forEach(segment => {
                expect(segment.occupied).toBe(false);
                expect(segment.passengerName).toBeNull();
            });
        });
    });

    describe('getVacancyMatrix', () => {
        it('should return vacancy matrix for all coaches', () => {
            const mockTrainState = {
                coaches: [
                    {
                        coachNo: 'S1',
                        class: 'SL',
                        berths: [
                            {
                                berthNo: 1,
                                fullBerthNo: 'S1-1',
                                type: 'LB',
                                status: 'VACANT',
                                getSegmentOccupancy: jest.fn().mockReturnValue([null, null])
                            },
                            {
                                berthNo: 2,
                                fullBerthNo: 'S1-2',
                                type: 'MB',
                                status: 'OCCUPIED',
                                getSegmentOccupancy: jest.fn().mockReturnValue(['P001', 'P001'])
                            }
                        ]
                    }
                ]
            };

            const result = SegmentService.getVacancyMatrix(mockTrainState);

            expect(result).toHaveLength(1);
            expect(result[0].coachNo).toBe('S1');
            expect(result[0].berths).toHaveLength(2);
            expect(result[0].berths[0].berthNo).toBe(1);
        });

        it('should handle multiple coaches', () => {
            const mockTrainState = {
                coaches: [
                    {
                        coachNo: 'S1',
                        class: 'SL',
                        berths: [
                            { berthNo: 1, fullBerthNo: 'S1-1', type: 'LB', status: 'VACANT', getSegmentOccupancy: jest.fn().mockReturnValue([]) }
                        ]
                    },
                    {
                        coachNo: 'S2',
                        class: 'SL',
                        berths: [
                            { berthNo: 1, fullBerthNo: 'S2-1', type: 'LB', status: 'VACANT', getSegmentOccupancy: jest.fn().mockReturnValue([]) }
                        ]
                    }
                ]
            };

            const result = SegmentService.getVacancyMatrix(mockTrainState);

            expect(result).toHaveLength(2);
            expect(result[0].coachNo).toBe('S1');
            expect(result[1].coachNo).toBe('S2');
        });

        it('should handle empty coaches', () => {
            const mockTrainState = { coaches: [] };

            const result = SegmentService.getVacancyMatrix(mockTrainState);

            expect(result).toEqual([]);
        });
    });

    describe('getSegmentVacancy', () => {
        it('should return vacant berths for segment', () => {
            const mockTrainState = {
                coaches: [
                    {
                        coachNo: 'S1',
                        berths: [
                            {
                                berthNo: 1,
                                fullBerthNo: 'S1-1',
                                type: 'LB',
                                segmentOccupancy: [null, 'P001', null]
                            },
                            {
                                berthNo: 2,
                                fullBerthNo: 'S1-2',
                                type: 'MB',
                                segmentOccupancy: [null, null, null]
                            }
                        ]
                    }
                ],
                segmentMatrix: {
                    segments: [
                        { from: 'A', to: 'B' },
                        { from: 'B', to: 'C' },
                        { from: 'C', to: 'D' }
                    ]
                }
            };

            const result = SegmentService.getSegmentVacancy(mockTrainState, 0);

            expect(result.segmentId).toBe(0);
            expect(result.vacantCount).toBe(2);
            expect(result.vacantBerths).toHaveLength(2);
        });

        it('should return empty array when no vacancies for segment', () => {
            const mockTrainState = {
                coaches: [
                    {
                        coachNo: 'S1',
                        berths: [
                            {
                                berthNo: 1,
                                segmentOccupancy: ['P001', 'P002']
                            }
                        ]
                    }
                ],
                segmentMatrix: {
                    segments: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }]
                }
            };

            const result = SegmentService.getSegmentVacancy(mockTrainState, 0);

            expect(result.vacantCount).toBe(0);
            expect(result.vacantBerths).toEqual([]);
        });

        it('should include segment details', () => {
            const mockTrainState = {
                coaches: [],
                segmentMatrix: {
                    segments: [{ from: 'Station A', to: 'Station B' }]
                }
            };

            const result = SegmentService.getSegmentVacancy(mockTrainState, 0);

            expect(result.segment).toEqual({ from: 'Station A', to: 'Station B' });
        });
    });
});
