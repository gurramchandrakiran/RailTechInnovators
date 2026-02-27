/**
 * OTPService Tests
 * Tests for OTP generation only (sendOTP requires full email config)
 */

const OTPService = require('../../services/OTPService');
const db = require('../../config/db');
const NotificationService = require('../../services/NotificationService');

jest.mock('../../config/db');
jest.mock('../../services/NotificationService');

describe('OTPService', () => {
    let mockCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCollection = {
            createIndex: jest.fn().mockResolvedValue({}),
            updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
            findOne: jest.fn(),
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
        };

        db.getDb = jest.fn().mockResolvedValue({
            collection: jest.fn().mockReturnValue(mockCollection)
        });

        NotificationService.emailTransporter = {
            sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
        };

        OTPService.initialized = false;
    });
    describe('initializeCollection', () => {
        it('should initialize collection with TTL index', async () => {
            await OTPService.initializeCollection();

            expect(mockCollection.createIndex).toHaveBeenCalledWith(
                { createdAt: 1 },
                { expireAfterSeconds: 300 }
            );
            expect(OTPService.initialized).toBe(true);
        });

        it('should not reinitialize if already initialized', async () => {
            OTPService.initialized = true;

            await OTPService.initializeCollection();

            expect(mockCollection.createIndex).not.toHaveBeenCalled();
        });

        it('should ignore IndexOptionsConflict error (code 85)', async () => {
            const indexError = new Error('Index conflict');
            indexError.code = 85;
            mockCollection.createIndex.mockRejectedValue(indexError);

            await OTPService.initializeCollection();

            expect(OTPService.initialized).toBe(true);
        });

        it('should handle other index errors gracefully', async () => {
            const error = new Error('Other error');
            error.code = 99;
            mockCollection.createIndex.mockRejectedValue(error);

            await OTPService.initializeCollection();

            expect(OTPService.initialized).toBe(false);
        });
    });

    describe('getCollection', () => {
        it('should initialize and return collection', async () => {
            const collection = await OTPService.getCollection();

            expect(collection).toBeDefined();
            expect(db.getDb).toHaveBeenCalled();
        });
    });

    describe('generateOTP', () => {
        it('should generate a 6-digit OTP', () => {
            const otp = OTPService.generateOTP();
            expect(otp).toMatch(/^\d{6}$/);
            expect(otp.length).toBe(6);
        });

        it('should generate numeric OTP only', () => {
            const otp = OTPService.generateOTP();
            expect(parseInt(otp, 10)).not.toBeNaN();
        });

        it('should generate OTP within valid range (100000-999999)', () => {
            for (let i = 0; i < 50; i++) {
                const otp = parseInt(OTPService.generateOTP(), 10);
                expect(otp).toBeGreaterThanOrEqual(100000);
                expect(otp).toBeLessThanOrEqual(999999);
            }
        });

        it('should generate different OTPs across multiple calls', () => {
            const otps = new Set();
            for (let i = 0; i < 20; i++) {
                otps.add(OTPService.generateOTP());
            }
            // With high probability, we should have at least some unique values
            expect(otps.size).toBeGreaterThan(5);
        });
    });

    describe('sendOTP', () => {
        it('should generate and send OTP via email', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const result = await OTPService.sendOTP('IR123', 'P001234567', 'test@test.com');

            expect(result.success).toBe(true);
            expect(mockCollection.updateOne).toHaveBeenCalled();
            expect(NotificationService.emailTransporter.sendMail).toHaveBeenCalled();
        });

        it('should store OTP with correct structure', async () => {
            await OTPService.sendOTP('IR123', 'P001234567', 'test@test.com');

            const updateCall = mockCollection.updateOne.mock.calls[0];
            expect(updateCall[0]).toEqual({ key: 'IR123_P001234567' });
            expect(updateCall[1].$set).toMatchObject({
                key: 'IR123_P001234567',
                irctcId: 'IR123',
                pnr: 'P001234567',
                attempts: 0,
                maxAttempts: 3
            });
        });

        it('should send email with OTP in HTML format', async () => {
            await OTPService.sendOTP('IR123', 'P001234567', 'test@test.com', 'verification');

            const emailCall = NotificationService.emailTransporter.sendMail.mock.calls[0][0];
            expect(emailCall.to).toBe('test@test.com');
            expect(emailCall.html).toContain('OTP');
            expect(emailCall.subject).toContain('OTP');
        });

        it('should handle email sending errors', async () => {
            NotificationService.emailTransporter.sendMail.mockRejectedValue(new Error('Email failed'));

            await expect(
                OTPService.sendOTP('IR123', 'P001234567', 'test@test.com')
            ).rejects.toThrow('Failed to send OTP');
        });

        it('should use upsert to replace existing OTP', async () => {
            await OTPService.sendOTP('IR123', 'P001234567', 'test@test.com');

            const updateCall = mockCollection.updateOne.mock.calls[0];
            expect(updateCall[2]).toEqual({ upsert: true });
        });
    });

    describe('verifyOTP', () => {
        it('should verify correct OTP', async () => {
            mockCollection.findOne.mockResolvedValue({
                key: 'IR123_P001234567',
                otp: '123456',
                attempts: 0,
                maxAttempts: 3
            });

            const result = await OTPService.verifyOTP('IR123', 'P001234567', '123456');

            expect(result.success).toBe(true);
            expect(mockCollection.deleteOne).toHaveBeenCalledWith({ key: 'IR123_P001234567' });
        });

        it('should return failure for incorrect OTP', async () => {
            mockCollection.findOne.mockResolvedValue({
                key: 'IR123_P001234567',
                otp: '123456',
                attempts: 0,
                maxAttempts: 3
            });

            const result = await OTPService.verifyOTP('IR123', 'P001234567', '999999');

            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid OTP');
        });

        it('should increment attempts on incorrect OTP', async () => {
            mockCollection.findOne.mockResolvedValue({
                key: 'IR123_P001234567',
                otp: '123456',
                attempts: 0,
                maxAttempts: 3
            });

            await OTPService.verifyOTP('IR123', 'P001234567', '999999');

            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { key: 'IR123_P001234567' },
                { $inc: { attempts: 1 } }
            );
        });

        it('should return failure if OTP not found', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const result = await OTPService.verifyOTP('IR123', 'P001234567', '123456');

            expect(result.success).toBe(false);
            expect(result.message).toContain('No OTP found');
        });

        it('should delete OTP after max attempts', async () => {
            mockCollection.findOne.mockResolvedValue({
                key: 'IR123_P001234567',
                otp: '123456',
                attempts: 3,
                maxAttempts: 3
            });

            const result = await OTPService.verifyOTP('IR123', 'P001234567', '123456');

            expect(result.success).toBe(false);
            expect(result.message).toContain('Maximum attempts exceeded');
            expect(mockCollection.deleteOne).toHaveBeenCalled();
        });

        it('should show remaining attempts', async () => {
            mockCollection.findOne.mockResolvedValue({
                key: 'IR123_P001234567',
                otp: '123456',
                attempts: 1,
                maxAttempts: 3
            });

            const result = await OTPService.verifyOTP('IR123', 'P001234567', '999999');

            expect(result.message).toContain('1 attempt(s) remaining');
        });

        it('should handle database errors gracefully', async () => {
            mockCollection.findOne.mockRejectedValue(new Error('DB error'));

            const result = await OTPService.verifyOTP('IR123', 'P001234567', '123456');

            expect(result.success).toBe(false);
            expect(result.message).toContain('Error verifying OTP');
        });
    });

    describe('clearOTP', () => {
        it('should clear OTP for given irctcId and pnr', async () => {
            await OTPService.clearOTP('IR123', 'P001234567');

            expect(mockCollection.deleteOne).toHaveBeenCalledWith({ key: 'IR123_P001234567' });
        });

        it('should handle errors without throwing', async () => {
            mockCollection.deleteOne.mockRejectedValue(new Error('Delete error'));

            await expect(OTPService.clearOTP('IR123', 'P001234567')).resolves.not.toThrow();
        });
    });

    describe('getOTPStatus', () => {
        it('should return OTP status if exists', async () => {
            mockCollection.findOne.mockResolvedValue({
                key: 'IR123_P001234567',
                otp: '123456',
                createdAt: new Date(),
                attempts: 1,
                maxAttempts: 3
            });

            const status = await OTPService.getOTPStatus('IR123', 'P001234567');

            expect(status.exists).toBe(true);
            expect(status.attempts).toBe(1);
            expect(status.maxAttempts).toBe(3);
        });

        it('should return exists false if no OTP found', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const status = await OTPService.getOTPStatus('IR123', 'P001234567');

            expect(status.exists).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            mockCollection.findOne.mockRejectedValue(new Error('DB error'));

            const status = await OTPService.getOTPStatus('IR123', 'P001234567');

            expect(status.exists).toBe(false);
            expect(status.error).toBeDefined();
        });
    });
});
