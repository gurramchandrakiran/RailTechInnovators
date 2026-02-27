/**
 * NotificationService Tests
 * Tests for email notification service using nodemailer
 */

const nodemailer = require('nodemailer');

// Mock nodemailer before requiring NotificationService
jest.mock('nodemailer', () => ({
    createTransport: jest.fn()
}));

describe('NotificationService', () => {
    let NotificationService;
    let mockTransporter;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset modules to get fresh instance
        jest.resetModules();

        // Mock nodemailer transporter
        mockTransporter = {
            sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
        };

        nodemailer.createTransport.mockReturnValue(mockTransporter);

        // Setup test environment
        process.env.EMAIL_USER = 'test@example.com';
        process.env.EMAIL_PASSWORD = 'test-password';

        // Require NotificationService after mocks are set up
        NotificationService = require('../../services/NotificationService');

        // Ensure emailTransporter is set on the exported instance
        if (NotificationService && !NotificationService.emailTransporter) {
            NotificationService.emailTransporter = mockTransporter;
        }
    });

    describe('sendUpgradeNotification', () => {
        it('should send email successfully', async () => {
            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe',
                email: 'passenger@test.com',
                mobile: '+919876543210'
            };

            const oldStatus = 'RAC-1';
            const newBerth = {
                coachNo: 'S1',
                berthNo: '23',
                type: 'LB',
                fullBerthNo: 'S1-LB-23'
            };

            const result = await NotificationService.sendUpgradeNotification(passenger, oldStatus, newBerth);

            expect(mockTransporter.sendMail).toHaveBeenCalled();
            expect(result.email.sent).toBe(true);
        });

        it('should handle email-only when no mobile provided', async () => {
            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe',
                email: 'passenger@test.com'
            };

            const result = await NotificationService.sendUpgradeNotification(passenger, 'RAC-1', {
                coachNo: 'S1',
                berthNo: '23',
                type: 'LB'
            });

            expect(result.email.sent).toBe(true);
        });

        it('should handle email failure gracefully', async () => {
            mockTransporter.sendMail.mockRejectedValue(new Error('Email error'));

            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe',
                email: 'passenger@test.com'
            };

            const result = await NotificationService.sendUpgradeNotification(passenger, 'RAC-1', {
                coachNo: 'S1',
                berthNo: '23',
                type: 'LB'
            });

            expect(result.email.sent).toBe(false);
            expect(result.email.error).toBe('Email error');
        });

        it('should skip email when not configured', async () => {
            delete process.env.EMAIL_USER;
            jest.resetModules();
            NotificationService = require('../../services/NotificationService');

            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe'
            };

            const result = await NotificationService.sendUpgradeNotification(passenger, 'RAC-1', {});

            expect(result.email.sent).toBe(false);
        });
    });

    describe('sendNoShowMarkedNotification', () => {
        it('should send email for no-show notification', async () => {
            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe',
                email: 'passenger@test.com',
                coach: 'S1',
                berth: 'LB-23',
                passengerStatus: 'BOARDED'
            };

            const result = await NotificationService.sendNoShowMarkedNotification('TEST123', passenger);

            expect(mockTransporter.sendMail).toHaveBeenCalled();
            expect(result.email.sent).toBe(true);
        });

        it('should handle Email field (MongoDB field name)', async () => {
            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe',
                Email: 'passenger@test.com', // Capital E
                coach: 'S1',
                berth: 'LB-23',
                passengerStatus: 'BOARDED'
            };

            const result = await NotificationService.sendNoShowMarkedNotification('TEST123', passenger);

            expect(mockTransporter.sendMail).toHaveBeenCalled();
            expect(result.email.sent).toBe(true);
        });

        it('should handle email failure in no-show notification', async () => {
            mockTransporter.sendMail.mockRejectedValue(new Error('Email error'));

            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe',
                email: 'passenger@test.com',
                coach: 'S1',
                berth: 'LB-23',
                passengerStatus: 'NO_SHOW'
            };

            const result = await NotificationService.sendNoShowMarkedNotification('TEST123', passenger);

            expect(result.email.sent).toBe(false);
            expect(result.email.error).toBeDefined();
        });
    });

    describe('sendNoShowRevertedNotification', () => {
        it('should send email for revert notification', async () => {
            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe',
                email: 'passenger@test.com',
                coach: 'S1',
                berth: 'LB-23'
            };

            const result = await NotificationService.sendNoShowRevertedNotification('TEST123', passenger);

            expect(mockTransporter.sendMail).toHaveBeenCalled();
            expect(result.email.sent).toBe(true);
        });

        it('should handle email failure in revert notification', async () => {
            mockTransporter.sendMail.mockRejectedValue(new Error('Email error'));

            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe',
                email: 'passenger@test.com',
                coach: 'S1',
                berth: 'LB-23'
            };

            const result = await NotificationService.sendNoShowRevertedNotification('TEST123', passenger);

            expect(result.email.sent).toBe(false);
            expect(result.email.error).toBeDefined();
        });
    });

    describe('testEmail', () => {
        it('should successfully test email configuration', async () => {
            const result = await NotificationService.testEmail('test@recipient.com');

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('test-message-id');
        });

        it('should handle email test failure', async () => {
            mockTransporter.sendMail.mockRejectedValue(new Error('Connection failed'));

            const result = await NotificationService.testEmail('test@recipient.com');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection failed');
        });
    });

    describe('sendApprovalRequestNotification', () => {
        it('should send approval request email', async () => {
            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe',
                email: 'passenger@test.com'
            };

            const upgradeDetails = {
                currentRAC: 'RAC-1',
                proposedBerthFull: 'S1-LB-23',
                proposedBerthType: 'LB',
                stationName: 'Chennai Central'
            };

            const result = await NotificationService.sendApprovalRequestNotification(passenger, upgradeDetails);

            expect(mockTransporter.sendMail).toHaveBeenCalled();
            expect(result.sent).toBe(true);
        });

        it('should handle missing email configuration', async () => {
            const passenger = {
                pnr: 'TEST123',
                name: 'John Doe'
            };

            const result = await NotificationService.sendApprovalRequestNotification(passenger, {});

            expect(result.sent).toBe(false);
            expect(result.error).toBe('No email configured');
        });
    });
});
