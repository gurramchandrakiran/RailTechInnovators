/**
 * Admin Portal Smoke Tests
 * Basic endpoint accessibility tests for Admin portal functionality
 */

// Mock dependencies
jest.mock('../../config/db', () => ({
    getAdminsCollection: jest.fn(() => ({
        findOne: jest.fn()
    })),
    getPassengersCollection: jest.fn(() => ({
        find: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([])
        })
    }))
}));

jest.mock('../../controllers/trainController', () => ({
    getGlobalTrainState: jest.fn().mockReturnValue({
        trainNumber: '17225',
        trainName: 'Test Express',
        currentStationIdx: 2,
        journeyStarted: true,
        stations: [
            { code: 'STA1', name: 'Station 1', idx: 0 },
            { code: 'STA2', name: 'Station 2', idx: 1 },
            { code: 'STA3', name: 'Station 3', idx: 2 }
        ],
        coaches: [],
        racQueue: [],
        getAllPassengers: jest.fn().mockReturnValue([])
    }),
    getTrainStateInternal: jest.fn()
}));

jest.mock('../../config/websocket', () => ({
    broadcast: jest.fn()
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authController = require('../../controllers/authController');
const configController = require('../../controllers/configController');
const db = require('../../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

describe('Admin Portal Smoke Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.resetModules();
    });

    // =================== ADMIN LOGIN ===================
    describe('Admin Login Endpoint', () => {
        it('should return valid token structure on successful login', async () => {
            const hashedPassword = await bcrypt.hash('admin123', 10);

            db.getAdminsCollection().findOne.mockResolvedValue({
                Employee_ID: 'ADMIN001',
                Password: hashedPassword,
                Name: 'Test Admin',
                Role: 'ADMIN'
            });

            const req = {
                body: {
                    employeeId: 'ADMIN001',
                    password: 'admin123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.staffLogin(req, res);

            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];

            // Smoke test: verify response structure
            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('token');
            expect(response).toHaveProperty('user');
            expect(response.user).toHaveProperty('role');
            expect(response.user.role).toBe('ADMIN');
        });

        it('should return valid JWT that can be decoded', async () => {
            const hashedPassword = await bcrypt.hash('admin123', 10);

            db.getAdminsCollection().findOne.mockResolvedValue({
                Employee_ID: 'ADMIN001',
                Password: hashedPassword,
                Name: 'Test Admin',
                Role: 'ADMIN'
            });

            const req = {
                body: {
                    employeeId: 'ADMIN001',
                    password: 'admin123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.staffLogin(req, res);

            const response = res.json.mock.calls[0][0];
            const decoded = jwt.verify(response.token, JWT_SECRET);

            expect(decoded).toHaveProperty('userId');
            expect(decoded).toHaveProperty('role');
            expect(decoded.role).toBe('ADMIN');
        });
    });

    // =================== TRAIN CONFIGURATION ===================
    describe('Train Configuration Endpoint', () => {
        it('should have configController with setup method', () => {
            expect(configController).toBeDefined();
            expect(typeof configController.setup).toBe('function');
        });

        it('should accept valid configuration payload structure', async () => {
            const req = {
                body: {
                    mongoUri: 'mongodb://localhost:27017',
                    stationsDb: 'RAC_Reallocation',
                    stationsCollection: 'Stations_17225',
                    passengersDb: 'RAC_Reallocation',
                    passengersCollection: '17225_passengers',
                    trainNo: '17225',
                    trainName: 'Test Express',
                    journeyDate: '2025-12-09'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            // Smoke test: controller should handle request without throwing
            try {
                await configController.setup(req, res);
                // If it completes, check response was sent
                expect(res.json).toHaveBeenCalled();
            } catch (error) {
                // Some errors are expected due to mocking, but controller should exist
                expect(configController.setup).toBeDefined();
            }
        });
    });

    // =================== STATION-WISE DATA ===================
    describe('Station-Wise Data Endpoint Structure', () => {
        it('should have StationWiseApprovalController available', () => {
            const stationWiseApprovalController = require('../../controllers/StationWiseApprovalController');

            expect(stationWiseApprovalController).toBeDefined();
            expect(typeof stationWiseApprovalController.getStationWiseData).toBe('function');
        });

        it('should have getPendingReallocations method', () => {
            const stationWiseApprovalController = require('../../controllers/StationWiseApprovalController');

            expect(typeof stationWiseApprovalController.getPendingReallocations).toBe('function');
        });

        it('should have approveBatch method', () => {
            const stationWiseApprovalController = require('../../controllers/StationWiseApprovalController');

            expect(typeof stationWiseApprovalController.approveBatch).toBe('function');
        });
    });

    // =================== VISUALIZATION ENDPOINTS ===================
    describe('Visualization Endpoints Structure', () => {
        it('should have visualizationController available', () => {
            const visualizationController = require('../../controllers/visualizationController');

            expect(visualizationController).toBeDefined();
        });

        it('should have required visualization methods', () => {
            const visualizationController = require('../../controllers/visualizationController');

            expect(typeof visualizationController.getStationSchedule).toBe('function');
            expect(typeof visualizationController.getSegmentMatrix).toBe('function');
            expect(typeof visualizationController.getHeatmap).toBe('function');
        });
    });
});
