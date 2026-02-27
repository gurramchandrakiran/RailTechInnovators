/**
 * otpController Tests
 * Tests based on ACTUAL implementation
 */

jest.mock('../../services/OTPService');
jest.mock('../../config/db');

const otpController = require('../../controllers/otpController');
const OTPService = require('../../services/OTPService');
const db = require('../../config/db');

describe('otpController', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {}
        };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
    });

    describe('sendOTP', () => {
        it('should send OTP successfully', async () => {
            req.body = {
                irctcId: 'TEST123',
                pnr: '1234567890',
                purpose: 'ticket cancellation'
            };

            const mockPassenger = {
                PNR_Number: '1234567890',
                IRCTC_ID: 'TEST123',
                Email: 'test@example.com'
            };

            db.getPassengersCollection.mockReturnValue({
                findOne: jest.fn().mockResolvedValue(mockPassenger)
            });

            OTPService.sendOTP.mockResolvedValue({
                success: true,
                expiresIn: 300
            });

            await otpController.sendOTP(req, res);

            expect(OTPService.sendOTP).toHaveBeenCalledWith(
                'TEST123',
                '1234567890',
                'test@example.com',
                'ticket cancellation'
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining('OTP sent'),
                    expiresIn: 300
                })
            );
        });

        it('should return 400 if irctcId is missing', async () => {
            req.body = { pnr: '1234567890' };

            await otpController.sendOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining('required')
                })
            );
        });

        it('should return 400 if pnr is missing', async () => {
            req.body = { irctcId: 'TEST123' };

            await otpController.sendOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if passenger not found', async () => {
            req.body = {
                irctcId: 'TEST123',
                pnr: '1234567890'
            };

            db.getPassengersCollection.mockReturnValue({
                findOne: jest.fn().mockResolvedValue(null)
            });

            await otpController.sendOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Passenger not found'
                })
            );
        });

        it('should return 403 if IRCTC ID does not match', async () => {
            req.body = {
                irctcId: 'WRONG123',
                pnr: '1234567890'
            };

            const mockPassenger = {
                PNR_Number: '1234567890',
                IRCTC_ID: 'TEST123',
                Email: 'test@example.com'
            };

            db.getPassengersCollection.mockReturnValue({
                findOne: jest.fn().mockResolvedValue(mockPassenger)
            });

            await otpController.sendOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('does not match')
                })
            );
        });

        it('should return 400 if passenger has no email', async () => {
            req.body = {
                irctcId: 'TEST123',
                pnr: '1234567890'
            };

            const mockPassenger = {
                PNR_Number: '1234567890',
                IRCTC_ID: 'TEST123'
                // No Email field
            };

            db.getPassengersCollection.mockReturnValue({
                findOne: jest.fn().mockResolvedValue(mockPassenger)
            });

            await otpController.sendOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('No email address')
                })
            );
        });

        it('should mask email in response', async () => {
            req.body = {
                irctcId: 'TEST123',
                pnr: '1234567890'
            };

            const mockPassenger = {
                PNR_Number: '1234567890',
                IRCTC_ID: 'TEST123',
                Email: 'testuser@example.com'
            };

            db.getPassengersCollection.mockReturnValue({
                findOne: jest.fn().mockResolvedValue(mockPassenger)
            });

            OTPService.sendOTP.mockResolvedValue({
                success: true,
                expiresIn: 300
            });

            await otpController.sendOTP(req, res);

            const call = res.json.mock.calls[0][0];
            expect(call.message).toContain('***');
            expect(call.message).not.toContain('testuser');
        });

        it('should use default purpose if not provided', async () => {
            req.body = {
                irctcId: 'TEST123',
                pnr: '1234567890'
            };

            const mockPassenger = {
                PNR_Number: '1234567890',
                IRCTC_ID: 'TEST123',
                Email: 'test@example.com'
            };

            db.getPassengersCollection.mockReturnValue({
                findOne: jest.fn().mockResolvedValue(mockPassenger)
            });

            OTPService.sendOTP.mockResolvedValue({
                success: true,
                expiresIn: 300
            });

            await otpController.sendOTP(req, res);

            expect(OTPService.sendOTP).toHaveBeenCalledWith(
                'TEST123',
                '1234567890',
                'test@example.com',
                'ticket action'
            );
        });

        it('should handle OTP service errors', async () => {
            req.body = {
                irctcId: 'TEST123',
                pnr: '1234567890'
            };

            const mockPassenger = {
                PNR_Number: '1234567890',
                IRCTC_ID: 'TEST123',
                Email: 'test@example.com'
            };

            db.getPassengersCollection.mockReturnValue({
                findOne: jest.fn().mockResolvedValue(mockPassenger)
            });

            OTPService.sendOTP.mockRejectedValue(new Error('Email service unavailable'));

            await otpController.sendOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Email service unavailable'
                })
            );
        });
    });

    describe('verifyOTP', () => {
        it('should verify OTP successfully', async () => {
            req.body = {
                irctcId: 'TEST123',
                pnr: '1234567890',
                otp: '123456'
            };

            OTPService.verifyOTP.mockResolvedValue({
                success: true,
                message: 'OTP verified'
            });

            await otpController.verifyOTP(req, res);

            expect(OTPService.verifyOTP).toHaveBeenCalledWith('TEST123', '1234567890', '123456');
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    verified: true
                })
            );
        });

        it('should return 400 if irctcId is missing', async () => {
            req.body = { pnr: '1234567890', otp: '123456' };

            await otpController.verifyOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if pnr is missing', async () => {
            req.body = { irctcId: 'TEST123', otp: '123456' };

            await otpController.verifyOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if otp is missing', async () => {
            req.body = { irctcId: 'TEST123', pnr: '1234567890' };

            await otpController.verifyOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 for invalid OTP', async () => {
            req.body = {
                irctcId: 'TEST123',
                pnr: '1234567890',
                otp: '999999'
            };

            OTPService.verifyOTP.mockResolvedValue({
                success: false,
                message: 'Invalid OTP'
            });

            await otpController.verifyOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    verified: false,
                    message: 'Invalid OTP'
                })
            );
        });

        it('should handle verification service errors', async () => {
            req.body = {
                irctcId: 'TEST123',
                pnr: '1234567890',
                otp: '123456'
            };

            OTPService.verifyOTP.mockRejectedValue(new Error('Database error'));

            await otpController.verifyOTP(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    verified: false
                })
            );
        });
    });
});

// 15 tests for otpController
