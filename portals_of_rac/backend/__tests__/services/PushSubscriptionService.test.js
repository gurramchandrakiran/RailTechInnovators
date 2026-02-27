/**
 * PushSubscriptionService Tests - Comprehensive Coverage
 * Tests for push notification subscription management
 */

const PushSubscriptionService = require('../../services/PushSubscriptionService');

describe('PushSubscriptionService - Comprehensive Tests', () => {
    beforeEach(() => {
        // Clear all subscriptions before each test
        PushSubscriptionService.subscriptions.clear();
        PushSubscriptionService.tteSubscriptions.clear();
        if (PushSubscriptionService.adminSubscriptions) {
            PushSubscriptionService.adminSubscriptions.clear();
        }
    });

    describe('Passenger Subscriptions', () => {
        describe('addSubscription', () => {
            it('should add new subscription for passenger', async () => {
                const subscription = { endpoint: 'https://push.example.com/1', keys: {} };

                await PushSubscriptionService.addSubscription('IR123', subscription);

                const subs = await PushSubscriptionService.getSubscriptions('IR123');
                expect(subs).toHaveLength(1);
                expect(subs[0].endpoint).toBe('https://push.example.com/1');
            });

            it('should throw error if IRCTC ID not provided', async () => {
                await expect(
                    PushSubscriptionService.addSubscription(null, { endpoint: 'test' })
                ).rejects.toThrow('IRCTC ID is required');
            });

            it('should throw error for invalid subscription', async () => {
                await expect(
                    PushSubscriptionService.addSubscription('IR123', {})
                ).rejects.toThrow('Invalid subscription object');
            });

            it('should not add duplicate subscriptions', async () => {
                const subscription = { endpoint: 'https://push.example.com/1', keys: {} };

                await PushSubscriptionService.addSubscription('IR123', subscription);
                await PushSubscriptionService.addSubscription('IR123', subscription);

                const subs = await PushSubscriptionService.getSubscriptions('IR123');
                expect(subs).toHaveLength(1);
            });

            it('should allow multiple different subscriptions for same user', async () => {
                const sub1 = { endpoint: 'https://push.example.com/1', keys: {} };
                const sub2 = { endpoint: 'https://push.example.com/2', keys: {} };

                await PushSubscriptionService.addSubscription('IR123', sub1);
                await PushSubscriptionService.addSubscription('IR123', sub2);

                const subs = await PushSubscriptionService.getSubscriptions('IR123');
                expect(subs).toHaveLength(2);
            });
        });

        describe('getSubscriptions', () => {
            it('should return subscriptions for passenger', async () => {
                const subscription = { endpoint: 'https://push.example.com/1', keys: {} };
                await PushSubscriptionService.addSubscription('IR123', subscription);

                const subs = await PushSubscriptionService.getSubscriptions('IR123');

                expect(subs).toHaveLength(1);
            });

            it('should return empty array for passenger with no subscriptions', async () => {
                const subs = await PushSubscriptionService.getSubscriptions('IR999');

                expect(subs).toEqual([]);
            });
        });

        describe('removeSubscription', () => {
            it('should remove specific subscription', async () => {
                const sub1 = { endpoint: 'https://push.example.com/1', keys: {} };
                const sub2 = { endpoint: 'https://push.example.com/2', keys: {} };

                await PushSubscriptionService.addSubscription('IR123', sub1);
                await PushSubscriptionService.addSubscription('IR123', sub2);

                const result = await PushSubscriptionService.removeSubscription('IR123', 'https://push.example.com/1');

                expect(result).toBe(true);
                const subs = await PushSubscriptionService.getSubscriptions('IR123');
                expect(subs).toHaveLength(1);
                expect(subs[0].endpoint).toBe('https://push.example.com/2');
            });

            it('should return false if subscription not found', async () => {
                const result = await PushSubscriptionService.removeSubscription('IR123', 'non-existent');

                expect(result).toBe(false);
            });

            it('should remove user from map when last subscription removed', async () => {
                const subscription = { endpoint: 'https://push.example.com/1', keys: {} };
                await PushSubscriptionService.addSubscription('IR123', subscription);

                await PushSubscriptionService.removeSubscription('IR123', 'https://push.example.com/1');

                expect(PushSubscriptionService.subscriptions.has('IR123')).toBe(false);
            });
        });

        describe('deleteSubscription', () => {
            it('should delete subscription by endpoint', async () => {
                const subscription = { endpoint: 'https://push.example.com/1', keys: {} };
                await PushSubscriptionService.addSubscription('IR123', subscription);

                const result = await PushSubscriptionService.deleteSubscription('https://push.example.com/1');

                expect(result).toBe(true);
                const subs = await PushSubscriptionService.getSubscriptions('IR123');
                expect(subs).toEqual([]);
            });

            it('should return false if endpoint not found', async () => {
                const result = await PushSubscriptionService.deleteSubscription('non-existent');

                expect(result).toBe(false);
            });
        });

        describe('clearSubscriptions', () => {
            it('should clear all subscriptions for user', async () => {
                const sub1 = { endpoint: 'https://push.example.com/1', keys: {} };
                const sub2 = { endpoint: 'https://push.example.com/2', keys: {} };

                await PushSubscriptionService.addSubscription('IR123', sub1);
                await PushSubscriptionService.addSubscription('IR123', sub2);

                const result = await PushSubscriptionService.clearSubscriptions('IR123');

                expect(result).toBe(true);
                const subs = await PushSubscriptionService.getSubscriptions('IR123');
                expect(subs).toEqual([]);
            });

            it('should return false if user has no subscriptions', async () => {
                const result = await PushSubscriptionService.clearSubscriptions('IR999');

                expect(result).toBe(false);
            });
        });
    });

    describe('TTE Subscriptions', () => {
        describe('addTTESubscription', () => {
            it('should add TTE subscription', async () => {
                const subscription = { endpoint: 'https://push.example.com/tte1', keys: {} };

                await PushSubscriptionService.addTTESubscription('TTE001', subscription);

                const subs = await PushSubscriptionService.getTTESubscriptions('TTE001');
                expect(subs).toHaveLength(1);
            });

            it('should throw error if TTE ID not provided', async () => {
                await expect(
                    PushSubscriptionService.addTTESubscription(null, { endpoint: 'test' })
                ).rejects.toThrow('TTE ID is required');
            });

            it('should not add duplicate TTE subscriptions', async () => {
                const subscription = { endpoint: 'https://push.example.com/tte1', keys: {} };

                await PushSubscriptionService.addTTESubscription('TTE001', subscription);
                await PushSubscriptionService.addTTESubscription('TTE001', subscription);

                const subs = await PushSubscriptionService.getTTESubscriptions('TTE001');
                expect(subs).toHaveLength(1);
            });
        });

        describe('getTTESubscriptions', () => {
            it('should return TTE subscriptions', async () => {
                const subscription = { endpoint: 'https://push.example.com/tte1', keys: {} };
                await PushSubscriptionService.addTTESubscription('TTE001', subscription);

                const subs = await PushSubscriptionService.getTTESubscriptions('TTE001');

                expect(subs).toHaveLength(1);
            });

            it('should return empty array for TTE with no subscriptions', async () => {
                const subs = await PushSubscriptionService.getTTESubscriptions('TTE999');

                expect(subs).toEqual([]);
            });
        });

        describe('getAllTTESubscriptions', () => {
            it('should return all TTE subscriptions', async () => {
                const sub1 = { endpoint: 'https://push.example.com/tte1', keys: {} };
                const sub2 = { endpoint: 'https://push.example.com/tte2', keys: {} };

                await PushSubscriptionService.addTTESubscription('TTE001', sub1);
                await PushSubscriptionService.addTTESubscription('TTE002', sub2);

                const allSubs = await PushSubscriptionService.getAllTTESubscriptions();

                expect(allSubs).toHaveLength(2);
            });
        });

        describe('removeTTESubscription', () => {
            it('should remove TTE subscription', async () => {
                const subscription = { endpoint: 'https://push.example.com/tte1', keys: {} };
                await PushSubscriptionService.addTTESubscription('TTE001', subscription);

                const result = await PushSubscriptionService.removeTTESubscription('TTE001', 'https://push.example.com/tte1');

                expect(result).toBe(true);
                const subs = await PushSubscriptionService.getTTESubscriptions('TTE001');
                expect(subs).toEqual([]);
            });

            it('should return false if TTE subscription not found', async () => {
                const result = await PushSubscriptionService.removeTTESubscription('TTE001', 'non-existent');

                expect(result).toBe(false);
            });
        });

        describe('clearTTESubscriptions', () => {
            it('should clear all TTE subscriptions', async () => {
                const subscription = { endpoint: 'https://push.example.com/tte1', keys: {} };
                await PushSubscriptionService.addTTESubscription('TTE001', subscription);

                const result = await PushSubscriptionService.clearTTESubscriptions('TTE001');

                expect(result).toBe(true);
            });
        });
    });

    describe('Admin Subscriptions', () => {
        describe('addAdminSubscription', () => {
            it('should add admin subscription', async () => {
                const subscription = { endpoint: 'https://push.example.com/admin1', keys: {} };

                await PushSubscriptionService.addAdminSubscription('ADMIN001', subscription);

                const allSubs = await PushSubscriptionService.getAllAdminSubscriptions();
                expect(allSubs).toHaveLength(1);
            });

            it('should throw error if Admin ID not provided', async () => {
                await expect(
                    PushSubscriptionService.addAdminSubscription(null, { endpoint: 'test' })
                ).rejects.toThrow('Admin ID is required');
            });

            it('should not add duplicate admin subscriptions', async () => {
                const subscription = { endpoint: 'https://push.example.com/admin1', keys: {} };

                await PushSubscriptionService.addAdminSubscription('ADMIN001', subscription);
                await PushSubscriptionService.addAdminSubscription('ADMIN001', subscription);

                const allSubs = await PushSubscriptionService.getAllAdminSubscriptions();
                expect(allSubs).toHaveLength(1);
            });
        });

        describe('getAllAdminSubscriptions', () => {
            it('should return all admin subscriptions', async () => {
                const sub1 = { endpoint: 'https://push.example.com/admin1', keys: {} };
                const sub2 = { endpoint: 'https://push.example.com/admin2', keys: {} };

                await PushSubscriptionService.addAdminSubscription('ADMIN001', sub1);
                await PushSubscriptionService.addAdminSubscription('ADMIN002', sub2);

                const allSubs = await PushSubscriptionService.getAllAdminSubscriptions();

                expect(allSubs).toHaveLength(2);
            });

            it('should return empty array if no admin subscriptions', async () => {
                const allSubs = await PushSubscriptionService.getAllAdminSubscriptions();

                expect(allSubs).toEqual([]);
            });
        });

        describe('removeAdminSubscription', () => {
            it('should remove admin subscription', async () => {
                const subscription = { endpoint: 'https://push.example.com/admin1', keys: {} };
                await PushSubscriptionService.addAdminSubscription('ADMIN001', subscription);

                const result = await PushSubscriptionService.removeAdminSubscription('ADMIN001', 'https://push.example.com/admin1');

                expect(result).toBe(true);
            });

            it('should return false if admin subscription not found', async () => {
                const result = await PushSubscriptionService.removeAdminSubscription('ADMIN001', 'non-existent');

                expect(result).toBe(false);
            });
        });
    });

    describe('Statistics', () => {
        describe('getTotalCount', () => {
            it('should return total subscription count', async () => {
                const sub1 = { endpoint: 'https://push.example.com/1', keys: {} };
                const sub2 = { endpoint: 'https://push.example.com/2', keys: {} };

                await PushSubscriptionService.addSubscription('IR123', sub1);
                await PushSubscriptionService.addSubscription('IR456', sub2);

                const count = PushSubscriptionService.getTotalCount();

                expect(count).toBe(2);
            });

            it('should return 0 when no subscriptions', () => {
                const count = PushSubscriptionService.getTotalCount();

                expect(count).toBe(0);
            });
        });

        describe('getStats', () => {
            it('should return statistics', async () => {
                const sub1 = { endpoint: 'https://push.example.com/1', keys: {} };
                const sub2 = { endpoint: 'https://push.example.com/2', keys: {} };

                await PushSubscriptionService.addSubscription('IR123', sub1);
                await PushSubscriptionService.addSubscription('IR123', sub2);
                await PushSubscriptionService.addSubscription('IR456', sub1);

                const stats = await PushSubscriptionService.getStats();

                expect(stats.totalUsers).toBe(2);
                expect(stats.totalSubscriptions).toBe(3);
            });
        });
    });
});
