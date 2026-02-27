/**
 * configController Tests - Comprehensive Coverage
 * Tests for configuration and database setup endpoints
 */

const configController = require('../../controllers/configController');
const db = require('../../config/db');

jest.mock('../../config/db');

describe('configController - Comprehensive Tests', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            body: {
                mongoUri: 'mongodb://localhost:27017',
                stationsDb: 'testStationsDb',
                stationsCollection: 'stations',
                passengersDb: 'testPassengersDb',
                passengersCollection: 'passengers',
                trainDetailsDb: 'testTrainDetailsDb',
                trainDetailsCollection: 'train_details',
                trainNo: '17225',
                trainName: 'Test Express',
                journeyDate: '2024-01-01'
            }
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        db.close = jest.fn().mockResolvedValue(undefined);
        db.connect = jest.fn().mockResolvedValue(undefined);
        db.getConfig = jest.fn().mockReturnValue({
            mongoUri: 'mongodb://localhost:27017',
            stationsDb: 'testStationsDb',
            stationsCollection: 'stations',
            passengersDb: 'testPassengersDb',
            passengersCollection: 'passengers',
            trainDetailsDb: 'testTrainDetailsDb',
            trainDetailsCollection: 'train_details',
            trainNo: '17225'
        });
    });

    describe('setup', () => {
        it('should setup configuration successfully', async () => {
            await configController.setup(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: 'Configuration applied and database connected'
                })
            );
        });

        it('should store config in global.RAC_CONFIG', async () => {
            await configController.setup(req, res);

            expect(global.RAC_CONFIG).toBeDefined();
            expect(global.RAC_CONFIG.trainNo).toBe('17225');
            expect(global.RAC_CONFIG.trainName).toBe('Test Express');
        });

        it('should close existing database connection', async () => {
            await configController.setup(req, res);

            expect(db.close).toHaveBeenCalled();
        });

        it('should connect to database with new config', async () => {
            await configController.setup(req, res);

            expect(db.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    mongoUri: 'mongodb://localhost:27017',
                    trainNo: '17225'
                })
            );
        });

        it('should return config data in response', async () => {
            await configController.setup(req, res);

            const response = res.json.mock.calls[0][0];
            expect(response.data).toHaveProperty('mongoUri');
            expect(response.data).toHaveProperty('trainNo');
            expect(response.data).toHaveProperty('trainName');
        });

        it('should handle missing passengersDb by using stationsDb', async () => {
            req.body.passengersDb = undefined;

            await configController.setup(req, res);

            expect(global.RAC_CONFIG.passengersDb).toBe('testStationsDb');
        });

        it('should handle database close error gracefully', async () => {
            db.close.mockRejectedValue(new Error('Not connected'));

            await configController.setup(req, res);

            expect(db.connect).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });

        it('should handle database connection error', async () => {
            db.connect.mockRejectedValue(new Error('Connection failed'));

            await configController.setup(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Connection failed'
                })
            );
        });

        it('should preserve all config fields', async () => {
            await configController.setup(req, res);

            expect(global.RAC_CONFIG).toMatchObject({
                mongoUri: 'mongodb://localhost:27017',
                stationsDb: 'testStationsDb',
                stationsCollection: 'stations',
                passengersDb: 'testPassengersDb',
                passengersCollection: 'passengers',
                trainDetailsDb: 'testTrainDetailsDb',
                trainDetailsCollection: 'train_details',
                trainNo: '17225',
                trainName: 'Test Express',
                journeyDate: '2024-01-01'
            });
        });

        it('should handle minimal configuration', async () => {
            req.body = {
                mongoUri: 'mongodb://localhost:27017',
                stationsDb: 'db1',
                stationsCollection: 'stations',
                passengersCollection: 'passengers',
                trainDetailsCollection: 'details',
                trainNo: '12345'
            };

            await configController.setup(req, res);

            expect(global.RAC_CONFIG.passengersDb).toBe('db1');
        });

        it('should call getConfig to retrieve active configuration', async () => {
            await configController.setup(req, res);

            expect(db.getConfig).toHaveBeenCalled();
        });

        it('should include journey date in response', async () => {
            await configController.setup(req, res);

            const response = res.json.mock.calls[0][0];
            expect(response.data.journeyDate).toBe('2024-01-01');
        });

        it('should handle empty passengersDb field', async () => {
            req.body.passengersDb = '';

            await configController.setup(req, res);

            expect(global.RAC_CONFIG.passengersDb).toBe('testStationsDb');
        });

        it('should handle null passengersDb field', async () => {
            req.body.passengersDb = null;

            await configController.setup(req, res);

            expect(global.RAC_CONFIG.passengersDb).toBe('testStationsDb');
        });
    });
});
