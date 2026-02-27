/**
 * authController Tests
 * Tests based on ACTUAL implementation
 * Handles staff and passenger authentication
 */

// Mock dependencies BEFORE requiring controller
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../config/db');
jest.mock('../../services/RefreshTokenService');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authController = require('../../controllers/authController');
const db = require('../../config/db');
const RefreshTokenService = require('../../services/RefreshTokenService');

describe('authController', () => {
    let req, res;

    beforeEach(() => {
        // Reset request and response objects
        req = {
            body: {},
            user: null
        };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            cookie: jest.fn()
        };

        // Set test environment
        process.env.NODE_ENV = 'test';

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('staffLogin', () => {
        it('should login staff user with valid credentials', async () => {
            req.body = {
                employeeId: 'ADMIN_01',
                password: 'password123'
            };

            const mockUser = {
                employeeId: 'ADMIN_01',
                name: 'Admin User',
                email: 'admin@railway.com',
                role: 'ADMIN',
                trainAssigned: '17225',
                permissions: ['all'],
                passwordHash: 'hashed_password',
                active: true
            };

            const mockCollection = {
                findOne: jest.fn().mockResolvedValue(mockUser),
                updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
            };

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockCollection)
            });

            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('mock_access_token');
            RefreshTokenService.createRefreshToken.mockResolvedValue('mock_refresh_token');

            await authController.staffLogin(req, res);

            expect(mockCollection.findOne).toHaveBeenCalledWith({ employeeId: 'ADMIN_01' });
            expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
            expect(jwt.sign).toHaveBeenCalled();
            expect(res.cookie).toHaveBeenCalledTimes(2); // accessToken and refreshToken
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: 'Login successful',
                    token: 'mock_access_token',
                    user: expect.objectContaining({
                        employeeId: 'ADMIN_01',
                        role: 'ADMIN'
                    })
                })
            );
        });

        it('should return 400 if employeeId is missing', async () => {
            req.body = { password: 'password123' };

            await authController.staffLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining('required')
                })
            );
        });

        it('should return 400 if password is missing', async () => {
            req.body = { employeeId: 'ADMIN_01' };

            await authController.staffLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 401 for invalid employee ID', async () => {
            req.body = {
                employeeId: 'INVALID',
                password: 'password123'
            };

            const mockCollection = {
                findOne: jest.fn().mockResolvedValue(null)
            };

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockCollection)
            });

            await authController.staffLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Invalid credentials'
                })
            );
        });

        it('should return 403 if account is deactivated', async () => {
            req.body = {
                employeeId: 'ADMIN_01',
                password: 'password123'
            };

            const mockUser = {
                employeeId: 'ADMIN_01',
                active: false
            };

            const mockCollection = {
                findOne: jest.fn().mockResolvedValue(mockUser)
            };

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockCollection)
            });

            await authController.staffLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('deactivated')
                })
            );
        });

        it('should return 401 for invalid password', async () => {
            req.body = {
                employeeId: 'ADMIN_01',
                password: 'wrong_password'
            };

            const mockUser = {
                employeeId: 'ADMIN_01',
                passwordHash: 'hashed_password',
                active: true
            };

            const mockCollection = {
                findOne: jest.fn().mockResolvedValue(mockUser)
            };

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockCollection)
            });

            bcrypt.compare.mockResolvedValue(false);

            await authController.staffLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should update lastLogin timestamp', async () => {
            req.body = {
                employeeId: 'ADMIN_01',
                password: 'password123'
            };

            const mockUser = {
                employeeId: 'ADMIN_01',
                passwordHash: 'hashed_password',
                active: true,
                role: 'ADMIN'
            };

            const mockCollection = {
                findOne: jest.fn().mockResolvedValue(mockUser),
                updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
            };

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockCollection)
            });

            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('token');
            RefreshTokenService.createRefreshToken.mockResolvedValue('refresh');

            await authController.staffLogin(req, res);

            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { employeeId: 'ADMIN_01' },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        lastLogin: expect.any(Date)
                    })
                })
            );
        });

        it('should set httpOnly cookies', async () => {
            req.body = {
                employeeId: 'ADMIN_01',
                password: 'password123'
            };

            const mockUser = {
                employeeId: 'ADMIN_01',
                passwordHash: 'hashed_password',
                active: true,
                role: 'ADMIN'
            };

            const mockCollection = {
                findOne: jest.fn().mockResolvedValue(mockUser),
                updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
            };

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockCollection)
            });

            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('token');
            RefreshTokenService.createRefreshToken.mockResolvedValue('refresh');

            await authController.staffLogin(req, res);

            expect(res.cookie).toHaveBeenCalledWith(
                'accessToken',
                'token',
                expect.objectContaining({
                    httpOnly: true,
                    sameSite: 'strict'
                })
            );

            expect(res.cookie).toHaveBeenCalledWith(
                'refreshToken',
                'refresh',
                expect.objectContaining({
                    httpOnly: true,
                    sameSite: 'strict'
                })
            );
        });
    });

    describe('passengerLogin', () => {
        it('should login passenger with valid IRCTC ID', async () => {
            req.body = {
                irctcId: 'TEST123',
                password: 'password123'
            };

            const mockUser = {
                IRCTC_ID: 'TEST123',
                name: 'Test Passenger',
                email: 'test@example.com',
                phone: '9876543210',
                passwordHash: 'hashed_password',
                active: true
            };

            const mockAccountsCollection = {
                findOne: jest.fn().mockResolvedValue(mockUser),
                updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
            };

            const mockTickets = [
                { PNR_Number: '1234567890', Train_Number: '17225', PNR_Status: 'CNF' }
            ];

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockAccountsCollection)
            });

            db.getPassengersCollection.mockReturnValue({
                find: jest.fn().mockReturnValue({
                    toArray: jest.fn().mockResolvedValue(mockTickets)
                })
            });

            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('mock_token');
            RefreshTokenService.createRefreshToken.mockResolvedValue('mock_refresh');

            await authController.passengerLogin(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    user: expect.objectContaining({
                        irctcId: 'TEST123',
                        role: 'PASSENGER'
                    }),
                    tickets: expect.arrayContaining([
                        expect.objectContaining({ pnr: '1234567890' })
                    ])
                })
            );
        });

        it('should login passenger with email', async () => {
            req.body = {
                email: 'test@example.com',
                password: 'password123'
            };

            const mockUser = {
                IRCTC_ID: 'TEST123',
                email: 'test@example.com',
                passwordHash: 'hashed_password',
                active: true
            };

            const mockAccountsCollection = {
                findOne: jest.fn().mockResolvedValue(mockUser),
                updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
            };

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockAccountsCollection)
            });

            db.getPassengersCollection.mockReturnValue({
                find: jest.fn().mockReturnValue({
                    toArray: jest.fn().mockResolvedValue([])
                })
            });

            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('token');
            RefreshTokenService.createRefreshToken.mockResolvedValue('refresh');

            await authController.passengerLogin(req, res);

            expect(mockAccountsCollection.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });

        it('should return 400 if password is missing', async () => {
            req.body = { irctcId: 'TEST123' };

            await authController.passengerLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if neither irctcId nor email provided', async () => {
            req.body = { password: 'password123' };

            await authController.passengerLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('IRCTC ID or email')
                })
            );
        });

        it('should return 401 for invalid credentials', async () => {
            req.body = {
                irctcId: 'INVALID',
                password: 'password123'
            };

            const mockCollection = {
                findOne: jest.fn().mockResolvedValue(null)
            };

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockCollection)
            });

            await authController.passengerLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 403 if passenger account is deactivated', async () => {
            req.body = {
                irctcId: 'TEST123',
                password: 'password123'
            };

            const mockUser = {
                IRCTC_ID: 'TEST123',
                active: false
            };

            const mockCollection = {
                findOne: jest.fn().mockResolvedValue(mockUser)
            };

            db.getDb.mockResolvedValue({
                collection: jest.fn().mockReturnValue(mockCollection)
            });

            await authController.passengerLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('verifyToken', () => {
        it('should verify valid token', async () => {
            req.user = {
                userId: 'ADMIN_01',
                role: 'ADMIN'
            };

            await authController.verifyToken(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    user: req.user
                })
            );
        });

        // Test removed - verifyToken doesn't have error handling logic to test
    });

    describe('logout', () => {
        it('should logout and revoke refresh token', async () => {
            req.body = { refreshToken: 'valid_refresh_token' };

            RefreshTokenService.revokeRefreshToken.mockResolvedValue(true);

            await authController.logout(req, res);

            expect(RefreshTokenService.revokeRefreshToken).toHaveBeenCalledWith('valid_refresh_token');
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining('Logged out')
                })
            );
        });

        it('should handle logout without refresh token', async () => {
            req.body = {};

            await authController.logout(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });

        it('should handle logout errors', async () => {
            req.body = { refreshToken: 'token' };

            RefreshTokenService.revokeRefreshToken.mockRejectedValue(new Error('Revoke failed'));

            await authController.logout(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('refresh', () => {
        it('should refresh access token with valid refresh token', async () => {
            req.body = { refreshToken: 'valid_refresh_token' };

            const mockStoredToken = {
                userId: 'ADMIN_01',
                role: 'ADMIN'
            };

            RefreshTokenService.validateRefreshToken.mockResolvedValue(mockStoredToken);
            jwt.sign.mockReturnValue('new_access_token');

            await authController.refresh(req, res);

            expect(RefreshTokenService.validateRefreshToken).toHaveBeenCalledWith('valid_refresh_token');
            expect(jwt.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'ADMIN_01',
                    role: 'ADMIN'
                }),
                expect.any(String),
                expect.any(Object)
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    token: 'new_access_token'
                })
            );
        });

        it('should return 400 if refresh token is missing', async () => {
            req.body = {};

            await authController.refresh(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('required')
                })
            );
        });

        it('should return 401 for invalid refresh token', async () => {
            req.body = { refreshToken: 'invalid_token' };

            RefreshTokenService.validateRefreshToken.mockResolvedValue(null);

            await authController.refresh(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('Invalid or expired')
                })
            );
        });

        it('should handle refresh errors', async () => {
            req.body = { refreshToken: 'token' };

            RefreshTokenService.validateRefreshToken.mockRejectedValue(new Error('Validation error'));

            await authController.refresh(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});

// 20 comprehensive tests for authController
