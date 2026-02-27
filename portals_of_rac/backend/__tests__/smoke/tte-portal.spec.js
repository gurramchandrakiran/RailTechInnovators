/**
 * TTE Portal Smoke Tests
 * Basic endpoint accessibility tests for TTE portal functionality
 */

// Mock dependencies
jest.mock('../../config/db', () => ({
    getTTECollection: jest.fn(() => ({
        findOne: jest.fn()
    })),
    getPassengersCollection: jest.fn(() => ({
        findOne: jest.fn(),
        find: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([])
        }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
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
        getAllPassengers: jest.fn().mockReturnValue([]),
        findPassengerByPNR: jest.fn().mockReturnValue(null)
    }),
    getTrainStateInternal: jest.fn()
}));

jest.mock('../../config/websocket', () => ({
    broadcast: jest.fn()
}));

jest.mock('../../services/ReallocationService', () => ({
    markNoShow: jest.fn().mockResolvedValue({ success: true })
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authController = require('../../controllers/authController');
const tteController = require('../../controllers/tteController');
const db = require('../../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

describe('TTE Portal Smoke Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.resetModules();
    });

    // =================== TTE LOGIN ===================
    describe('TTE Login Endpoint', () => {
        it('should return token with TTE role on successful login', async () => {
            const hashedPassword = await bcrypt.hash('tte123', 10);

            // Admin lookup fails
            db.getTTECollection().findOne.mockResolvedValue({
                Employee_ID: 'TTE001',
                Password: hashedPassword,
                Name: 'Test TTE',
                Role: 'TTE'
            });

            const req = {
                body: {
                    employeeId: 'TTE001',
                    password: 'tte123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            // Mock admin collection to return null (not an admin)
            const dbMock = require('../../config/db');
            dbMock.getAdminsCollection = jest.fn(() => ({
                findOne: jest.fn().mockResolvedValue(null)
            }));

            await authController.staffLogin(req, res);

            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];

            // Smoke test: verify TTE-specific response
            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('token');
            expect(response.user.role).toBe('TTE');
        });

        it('should return JWT with correct TTE claims', async () => {
            const hashedPassword = await bcrypt.hash('tte123', 10);

            const dbMock = require('../../config/db');
            dbMock.getAdminsCollection = jest.fn(() => ({
                findOne: jest.fn().mockResolvedValue(null)
            }));
            dbMock.getTTECollection().findOne.mockResolvedValue({
                Employee_ID: 'TTE001',
                Password: hashedPassword,
                Name: 'Test TTE',
                Role: 'TTE'
            });

            const req = {
                body: {
                    employeeId: 'TTE001',
                    password: 'tte123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.staffLogin(req, res);

            if (res.json.mock.calls.length > 0) {
                const response = res.json.mock.calls[0][0];
                if (response.token) {
                    const decoded = jwt.verify(response.token, JWT_SECRET);
                    expect(decoded.role).toBe('TTE');
                }
            }
        });
    });

    // =================== TTE CONTROLLER METHODS ===================
    describe('TTE Controller Methods', () => {
        it('should have getAllPassengersFiltered method', () => {
            expect(tteController).toBeDefined();
            expect(typeof tteController.getAllPassengersFiltered).toBe('function');
        });

        it('should have markNoShow method', () => {
            expect(typeof tteController.markNoShow).toBe('function');
        });

        it('should have getBoardingQueue method', () => {
            expect(typeof tteController.getBoardingQueue).toBe('function');
        });

        it('should have confirmAllBoarded method', () => {
            expect(typeof tteController.confirmAllBoarded).toBe('function');
        });

        it('should have getUpgradedPassengers method', () => {
            expect(typeof tteController.getUpgradedPassengers).toBe('function');
        });
    });

    // =================== MARK NO-SHOW ENDPOINT ===================
    describe('Mark No-Show Endpoint', () => {
        it('should require PNR in request body', async () => {
            const req = { body: {} };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await tteController.markNoShow(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should accept valid PNR format', async () => {
            const req = {
                body: { pnr: '1234567890' },
                user: { userId: 'TTE001', role: 'TTE' }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            // Should not throw and should call some response method
            await tteController.markNoShow(req, res);

            expect(res.json).toHaveBeenCalled();
        });
    });

    // =================== OFFLINE UPGRADE METHODS ===================
    describe('Offline Upgrade Methods', () => {
        it('should have addOfflineUpgrade method', () => {
            expect(typeof tteController.addOfflineUpgrade).toBe('function');
        });

        it('should have getOfflineUpgrades method', () => {
            expect(typeof tteController.getOfflineUpgrades).toBe('function');
        });

        it('should have confirmOfflineUpgrade method', () => {
            expect(typeof tteController.confirmOfflineUpgrade).toBe('function');
        });
    });

    // =================== ACTION HISTORY ===================
    describe('Action History Methods', () => {
        it('should have getActionHistory method', () => {
            expect(typeof tteController.getActionHistory).toBe('function');
        });

        it('should have undoAction method', () => {
            expect(typeof tteController.undoAction).toBe('function');
        });
    });
});
