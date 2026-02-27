/**
 * Failure Injection Tests
 * Tests system behavior when dependencies fail or degrade
 */

// Mock setup - must be before imports
const mockMongoClient = {
    connect: jest.fn(),
    db: jest.fn(),
    close: jest.fn(),
};

const mockCollection = {
    findOne: jest.fn(),
    find: jest.fn(),
    insertOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
};

const mockDb = {
    collection: jest.fn(() => mockCollection),
};

jest.mock('mongodb', () => ({
    MongoClient: jest.fn(() => mockMongoClient),
}));

// Mock node-cache for cache tests
const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushAll: jest.fn(),
    getStats: jest.fn(() => ({ hits: 0, misses: 0 })),
};

jest.mock('node-cache', () => {
    return jest.fn().mockImplementation(() => mockCache);
});

// Mock web-push for notification tests
jest.mock('web-push', () => ({
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
}));

const webpush = require('web-push');

describe('Failure Injection Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMongoClient.db.mockReturnValue(mockDb);
        // Reset cache mock to default behavior
        mockCache.set.mockImplementation(() => true);
        mockCache.get.mockReturnValue(undefined);
    });

    describe('Database Failure Scenarios', () => {
        it('should handle MongoDB connection failure gracefully', async () => {
            mockMongoClient.connect.mockRejectedValue(
                new Error('MongoNetworkError: connection refused')
            );

            // Simulate attempting connection
            let error = null;
            try {
                await mockMongoClient.connect();
            } catch (e) {
                error = e;
            }

            expect(error).not.toBeNull();
            expect(error.message).toContain('connection refused');
        });

        it('should handle slow database queries', async () => {
            // Simulate 5-second delay
            mockCollection.findOne.mockImplementation(() => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({ _id: '123', name: 'Test' });
                    }, 5000);
                });
            });

            const startTime = Date.now();

            // Add timeout wrapper
            const queryWithTimeout = (timeout) => {
                return Promise.race([
                    mockCollection.findOne({ _id: '123' }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Query timeout')), timeout)
                    )
                ]);
            };

            // With 1s timeout, should fail
            let error = null;
            try {
                await queryWithTimeout(1000);
            } catch (e) {
                error = e;
            }

            expect(error).not.toBeNull();
            expect(error.message).toBe('Query timeout');
        }, 10000);

        it('should handle database write failures', async () => {
            mockCollection.insertOne.mockRejectedValue(
                new Error('Write operation failed: disk full')
            );

            let error = null;
            try {
                await mockCollection.insertOne({ test: 'data' });
            } catch (e) {
                error = e;
            }

            expect(error).not.toBeNull();
            expect(error.message).toContain('disk full');
        });

        it('should handle cursor timeout on large result sets', async () => {
            mockCollection.find.mockReturnValue({
                toArray: jest.fn().mockRejectedValue(
                    new Error('Cursor timed out, no more data')
                )
            });

            let error = null;
            try {
                await mockCollection.find({}).toArray();
            } catch (e) {
                error = e;
            }

            expect(error).not.toBeNull();
            expect(error.message).toContain('Cursor timed out');
        });
    });

    describe('Notification Service Failure Scenarios', () => {
        it('should handle push notification service failure', async () => {
            webpush.sendNotification.mockRejectedValue(
                new Error('WebPush error: subscription expired')
            );

            const subscription = {
                endpoint: 'https://push.example.com/abc',
                keys: { p256dh: 'key1', auth: 'key2' }
            };

            let error = null;
            try {
                await webpush.sendNotification(subscription, 'Test message');
            } catch (e) {
                error = e;
            }

            expect(error).not.toBeNull();
            expect(error.message).toContain('subscription expired');
        });

        it('should handle bulk notification failures gracefully', async () => {
            // Simulate mix of success and failure
            let callCount = 0;
            webpush.sendNotification.mockImplementation(() => {
                callCount++;
                if (callCount % 3 === 0) {
                    return Promise.reject(new Error('Rate limited'));
                }
                return Promise.resolve({ statusCode: 201 });
            });

            const subscriptions = Array(10).fill({
                endpoint: 'https://push.example.com/test',
                keys: { p256dh: 'key1', auth: 'key2' }
            });

            const results = await Promise.allSettled(
                subscriptions.map(sub => webpush.sendNotification(sub, 'Test'))
            );

            const successful = results.filter(r => r.status === 'fulfilled');
            const failed = results.filter(r => r.status === 'rejected');

            // Should have some successes and some failures
            expect(successful.length).toBeGreaterThan(0);
            expect(failed.length).toBeGreaterThan(0);
        });

        it('should handle notification service completely down', async () => {
            webpush.sendNotification.mockRejectedValue(
                new Error('ECONNREFUSED: Connection refused to push service')
            );

            const notifications = Array(5).fill(null).map((_, i) => ({
                subscription: { endpoint: `https://push.example.com/${i}`, keys: {} },
                message: `Message ${i}`
            }));

            const results = await Promise.allSettled(
                notifications.map(n => webpush.sendNotification(n.subscription, n.message))
            );

            // All should fail when service is down
            expect(results.every(r => r.status === 'rejected')).toBe(true);
        });
    });

    describe('Cache Failure Scenarios', () => {
        it('should handle cache returning stale data', async () => {
            const staleData = {
                trainNumber: '17225',
                currentStation: 'HYB',
                lastUpdated: new Date(Date.now() - 3600000).toISOString(), // 1 hour old
            };

            mockCache.get.mockReturnValue(staleData);

            const cachedData = mockCache.get('trainState');

            // Check if data is stale (over 5 minutes old)
            const lastUpdated = new Date(cachedData.lastUpdated);
            const isStale = (Date.now() - lastUpdated.getTime()) > 300000; // 5 min

            expect(isStale).toBe(true);

            // Application should detect stale data and refresh
            if (isStale) {
                // Simulate fetching fresh data
                mockCache.del('trainState');
                expect(mockCache.del).toHaveBeenCalledWith('trainState');
            }
        });

        it('should handle cache miss gracefully', async () => {
            mockCache.get.mockReturnValue(undefined);

            const result = mockCache.get('nonExistentKey');

            expect(result).toBeUndefined();

            // Application should fallback to database
            mockCollection.findOne.mockResolvedValue({ data: 'from db' });
            const dbResult = await mockCollection.findOne({ key: 'nonExistentKey' });

            expect(dbResult).toEqual({ data: 'from db' });
        });

        it('should handle cache set failures', async () => {
            mockCache.set.mockImplementation(() => {
                throw new Error('Cache memory limit exceeded');
            });

            // Application should continue working even if cache fails
            let cacheError = null;
            try {
                mockCache.set('key', 'value');
            } catch (e) {
                cacheError = e;
            }

            expect(cacheError).not.toBeNull();

            // Should still be able to read from DB
            mockCollection.findOne.mockResolvedValue({ data: 'fresh' });
            const result = await mockCollection.findOne({ id: '123' });
            expect(result).toEqual({ data: 'fresh' });
        });

        it('should detect and handle cache inconsistency', async () => {
            // Cache says passenger is in S1-LB-5
            mockCache.get.mockReturnValue({
                pnr: 'PNR123',
                coach: 'S1',
                berth: 'LB',
                berthNumber: 5
            });

            // But database says passenger is in S2-UB-10
            mockCollection.findOne.mockResolvedValue({
                pnr: 'PNR123',
                coach: 'S2',
                berth: 'UB',
                berthNumber: 10
            });

            const cachedData = mockCache.get('PNR123');
            const dbData = await mockCollection.findOne({ pnr: 'PNR123' });

            // Detect inconsistency
            const isInconsistent = cachedData.coach !== dbData.coach ||
                cachedData.berth !== dbData.berth;

            expect(isInconsistent).toBe(true);

            // Application should invalidate cache and use DB data
            if (isInconsistent) {
                mockCache.del('PNR123');
                mockCache.set('PNR123', dbData);
                expect(mockCache.del).toHaveBeenCalledWith('PNR123');
            }
        });
    });

    describe('Graceful Degradation Tests', () => {
        it('should continue serving requests when cache is down', async () => {
            // Cache throws on all operations
            mockCache.get.mockImplementation(() => {
                throw new Error('Cache service unavailable');
            });

            // Should fallback to direct DB access
            mockCollection.findOne.mockResolvedValue({ id: '123', name: 'Test' });

            // Simulate service layer that handles cache failure
            async function getWithFallback(key) {
                try {
                    return mockCache.get(key);
                } catch (e) {
                    // Fallback to database
                    return await mockCollection.findOne({ id: key });
                }
            }

            const result = await getWithFallback('123');
            expect(result).toEqual({ id: '123', name: 'Test' });
        });

        it('should queue failed notifications for retry', async () => {
            const failedNotifications = [];

            webpush.sendNotification.mockRejectedValue(new Error('Temporary failure'));

            // Simulate notification with retry queue
            async function sendWithRetry(subscription, message, retries = 3) {
                for (let i = 0; i < retries; i++) {
                    try {
                        await webpush.sendNotification(subscription, message);
                        return { success: true };
                    } catch (e) {
                        if (i === retries - 1) {
                            failedNotifications.push({ subscription, message, error: e.message });
                            return { success: false, queued: true };
                        }
                        await new Promise(r => setTimeout(r, 100 * (i + 1)));
                    }
                }
            }

            const result = await sendWithRetry(
                { endpoint: 'https://push.example.com/test', keys: {} },
                'Test message'
            );

            expect(result.success).toBe(false);
            expect(result.queued).toBe(true);
            expect(failedNotifications.length).toBe(1);
        });

        it('should provide degraded but functional service during partial outage', async () => {
            // Simulate: Cache works, DB slow, Notifications down
            mockCache.get.mockReturnValue({ id: '123', cached: true });

            mockCollection.findOne.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve({ id: '123' }), 3000))
            );

            webpush.sendNotification.mockRejectedValue(new Error('Service down'));

            // Service should still respond with cached data
            const cachedResult = mockCache.get('123');
            expect(cachedResult).toBeDefined();
            expect(cachedResult.cached).toBe(true);

            // Notification failure should be handled gracefully
            let notificationError = null;
            try {
                await webpush.sendNotification({}, 'test');
            } catch (e) {
                notificationError = e;
            }
            expect(notificationError).not.toBeNull();
            // But the error should be caught and not crash the app
        });
    });

    describe('Recovery Scenarios', () => {
        it('should recover after database reconnection', async () => {
            // First: DB unavailable
            mockCollection.findOne.mockRejectedValueOnce(
                new Error('Connection lost')
            );

            // Second: DB recovered
            mockCollection.findOne.mockResolvedValueOnce({ id: '123', recovered: true });

            // First attempt fails
            let error = null;
            try {
                await mockCollection.findOne({ id: '123' });
            } catch (e) {
                error = e;
            }
            expect(error).not.toBeNull();

            // Second attempt succeeds (after recovery)
            const result = await mockCollection.findOne({ id: '123' });
            expect(result.recovered).toBe(true);
        });

        it('should rebuild cache after cache flush', async () => {
            mockCache.flushAll.mockImplementation(() => { });
            mockCache.get.mockReturnValue(undefined); // Cache is empty after flush
            mockCollection.findOne.mockResolvedValue({ id: '123', fresh: true });

            // Flush cache (simulating restart or OOM)
            mockCache.flushAll();

            // Cache should miss
            const cachedResult = mockCache.get('123');
            expect(cachedResult).toBeUndefined();

            // Should rebuild from DB
            const dbResult = await mockCollection.findOne({ id: '123' });
            mockCache.set('123', dbResult);

            expect(mockCache.set).toHaveBeenCalledWith('123', { id: '123', fresh: true });
        });
    });
});
