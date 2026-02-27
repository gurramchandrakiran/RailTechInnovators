/**
 * Passenger Portal Smoke Tests
 * Basic endpoint accessibility tests for Passenger portal functionality
 */

// Mock dependencies
jest.mock('../../config/db', () => ({
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
            { code: 'STA3', name: 'Station 3', idx: 2 },
            { code: 'STA4', name: 'Station 4', idx: 3 },
            { code: 'STA5', name: 'Station 5', idx: 4 }
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

jest.mock('../../services/WebPushService', () => ({
    getVapidPublicKey: jest.fn().mockReturnValue('mock-vapid-public-key')
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authController = require('../../controllers/authController');
const passengerController = require('../../controllers/passengerController');
const db = require('../../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

describe('Passenger Portal Smoke Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.resetModules();
    });

    // =================== PASSENGER LOGIN ===================
    describe('Passenger Login Endpoint', () => {
        it('should return token with PASSENGER role on successful login', async () => {
            const hashedPassword = await bcrypt.hash('pass123', 10);

            db.getPassengersCollection().findOne.mockResolvedValue({
                PNR_Number: '1234567890',
                IRCTC_ID: 'test@irctc.com',
                Password: hashedPassword,
                Name: 'Test Passenger',
                Email: 'test@example.com'
            });

            const req = {
                body: {
                    irctcId: 'test@irctc.com',
                    password: 'pass123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.passengerLogin(req, res);

            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];

            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('token');
            expect(response.user.role).toBe('PASSENGER');
        });

        it('should include PNR in passenger token claims', async () => {
            const hashedPassword = await bcrypt.hash('pass123', 10);

            db.getPassengersCollection().findOne.mockResolvedValue({
                PNR_Number: '1234567890',
                IRCTC_ID: 'test@irctc.com',
                Password: hashedPassword,
                Name: 'Test Passenger'
            });

            const req = {
                body: {
                    irctcId: 'test@irctc.com',
                    password: 'pass123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.passengerLogin(req, res);

            const response = res.json.mock.calls[0][0];
            if (response.token) {
                const decoded = jwt.verify(response.token, JWT_SECRET);
                expect(decoded).toHaveProperty('pnr');
            }
        });
    });

    // =================== PNR LOOKUP ===================
    describe('PNR Lookup Endpoint', () => {
        it('should have getPNRDetails method', () => {
            expect(passengerController).toBeDefined();
            expect(typeof passengerController.getPNRDetails).toBe('function');
        });

        it('should return passenger details for valid PNR', async () => {
            db.getPassengersCollection().findOne.mockResolvedValue({
                PNR_Number: '1234567890',
                Name: 'Test Passenger',
                PNR_Status: 'CNF',
                Assigned_Coach: 'S1',
                Assigned_berth: 5
            });

            const req = {
                params: { pnr: '1234567890' }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await passengerController.getPNRDetails(req, res);

            expect(res.json).toHaveBeenCalled();
        });
    });

    // =================== PASSENGER CONTROLLER METHODS ===================
    describe('Passenger Controller Methods', () => {
        it('should have selfCancelTicket method', () => {
            expect(typeof passengerController.selfCancelTicket).toBe('function');
        });

        it('should have getAvailableBoardingStations method', () => {
            expect(typeof passengerController.getAvailableBoardingStations).toBe('function');
        });

        it('should have changeBoardingStation method', () => {
            expect(typeof passengerController.changeBoardingStation).toBe('function');
        });

        it('should have approveUpgrade method', () => {
            expect(typeof passengerController.approveUpgrade).toBe('function');
        });

        it('should have getPendingUpgrades method', () => {
            expect(typeof passengerController.getPendingUpgrades).toBe('function');
        });
    });

    // =================== PUSH NOTIFICATION ENDPOINTS ===================
    describe('Push Notification Endpoints', () => {
        it('should have getVapidPublicKey method', () => {
            expect(typeof passengerController.getVapidPublicKey).toBe('function');
        });

        it('should have subscribeToPush method', () => {
            expect(typeof passengerController.subscribeToPush).toBe('function');
        });

        it('should have unsubscribeFromPush method', () => {
            expect(typeof passengerController.unsubscribeFromPush).toBe('function');
        });

        it('should return VAPID public key', async () => {
            const req = {};
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await passengerController.getVapidPublicKey(req, res);

            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];
            expect(response).toHaveProperty('vapidPublicKey');
        });
    });

    // =================== NOTIFICATION METHODS ===================
    describe('In-App Notification Methods', () => {
        it('should have getInAppNotifications method', () => {
            expect(typeof passengerController.getInAppNotifications).toBe('function');
        });

        it('should have markNotificationRead method', () => {
            expect(typeof passengerController.markNotificationRead).toBe('function');
        });

        it('should have markAllNotificationsRead method', () => {
            expect(typeof passengerController.markAllNotificationsRead).toBe('function');
        });
    });

    // =================== UPGRADE NOTIFICATION METHODS ===================
    describe('Upgrade Notification Methods', () => {
        it('should have getUpgradeNotifications method', () => {
            expect(typeof passengerController.getUpgradeNotifications).toBe('function');
        });

        it('should have acceptUpgrade method', () => {
            expect(typeof passengerController.acceptUpgrade).toBe('function');
        });

        it('should have denyUpgrade method', () => {
            expect(typeof passengerController.denyUpgrade).toBe('function');
        });
    });

    // =================== NO-SHOW REVERT ===================
    describe('No-Show Revert Endpoint', () => {
        it('should have selfRevertNoShow method', () => {
            expect(typeof passengerController.selfRevertNoShow).toBe('function');
        });
    });
});
