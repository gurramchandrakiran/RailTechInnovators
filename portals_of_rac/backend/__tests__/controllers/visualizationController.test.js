/**
 * visualizationController Tests
 * Tests based on ACTUAL implementation
 */

jest.mock('../../controllers/trainController');
jest.mock('../../services/VisualizationService');
jest.mock('../../services/SegmentService');
jest.mock('../../config/db');

const visualizationController = require('../../controllers/visualizationController');
const trainController = require('../../controllers/trainController');
const VisualizationService = require('../../services/VisualizationService');
const SegmentService = require('../../services/SegmentService');
const db = require('../../config/db');

describe('visualizationController', () => {
    let req, res;
    let mockTrainState;

    beforeEach(() => {
        req = {
            params: {},
            query: {}
        };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        mockTrainState = {
            trainNo: '17225',
            trainName: 'Test Express',
            stations: [
                { sno: 1, code: 'BZA', name: 'Vijayawada' },
                { sno: 2, code: 'RJY', name: 'Rajahmundry' }
            ]
        };

        jest.clearAllMocks();
    });

    describe('getSegmentMatrix', () => {
        it('should return segment matrix successfully', () => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
            
            const mockMatrix = [
                { berth: 'S1-1', segments: [{ from: 'BZA', to: 'RJY' }] }
            ];
            VisualizationService.generateSegmentMatrixData.mockReturnValue(mockMatrix);

            visualizationController.getSegmentMatrix(req, res);

            expect(VisualizationService.generateSegmentMatrixData).toHaveBeenCalledWith(mockTrainState);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: mockMatrix
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            visualizationController.getSegmentMatrix(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Train not initialized'
                })
            );
        });

        it('should handle errors', () => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
            VisualizationService.generateSegmentMatrixData.mockImplementation(() => {
                throw new Error('Matrix generation failed');
            });

            visualizationController.getSegmentMatrix(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getGraphData', () => {
        it('should return graph data successfully', () => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
            
            const mockGraphData = {
                nodes: [],
                edges: []
            };
            VisualizationService.generateGraphData.mockReturnValue(mockGraphData);

            visualizationController.getGraphData(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: mockGraphData
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            visualizationController.getGraphData(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getHeatmap', () => {
        it('should return heatmap data successfully', () => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
            
            const mockHeatmap = {
                data: [[1, 2], [3, 4]]
            };
            VisualizationService.generateHeatmapData.mockReturnValue(mockHeatmap);

            visualizationController.getHeatmap(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: mockHeatmap
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            visualizationController.getHeatmap(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getBerthTimeline', () => {
        it('should return berth timeline successfully', () => {
            req.params = { coach: 'S1', berth: '10' };
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
            
            const mockTimeline = [
                { from: 'BZA', to: 'RJY', passenger: 'PNR001' }
            ];
            SegmentService.getBerthOccupancyTimeline.mockReturnValue(mockTimeline);

            visualizationController.getBerthTimeline(req, res);

            expect(SegmentService.getBerthOccupancyTimeline).toHaveBeenCalledWith(
                mockTrainState, 'S1', '10'
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        berth: 'S1-10',
                        timeline: mockTimeline
                    })
                })
            );
        });

        it('should return 404 if berth not found', () => {
            req.params = { coach: 'S1', berth: '99' };
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
            SegmentService.getBerthOccupancyTimeline.mockReturnValue(null);

            visualizationController.getBerthTimeline(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('not found')
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            req.params = { coach: 'S1', berth: '10' };
            trainController.getGlobalTrainState.mockReturnValue(null);

            visualizationController.getBerthTimeline(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getVacancyMatrix', () => {
        it('should return vacancy matrix successfully', () => {
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);
            
            const mockMatrix = [
                { coach: 'S1', vacancies: 10 }
            ];
            SegmentService.getVacancyMatrix.mockReturnValue(mockMatrix);

            visualizationController.getVacancyMatrix(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: mockMatrix
                })
            );
        });

        it('should return 400 if train not initialized', () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            visualizationController.getVacancyMatrix(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getStationSchedule', () => {
        it('should return station schedule from trainState', async () => {
            mockTrainState.stations = [
                {
                    sno: 1,
                    code: 'BZA',
                    name: 'Vijayawada',
                    arrival: '00:00',
                    departure: '10:00',
                    distance: 0,
                    day: 1,
                    halt: '0 min'
                }
            ];
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);

            await visualizationController.getStationSchedule(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        trainNo: '17225',
                        trainName: 'Test Express',
                        totalStations: 1,
                        stations: expect.any(Array)
                    })
                })
            );
        });

        it('should return 400 if train not initialized', async () => {
            trainController.getGlobalTrainState.mockReturnValue(null);

            await visualizationController.getStationSchedule(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('not initialized')
                })
            );
        });

        it('should fallback to database if trainState has no stations', async () => {
            mockTrainState.stations = [];
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);

            const mockStations = [
                {
                    SNO: 1,
                    Station_Code: 'BZA',
                    Station_Name: 'Vijayawada',
                    Arrival_Time: '00:00',
                    Departure_Time: '10:00'
                }
            ];

            db.getStationsCollection.mockReturnValue({
                find: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        toArray: jest.fn().mockResolvedValue(mockStations)
                    })
                })
            });

            await visualizationController.getStationSchedule(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        stations: expect.any(Array)
                    })
                })
            );
        });

        it('should return 404 if no stations found in database', async () => {
            mockTrainState.stations = [];
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);

            db.getStationsCollection.mockReturnValue({
                find: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        toArray: jest.fn().mockResolvedValue([])
                    })
                })
            });

            await visualizationController.getStationSchedule(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should handle database errors', async () => {
            mockTrainState.stations = [];
            trainController.getGlobalTrainState.mockReturnValue(mockTrainState);

            db.getStationsCollection.mockImplementation(() => {
                throw new Error('Database connection failed');
            });

            await visualizationController.getStationSchedule(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});

// 15 tests for visualizationController
