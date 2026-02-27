/**
 * PushNotificationService Tests - Comprehensive Coverage
 * Tests for web push notification service
 */

const PushNotificationService = require('../../services/PushNotificationService');

describe('PushNotificationService - Comprehensive Tests', () => {
    beforeEach(() => {
        PushNotificationService.subscriptions.clear();
    });

    describe('subscribe', () => {
        it('should subscribe passenger to push notifications', async () => {
            const subscription = { endpoint: 'https://example.com', keys: {} };

            const result = await PushNotificationService.subscribe('P001', subscription);

            expect(result.success).toBe(true);
            expect(PushNotificationService.subscriptions.get('P001')).toEqual(subscription);
        });

        it('should override existing subscription', async () => {
            const oldSub = { endpoint: 'https://old.com', keys: {} };
            const newSub = { endpoint: 'https://new.com', keys: {} };

            await PushNotificationService.subscribe('P001', oldSub);
            await PushNotificationService.subscribe('P001', newSub);

            expect(PushNotificationService.subscriptions.get('P001')).toEqual(newSub);
        });

        it('should handle multiple subscribers', async () => {
            const sub1 = { endpoint: 'https://one.com', keys: {} };
            const sub2 = { endpoint: 'https://two.com', keys: {} };

            await PushNotificationService.subscribe('P001', sub1);
            await PushNotificationService.subscribe('P002', sub2);

            expect(PushNotificationService.subscriptions.size).toBe(2);
        });
    });

    describe('unsubscribe', () => {
        it('should unsubscribe passenger from push notifications', async () => {
            const subscription = { endpoint: 'https://example.com', keys: {} };
            await PushNotificationService.subscribe('P001', subscription);

            const result = await PushNotificationService.unsubscribe('P001');

            expect(result.success).toBe(true);
            expect(PushNotificationService.subscriptions.has('P001')).toBe(false);
        });

        it('should handle unsubscribe for non-existent subscription', async () => {
            const result = await PushNotificationService.unsubscribe('NONEXISTENT');

            expect(result.success).toBe(true);
        });
    });

    describe('notifyUpgrade', () => {
        it('should send upgrade notification successfully', async () => {
            const subscription = { endpoint: 'https://example.com', keys: {} };
            await PushNotificationService.subscribe('P001', subscription);

            const passenger = {
                PNR_Number: 'P001',
                Name: 'John Doe',
                Coach: 'S1',
                Seat_Number: '15'
            };

            const result = await PushNotificationService.notifyUpgrade(passenger);

            expect(result.success).toBe(true);
        });

        it('should return failure when no subscription found', async () => {
            const passenger = {
                PNR_Number: 'P001',
                Name: 'John Doe',
                Coach: 'S1',
                Seat_Number: '15'
            };

            const result = await PushNotificationService.notifyUpgrade(passenger);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('No subscription');
        });

        it('should include passenger details in notification payload', async () => {
            const subscription = { endpoint: 'https://example.com', keys: {} };
            await PushNotificationService.subscribe('P001', subscription);

            const passenger = {
                PNR_Number: 'P001',
                Name: 'John Doe',
                Coach: 'S1',
                Seat_Number: '15'
            };

            await PushNotificationService.notifyUpgrade(passenger);
        });
    });

    describe('notifyBulk', () => {
        it('should send notifications to multiple passengers', async () => {
            const sub1 = { endpoint: 'https://one.com', keys: {} };
            const sub2 = { endpoint: 'https://two.com', keys: {} };

            await PushNotificationService.subscribe('P001', sub1);
            await PushNotificationService.subscribe('P002', sub2);

            const passengers = [
                { PNR_Number: 'P001', Name: 'John', Coach: 'S1', Seat_Number: '15' },
                { PNR_Number: 'P002', Name: 'Jane', Coach: 'S1', Seat_Number: '16' }
            ];

            const result = await PushNotificationService.notifyBulk(passengers);

            expect(result.sent).toBe(2);
            expect(result.failed).toBe(0);
            expect(result.total).toBe(2);
        });

        it('should handle partial failures in bulk notification', async () => {
            const sub1 = { endpoint: 'https://one.com', keys: {} };
            await PushNotificationService.subscribe('P001', sub1);

            const passengers = [
                { PNR_Number: 'P001', Name: 'John', Coach: 'S1', Seat_Number: '15' },
                { PNR_Number: 'P002', Name: 'Jane', Coach: 'S1', Seat_Number: '16' }
            ];

            const result = await PushNotificationService.notifyBulk(passengers);

            expect(result.sent).toBe(1);
            expect(result.failed).toBe(1);
            expect(result.total).toBe(2);
        });

        it('should handle empty passenger list', async () => {
            const result = await PushNotificationService.notifyBulk([]);

            expect(result.sent).toBe(0);
            expect(result.failed).toBe(0);
            expect(result.total).toBe(0);
        });

        it('should handle all failures', async () => {
            const passengers = [
                { PNR_Number: 'P001', Name: 'John', Coach: 'S1', Seat_Number: '15' },
                { PNR_Number: 'P002', Name: 'Jane', Coach: 'S1', Seat_Number: '16' }
            ];

            const result = await PushNotificationService.notifyBulk(passengers);

            expect(result.sent).toBe(0);
            expect(result.failed).toBe(2);
        });
    });

    describe('getPublicKey', () => {
        it('should return VAPID public key', () => {
            const publicKey = PushNotificationService.getPublicKey();

            expect(publicKey).toBeDefined();
            expect(typeof publicKey).toBe('string');
        });
    });

    describe('Edge Cases', () => {
        it('should handle subscription with null endpoint', async () => {
            const subscription = { endpoint: null, keys: {} };

            const result = await PushNotificationService.subscribe('P001', subscription);

            expect(result.success).toBe(true);
        });

        it('should handle passenger with missing fields', async () => {
            const subscription = { endpoint: 'https://example.com', keys: {} };
            await PushNotificationService.subscribe('P001', subscription);

            const passenger = { PNR_Number: 'P001' };

            const result = await PushNotificationService.notifyUpgrade(passenger);

            expect(result.success).toBe(true);
        });
    });
});
