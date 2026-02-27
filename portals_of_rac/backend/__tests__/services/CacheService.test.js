/**
 * CacheService Tests - Comprehensive Coverage
 * Tests for in-memory caching layer with NodeCache
 */

const CacheService = require('../../services/CacheService');

describe('CacheService - Comprehensive Tests', () => {
    beforeEach(() => {
        CacheService.flushAll();
        CacheService.resetMetrics();
    });

    describe('generateKey', () => {
        it('should generate cache key with correct pattern', () => {
            const key = CacheService.generateKey('train', 'state', '17225');
            expect(key).toBe('train:state:17225');
        });

        it('should generate unique keys for different entities', () => {
            const key1 = CacheService.generateKey('train', 'state', '17225');
            const key2 = CacheService.generateKey('train', 'stats', '17225');
            expect(key1).not.toBe(key2);
        });
    });

    describe('Train State Cache', () => {
        it('should set and get train state', () => {
            const trainData = { trainNo: '17225', name: 'Express' };
            CacheService.setTrainState('17225', trainData);

            const cached = CacheService.getTrainState('17225');
            expect(cached).toEqual(trainData);
        });

        it('should return null for non-existent train state', () => {
            const cached = CacheService.getTrainState('99999');
            expect(cached).toBeNull();
        });

        it('should invalidate train state', () => {
            CacheService.setTrainState('17225', { data: 'test' });
            CacheService.invalidateTrainState('17225');

            const cached = CacheService.getTrainState('17225');
            expect(cached).toBeNull();
        });

        it('should track metrics on set', () => {
            CacheService.setTrainState('17225', {});
            const metrics = CacheService.getMetrics();
            expect(metrics.sets).toBe(1);
        });

        it('should track hits on successful get', () => {
            CacheService.setTrainState('17225', {});
            CacheService.getTrainState('17225');
            const metrics = CacheService.getMetrics();
            expect(metrics.hits).toBe(1);
        });

        it('should track misses on failed get', () => {
            CacheService.getTrainState('99999');
            const metrics = CacheService.getMetrics();
            expect(metrics.misses).toBe(1);
        });
    });

    describe('Passenger Cache', () => {
        it('should set and get passengers with filter', () => {
            const passengers = [{ pnr: 'P001', name: 'John' }];
            CacheService.setPassengers('17225', 'rac', passengers);

            const cached = CacheService.getPassengers('17225', 'rac');
            expect(cached).toEqual(passengers);
        });

        it('should return null for non-existent passengers', () => {
            const cached = CacheService.getPassengers('99999', 'all');
            expect(cached).toBeNull();
        });

        it('should invalidate all passenger caches for train', () => {
            CacheService.setPassengers('17225', 'rac', []);
            CacheService.setPassengers('17225', 'cnf', []);
            CacheService.invalidatePassengers('17225');

            expect(CacheService.getPassengers('17225', 'rac')).toBeNull();
            expect(CacheService.getPassengers('17225', 'cnf')).toBeNull();
        });

        it('should support different filters for same train', () => {
            const racData = [{ status: 'RAC' }];
            const cnfData = [{ status: 'CNF' }];

            CacheService.setPassengers('17225', 'rac', racData);
            CacheService.setPassengers('17225', 'cnf', cnfData);

            expect(CacheService.getPassengers('17225', 'rac')).toEqual(racData);
            expect(CacheService.getPassengers('17225', 'cnf')).toEqual(cnfData);
        });
    });

    describe('Stats Cache', () => {
        it('should set and get stats', () => {
            const stats = { total: 100, rac: 20 };
            CacheService.setStats('17225', stats);

            const cached = CacheService.getStats('17225');
            expect(cached).toEqual(stats);
        });

        it('should return null for non-existent stats', () => {
            const cached = CacheService.getStats('99999');
            expect(cached).toBeNull();
        });

        it('should invalidate stats', () => {
            CacheService.setStats('17225', { data: 'test' });
            CacheService.invalidateStats('17225');

            const cached = CacheService.getStats('17225');
            expect(cached).toBeNull();
        });
    });

    describe('Reallocation Cache', () => {
        it('should set and get reallocation data', () => {
            const reallocationData = { eligible: [{ pnr: 'R001' }] };
            CacheService.setReallocation('17225', 'STB', reallocationData);

            const cached = CacheService.getReallocation('17225', 'STB');
            expect(cached).toEqual(reallocationData);
        });

        it('should return null for non-existent reallocation', () => {
            const cached = CacheService.getReallocation('99999', 'STA');
            expect(cached).toBeNull();
        });

        it('should invalidate all reallocation caches for train', () => {
            CacheService.setReallocation('17225', 'STA', {});
            CacheService.setReallocation('17225', 'STB', {});
            CacheService.invalidateReallocation('17225');

            expect(CacheService.getReallocation('17225', 'STA')).toBeNull();
            expect(CacheService.getReallocation('17225', 'STB')).toBeNull();
        });

        it('should support different stations for same train', () => {
            const dataA = { station: 'STA' };
            const dataB = { station: 'STB' };

            CacheService.setReallocation('17225', 'STA', dataA);
            CacheService.setReallocation('17225', 'STB', dataB);

            expect(CacheService.getReallocation('17225', 'STA')).toEqual(dataA);
            expect(CacheService.getReallocation('17225', 'STB')).toEqual(dataB);
        });
    });

    describe('Eligibility Cache', () => {
        it('should set and get eligibility data', () => {
            const eligibilityData = { eligible: [{ pnr: 'R001' }] };
            CacheService.setEligibility('17225', 'STB', eligibilityData);

            const cached = CacheService.getEligibility('17225', 'STB');
            expect(cached).toEqual(eligibilityData);
        });

        it('should return null for non-existent eligibility', () => {
            const cached = CacheService.getEligibility('99999', 'STA');
            expect(cached).toBeNull();
        });

        it('should invalidate all eligibility caches for train', () => {
            CacheService.setEligibility('17225', 'STA', {});
            CacheService.setEligibility('17225', 'STB', {});
            CacheService.invalidateEligibility('17225');

            expect(CacheService.getEligibility('17225', 'STA')).toBeNull();
            expect(CacheService.getEligibility('17225', 'STB')).toBeNull();
        });
    });

    describe('Bulk Invalidation', () => {
        it('should invalidate all caches for a train', () => {
            CacheService.setTrainState('17225', {});
            CacheService.setPassengers('17225', 'all', []);
            CacheService.setStats('17225', {});
            CacheService.setReallocation('17225', 'STA', {});
            CacheService.setEligibility('17225', 'STA', {});

            CacheService.invalidateAllForTrain('17225');

            expect(CacheService.getTrainState('17225')).toBeNull();
            expect(CacheService.getPassengers('17225', 'all')).toBeNull();
            expect(CacheService.getStats('17225')).toBeNull();
            expect(CacheService.getReallocation('17225', 'STA')).toBeNull();
            expect(CacheService.getEligibility('17225', 'STA')).toBeNull();
        });

        it('should flush all caches', () => {
            CacheService.setTrainState('17225', {});
            CacheService.setPassengers('17226', 'all', []);
            CacheService.setStats('17227', {});

            CacheService.flushAll();

            expect(CacheService.getTrainState('17225')).toBeNull();
            expect(CacheService.getPassengers('17226', 'all')).toBeNull();
            expect(CacheService.getStats('17227')).toBeNull();
        });
    });

    describe('Metrics', () => {
        it('should return correct metrics', () => {
            CacheService.setTrainState('17225', {});
            CacheService.getTrainState('17225');
            CacheService.getTrainState('99999');

            const metrics = CacheService.getMetrics();

            expect(metrics.hits).toBe(1);
            expect(metrics.misses).toBe(1);
            expect(metrics.sets).toBe(1);
            expect(metrics.hitRatio).toBe('50.00%');
        });

        it('should calculate hit ratio correctly', () => {
            CacheService.setTrainState('17225', {});
            CacheService.getTrainState('17225');
            CacheService.getTrainState('17225');
            CacheService.getTrainState('99999');

            const metrics = CacheService.getMetrics();
            expect(metrics.hitRatio).toBe('66.67%');
        });

        it('should reset metrics', () => {
            CacheService.setTrainState('17225', {});
            CacheService.getTrainState('17225');

            CacheService.resetMetrics();
            const metrics = CacheService.getMetrics();

            expect(metrics.hits).toBe(0);
            expect(metrics.misses).toBe(0);
            expect(metrics.sets).toBe(0);
            expect(metrics.deletes).toBe(0);
        });

        it('should return 0% hit ratio when no operations', () => {
            const metrics = CacheService.getMetrics();
            expect(metrics.hitRatio).toBe('0%');
        });

        it('should include cache stats for all caches', () => {
            const metrics = CacheService.getMetrics();
            expect(metrics.caches).toHaveProperty('trainState');
            expect(metrics.caches).toHaveProperty('passengers');
            expect(metrics.caches).toHaveProperty('reallocation');
            expect(metrics.caches).toHaveProperty('stats');
            expect(metrics.caches).toHaveProperty('eligibility');
        });
    });

    describe('Cache Warming', () => {
        it('should handle warmCache with no database', async () => {
            const result = await CacheService.warmCache(null);
            expect(result.success).toBe(true);
        });

        it('should handle warmCache errors gracefully', async () => {
            global.RAC_CONFIG = {
                trainNo: '17225',
                passengersCollection: 'test_passengers'
            };

            const mockDb = {
                collection: jest.fn().mockImplementation(() => {
                    throw new Error('DB error');
                })
            };

            const result = await CacheService.warmCache(mockDb);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should warm cache with valid database', async () => {
            global.RAC_CONFIG = {
                trainNo: '17225',
                passengersCollection: 'test_passengers'
            };

            const mockDb = {
                collection: jest.fn(() => ({
                    aggregate: jest.fn(() => ({
                        toArray: jest.fn().mockResolvedValue([
                            { _id: 'CNF', count: 80 },
                            { _id: 'RAC', count: 20 }
                        ])
                    })),
                    find: jest.fn(() => ({
                        project: jest.fn(() => ({
                            toArray: jest.fn().mockResolvedValue([
                                { PNR_Number: 'R001', Name: 'John' }
                            ])
                        }))
                    }))
                }))
            };

            const result = await CacheService.warmCache(mockDb);
            expect(result.success).toBe(true);
            expect(result.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Cache Isolation', () => {
        it('should keep different train caches separate', () => {
            CacheService.setTrainState('17225', { train: 'A' });
            CacheService.setTrainState('17226', { train: 'B' });

            expect(CacheService.getTrainState('17225')).toEqual({ train: 'A' });
            expect(CacheService.getTrainState('17226')).toEqual({ train: 'B' });
        });

        it('should only invalidate specified train', () => {
            CacheService.setTrainState('17225', {});
            CacheService.setTrainState('17226', {});

            CacheService.invalidateTrainState('17225');

            expect(CacheService.getTrainState('17225')).toBeNull();
            expect(CacheService.getTrainState('17226')).not.toBeNull();
        });
    });

    describe('Edge Cases', () => {
        it('should handle setting null values', () => {
            CacheService.setTrainState('17225', null);
            const cached = CacheService.getTrainState('17225');
            expect(cached).toBeNull();
        });

        it('should handle setting undefined values', () => {
            CacheService.setTrainState('17225', undefined);
            const cached = CacheService.getTrainState('17225');
            // NodeCache returns null for undefined values
            expect(cached).toBeNull();
        });

        it('should handle complex objects', () => {
            const complexData = {
                nested: {
                    deep: {
                        value: [1, 2, 3],
                        map: { a: 1, b: 2 }
                    }
                }
            };

            CacheService.setTrainState('17225', complexData);
            const cached = CacheService.getTrainState('17225');
            expect(cached).toEqual(complexData);
        });

        it('should handle multiple deletes correctly', () => {
            CacheService.setTrainState('17225', {});
            CacheService.invalidateTrainState('17225');
            CacheService.invalidateTrainState('17225');

            const metrics = CacheService.getMetrics();
            expect(metrics.deletes).toBe(2);
        });
    });
});
