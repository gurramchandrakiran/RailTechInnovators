/**
 * VisualizationService Tests - Focused on actual methods
 */

const VisualizationService = require('../../services/VisualizationService');

describe('VisualizationService', () => {
    let mockTrainState;

    beforeEach(() => {
        mockTrainState = {
            stations: [
                { sno: 1, code: 'STA', name: 'Station A', idx: 0, arrival: '-', departure: '10:00', halt: 0, distance: 0, day: 1, zone: 'SCR', division: 'Vijayawada', platform: '1', remarks: '-' },
                { sno: 2, code: 'STB', name: 'Station B', idx: 1, arrival: '11:00', departure: '11:05', halt: 5, distance: 50, day: 1, zone: 'SCR', division: 'Vijayawada', platform: '2', remarks: '-' },
                { sno: 3, code: 'STC', name: 'Station C', idx: 2, arrival: '12:00', departure: '-', halt: 0, distance: 100, day: 1, zone: 'SCR', division: 'Vijayawada', platform: '3', remarks: 'Destination' }
            ],
            segmentMatrix: {
                segments: [
                    { name: 'STA-STB', from: 0, to: 1 },
                    { name: 'STB-STC', from: 1, to: 2 }
                ]
            },
            coaches: [
                {
                    coachNo: 'S1',
                    berths: [
                        {
                            fullBerthNo: 'S1-1',
                            type: 'LB',
                            segmentOccupancy: [['P001'], []],
                            passengers: [{ pnr: 'P001', name: 'John' }]
                        },
                        {
                            fullBerthNo: 'S1-2',
                            type: 'MB',
                            segmentOccupancy: [[], []],
                            passengers: []
                        }
                    ]
                },
                {
                    coachNo: 'S2',
                    berths: [
                        {
                            berthNo: 1,
                            fullBerthNo: 'S2-1',
                            type: 'UB',
                            segmentOccupancy: [['P002'], ['P002']],
                            passengers: [{ pnr: 'P002', name: 'Jane' }]
                        }
                    ]
                }
            ]
        };
    });

    describe('generateSegmentMatrixData', () => {
        it('should generate segment matrix with stations, segments, and matrix', () => {
            const result = VisualizationService.generateSegmentMatrixData(mockTrainState);

            expect(result).toBeDefined();
            expect(result.stations).toHaveLength(3);
            expect(result.segments).toHaveLength(2);
            expect(result.matrix).toBeDefined();
        });

        it('should map station details correctly', () => {
            const result = VisualizationService.generateSegmentMatrixData(mockTrainState);

            expect(result.stations[0]).toMatchObject({
                sno: 1,
                code: 'STA',
                name: 'Station A'
            });
        });

        it('should create matrix rows for berths', () => {
            const result = VisualizationService.generateSegmentMatrixData(mockTrainState);

            expect(result.matrix).toHaveLength(3);
            expect(result.matrix[0].berth).toBe('S1-1');
        });

        it('should map segment occupancy', () => {
            const result = VisualizationService.generateSegmentMatrixData(mockTrainState);

            expect(result.matrix[0].segments[0].occupied).toBe(true);
            expect(result.matrix[0].segments[0].pnr).toBe('P001');
        });
    });

    describe('generateGraphData', () => {
        it('should generate nodes for stations', () => {
            const result = VisualizationService.generateGraphData(mockTrainState);

            expect(result.nodes).toHaveLength(3);
            expect(result.nodes[0].id).toBe('station-0');
            expect(result.nodes[0].label).toBe('STA');
        });

        it('should generate edges between stations', () => {
            const result = VisualizationService.generateGraphData(mockTrainState);

            expect(result.edges).toHaveLength(2);
            expect(result.edges[0].source).toBe('station-0');
            expect(result.edges[0].target).toBe('station-1');
        });

        it('should include vacant berths in edge data', () => {
            const result = VisualizationService.generateGraphData(mockTrainState);

            expect(result.edges[0].data.vacantBerths).toBeDefined();
        });
    });

    describe('getVacantBerthsForSegment', () => {
        it('should count vacant berths', () => {
            const count = VisualizationService.getVacantBerthsForSegment(mockTrainState, 0);

            expect(count).toBe(1);
        });

        it('should return 0 for fully occupied segment', () => {
            mockTrainState.coaches.forEach(coach => {
                coach.berths.forEach(berth => {
                    berth.segmentOccupancy[1] = ['P999'];
                });
            });

            const count = VisualizationService.getVacantBerthsForSegment(mockTrainState, 1);

            expect(count).toBe(0);
        });
    });

    describe('generateHeatmapData', () => {
        it('should generate heatmap for all coaches', () => {
            const result = VisualizationService.generateHeatmapData(mockTrainState);

            expect(result).toHaveLength(2);
            expect(result[0].coach).toBe('S1');
        });

        it('should include occupancy data', () => {
            const result = VisualizationService.generateHeatmapData(mockTrainState);

            expect(result[0].data).toHaveLength(2);
            expect(result[0].data[0]).toMatchObject({
                occupancy: expect.any(Number),
                color: expect.any(String)
            });
        });
    });

    describe('calculateOccupancyPercentage', () => {
        it('should calculate percentage correctly', () => {
            const berth = {
                segmentOccupancy: [['P001'], [], []]
            };

            const percentage = VisualizationService.calculateOccupancyPercentage(berth);

            expect(percentage).toBeCloseTo(33.33, 1);
        });

        it('should return 100 for fully occupied', () => {
            const berth = {
                segmentOccupancy: [['P001'], ['P001']]
            };

            const percentage = VisualizationService.calculateOccupancyPercentage(berth);

            expect(percentage).toBe(100);
        });

        it('should return 0 for vacant', () => {
            const berth = {
                segmentOccupancy: [[], [], []]
            };

            const percentage = VisualizationService.calculateOccupancyPercentage(berth);

            expect(percentage).toBe(0);
        });
    });

    describe('getHeatmapColor', () => {
        it('should return green for 0%', () => {
            expect(VisualizationService.getHeatmapColor(0)).toBe('#e8f5e9');
        });

        it('should return yellow for <50%', () => {
            expect(VisualizationService.getHeatmapColor(25)).toBe('#fff9c4');
        });

        it('should return orange for <100%', () => {
            expect(VisualizationService.getHeatmapColor(75)).toBe('#ffccbc');
        });

        it('should return red for 100%', () => {
            expect(VisualizationService.getHeatmapColor(100)).toBe('#f44336');
        });
    });
});
