/**
 * Auth Flow Integration Tests
 * Tests authentication for Admin, TTE, and Passenger users
 */

// Create mock collections
const mockTTEUsersCollection = {
    findOne: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
};

const mockPassengerAccountsCollection = {
    findOne: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
};

const mockPassengersCollection = {
    findOne: jest.fn(),
    find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
    })
};

// Mock dependencies before requiring modules
jest.mock('../../config/db', () => ({
    getAdminsCollection: jest.fn(() => ({
        findOne: jest.fn()
    })),
    getTTECollection: jest.fn(() => ({
        findOne: jest.fn()
    })),
    getPassengersCollection: jest.fn(() => mockPassengersCollection),
    getDb: jest.fn().mockResolvedValue({
        collection: jest.fn((name) => {
            if (name === 'passenger_accounts') {
                return mockPassengerAccountsCollection;
            }
            if (name === 'tte_users') {
                return mockTTEUsersCollection;
            }
            return mockPassengersCollection;
        })
    })
}));

// Mock RefreshTokenService for auth tests
jest.mock('../../services/RefreshTokenService', () => ({
    createRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token-12345'),
    validateRefreshToken: jest.fn().mockResolvedValue(null),
    revokeRefreshToken: jest.fn().mockResolvedValue(true),
    revokeAllUserTokens: jest.fn().mockResolvedValue(1)
}));

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const authController = require('../../controllers/authController');
const { authMiddleware, requireRole } = require('../../middleware/auth');
const db = require('../../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

describe('Auth Flow Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.resetModules();
    });

    // =================== STAFF LOGIN TESTS ===================
    describe('Staff Login (Admin/TTE)', () => {
        it('should return token for valid Admin credentials', async () => {
            const hashedPassword = await bcrypt.hash('admin123', 10);

            // Mock tte_users collection (used by staffLogin for all staff)
            mockTTEUsersCollection.findOne.mockResolvedValue({
                employeeId: 'ADMIN001',
                passwordHash: hashedPassword,
                name: 'Test Admin',
                role: 'ADMIN',
                active: true
            });

            const req = {
                body: {
                    employeeId: 'ADMIN001',
                    password: 'admin123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis(),
                cookie: jest.fn()
            };

            await authController.staffLogin(req, res);

            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];
            expect(response.success).toBe(true);
            expect(response.token).toBeDefined();
            expect(response.user.role).toBe('ADMIN');
        });

        it('should return token for valid TTE credentials', async () => {
            const hashedPassword = await bcrypt.hash('tte123', 10);

            mockTTEUsersCollection.findOne.mockResolvedValue({
                employeeId: 'TTE001',
                passwordHash: hashedPassword,
                name: 'Test TTE',
                role: 'TTE',
                active: true
            });

            const req = {
                body: {
                    employeeId: 'TTE001',
                    password: 'tte123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis(),
                cookie: jest.fn()
            };

            await authController.staffLogin(req, res);

            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];
            expect(response.success).toBe(true);
            expect(response.token).toBeDefined();
            expect(response.user.role).toBe('TTE');
        });

        it('should reject invalid credentials', async () => {
            // User not found in tte_users collection
            mockTTEUsersCollection.findOne.mockResolvedValue(null);

            const req = {
                body: {
                    employeeId: 'INVALID',
                    password: 'wrongpassword'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.staffLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 400 for missing credentials', async () => {
            const req = { body: {} };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.staffLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    // =================== PASSENGER LOGIN TESTS ===================
    describe('Passenger Login', () => {
        it('should return token for valid passenger with IRCTC ID', async () => {
            const hashedPassword = await bcrypt.hash('pass123', 10);

            // Mock passenger_accounts collection (used by passengerLogin)
            mockPassengerAccountsCollection.findOne.mockResolvedValue({
                IRCTC_ID: 'test@irctc.com',
                passwordHash: hashedPassword,
                name: 'Test Passenger',
                email: 'test@example.com',
                active: true
            });

            const req = {
                body: {
                    irctcId: 'test@irctc.com',
                    password: 'pass123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis(),
                cookie: jest.fn()
            };

            await authController.passengerLogin(req, res);

            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];
            expect(response.success).toBe(true);
            expect(response.token).toBeDefined();
            expect(response.user.role).toBe('PASSENGER');
        });

        it('should reject invalid passenger credentials', async () => {
            // Mock passenger not found
            mockPassengerAccountsCollection.findOne.mockResolvedValue(null);

            const req = {
                body: {
                    irctcId: 'invalid@irctc.com',
                    password: 'wrongpassword'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.passengerLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should reject inactive passenger account', async () => {
            const hashedPassword = await bcrypt.hash('pass123', 10);

            mockPassengerAccountsCollection.findOne.mockResolvedValue({
                IRCTC_ID: 'inactive@irctc.com',
                passwordHash: hashedPassword,
                name: 'Inactive User',
                active: false
            });

            const req = {
                body: {
                    irctcId: 'inactive@irctc.com',
                    password: 'pass123'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.passengerLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should reject wrong password', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);

            mockPassengerAccountsCollection.findOne.mockResolvedValue({
                IRCTC_ID: 'test@irctc.com',
                passwordHash: hashedPassword,
                name: 'Test User',
                active: true
            });

            const req = {
                body: {
                    irctcId: 'test@irctc.com',
                    password: 'wrongpassword'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.passengerLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    // =================== AUTH MIDDLEWARE TESTS ===================
    describe('Auth Middleware', () => {
        it('should attach user to request for valid token', () => {
            const token = jwt.sign(
                { userId: 'TEST001', role: 'ADMIN' },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const req = {
                headers: { authorization: `Bearer ${token}` }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const next = jest.fn();

            authMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user.userId).toBe('TEST001');
            expect(req.user.role).toBe('ADMIN');
        });

        it('should reject request without token', () => {
            const req = { headers: {} };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const next = jest.fn();

            authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject expired token', () => {
            const token = jwt.sign(
                { userId: 'TEST001', role: 'ADMIN' },
                JWT_SECRET,
                { expiresIn: '-1h' } // Already expired
            );

            const req = {
                headers: { authorization: `Bearer ${token}` }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const next = jest.fn();

            authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject invalid token', () => {
            const req = {
                headers: { authorization: 'Bearer invalid.token.here' }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const next = jest.fn();

            authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
    });

    // =================== ROLE-BASED ACCESS TESTS ===================
    describe('Role-Based Access Control', () => {
        it('should allow access for matching role', () => {
            const req = { user: { role: 'ADMIN' } };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const next = jest.fn();

            const middleware = requireRole(['ADMIN', 'TTE']);
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny access for non-matching role', () => {
            const req = { user: { role: 'PASSENGER' } };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const next = jest.fn();

            const middleware = requireRole(['ADMIN', 'TTE']);
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('should deny access when no user attached', () => {
            const req = {};
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const next = jest.fn();

            const middleware = requireRole(['ADMIN']);
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
    });

    // =================== TOKEN VERIFICATION TESTS ===================
    describe('Token Verification', () => {
        it('should verify and return user info', async () => {
            const req = {
                user: {
                    userId: 'ADMIN001',
                    role: 'ADMIN',
                    name: 'Test Admin'
                }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            await authController.verifyToken(req, res);

            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];
            expect(response.success).toBe(true);
            expect(response.user.userId).toBe('ADMIN001');
        });
    });
});
