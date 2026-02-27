// backend/services/CacheService.js
// In-memory caching layer for performance optimization

const NodeCache = require('node-cache');

// Cache configuration with TTL (time-to-live) in seconds
const cacheConfig = {
    trainState: { stdTTL: 30, checkperiod: 60 },      // Train state: 30 seconds
    passengers: { stdTTL: 60, checkperiod: 120 },     // Passenger data: 60 seconds
    reallocation: { stdTTL: 120, checkperiod: 180 },  // Reallocation results: 2 minutes
    stats: { stdTTL: 15, checkperiod: 30 },           // Statistics: 15 seconds
    eligibility: { stdTTL: 120, checkperiod: 180 }    // Eligibility matrix: 2 minutes
};

class CacheService {
    constructor() {
        // Create separate cache instances for different data types
        this.trainStateCache = new NodeCache(cacheConfig.trainState);
        this.passengersCache = new NodeCache(cacheConfig.passengers);
        this.reallocationCache = new NodeCache(cacheConfig.reallocation);
        this.statsCache = new NodeCache(cacheConfig.stats);
        this.eligibilityCache = new NodeCache(cacheConfig.eligibility);

        // Track cache statistics
        this.metrics = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };

        console.log('📦 CacheService initialized');
    }

    /**
     * Generate cache key with pattern: "module:entity:identifier"
     */
    generateKey(module, entity, identifier) {
        return `${module}:${entity}:${identifier}`;
    }

    // ========== Train State Cache ==========

    getTrainState(trainNo) {
        const key = this.generateKey('train', 'state', trainNo);
        const value = this.trainStateCache.get(key);
        if (value) {
            this.metrics.hits++;
            return value;
        }
        this.metrics.misses++;
        return null;
    }

    setTrainState(trainNo, data) {
        const key = this.generateKey('train', 'state', trainNo);
        this.trainStateCache.set(key, data);
        this.metrics.sets++;
    }

    invalidateTrainState(trainNo) {
        const key = this.generateKey('train', 'state', trainNo);
        this.trainStateCache.del(key);
        this.metrics.deletes++;
    }

    // ========== Passenger Cache ==========

    getPassengers(trainNo, filter = 'all') {
        const key = this.generateKey('passengers', trainNo, filter);
        const value = this.passengersCache.get(key);
        if (value) {
            this.metrics.hits++;
            return value;
        }
        this.metrics.misses++;
        return null;
    }

    setPassengers(trainNo, filter, data) {
        const key = this.generateKey('passengers', trainNo, filter);
        this.passengersCache.set(key, data);
        this.metrics.sets++;
    }

    invalidatePassengers(trainNo) {
        // Invalidate all passenger caches for this train
        const keys = this.passengersCache.keys().filter(k => k.includes(`:${trainNo}:`));
        keys.forEach(k => this.passengersCache.del(k));
        this.metrics.deletes += keys.length;
    }

    // ========== Stats Cache ==========

    getStats(trainNo) {
        const key = this.generateKey('stats', 'train', trainNo);
        const value = this.statsCache.get(key);
        if (value) {
            this.metrics.hits++;
            return value;
        }
        this.metrics.misses++;
        return null;
    }

    setStats(trainNo, data) {
        const key = this.generateKey('stats', 'train', trainNo);
        this.statsCache.set(key, data);
        this.metrics.sets++;
    }

    invalidateStats(trainNo) {
        const key = this.generateKey('stats', 'train', trainNo);
        this.statsCache.del(key);
        this.metrics.deletes++;
    }

    // ========== Reallocation Cache ==========

    getReallocation(trainNo, stationCode) {
        const key = this.generateKey('reallocation', trainNo, stationCode);
        const value = this.reallocationCache.get(key);
        if (value) {
            this.metrics.hits++;
            return value;
        }
        this.metrics.misses++;
        return null;
    }

    setReallocation(trainNo, stationCode, data) {
        const key = this.generateKey('reallocation', trainNo, stationCode);
        this.reallocationCache.set(key, data);
        this.metrics.sets++;
    }

    invalidateReallocation(trainNo) {
        // Invalidate all reallocation caches for this train
        const keys = this.reallocationCache.keys().filter(k => k.includes(`:${trainNo}:`));
        keys.forEach(k => this.reallocationCache.del(k));
        this.metrics.deletes += keys.length;
    }

    // ========== Eligibility Cache ==========

    getEligibility(trainNo, stationCode) {
        const key = this.generateKey('eligibility', trainNo, stationCode);
        const value = this.eligibilityCache.get(key);
        if (value) {
            this.metrics.hits++;
            return value;
        }
        this.metrics.misses++;
        return null;
    }

    setEligibility(trainNo, stationCode, data) {
        const key = this.generateKey('eligibility', trainNo, stationCode);
        this.eligibilityCache.set(key, data);
        this.metrics.sets++;
    }

    invalidateEligibility(trainNo) {
        const keys = this.eligibilityCache.keys().filter(k => k.includes(`:${trainNo}:`));
        keys.forEach(k => this.eligibilityCache.del(k));
        this.metrics.deletes += keys.length;
    }

    // ========== Bulk Invalidation ==========

    /**
     * Invalidate all caches for a train (use when train state changes significantly)
     */
    invalidateAllForTrain(trainNo) {
        this.invalidateTrainState(trainNo);
        this.invalidatePassengers(trainNo);
        this.invalidateStats(trainNo);
        this.invalidateReallocation(trainNo);
        this.invalidateEligibility(trainNo);
        console.log(`🗑️ Cache invalidated for train ${trainNo}`);
    }

    /**
     * Clear all caches (use with caution)
     */
    flushAll() {
        this.trainStateCache.flushAll();
        this.passengersCache.flushAll();
        this.reallocationCache.flushAll();
        this.statsCache.flushAll();
        this.eligibilityCache.flushAll();
        console.log('🗑️ All caches flushed');
    }

    // ========== Metrics ==========

    getMetrics() {
        const hitRatio = this.metrics.hits + this.metrics.misses > 0
            ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.metrics,
            hitRatio: `${hitRatio}%`,
            caches: {
                trainState: this.trainStateCache.getStats(),
                passengers: this.passengersCache.getStats(),
                reallocation: this.reallocationCache.getStats(),
                stats: this.statsCache.getStats(),
                eligibility: this.eligibilityCache.getStats()
            }
        };
    }

    resetMetrics() {
        this.metrics = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    }

    // ========== Cache Warming ==========

    /**
     * Warm the cache on startup by pre-loading common data
     * Call this after database connection is established
     */
    async warmCache(db) {
        console.log('🔥 Starting cache warming...');
        const startTime = Date.now();

        try {
            // Warm train state if exists
            if (global.RAC_CONFIG?.trainNo && db) {
                const trainNo = global.RAC_CONFIG.trainNo;

                // Pre-cache passengers count by status
                const passengersCollection = db.collection(global.RAC_CONFIG.passengersCollection);
                if (passengersCollection) {
                    const passengerCounts = await passengersCollection.aggregate([
                        { $group: { _id: '$PNR_Status', count: { $sum: 1 } } }
                    ]).toArray();

                    this.setStats(trainNo, {
                        counts: passengerCounts,
                        warmedAt: new Date().toISOString()
                    });
                    console.log(`  ✓ Cached passenger stats for train ${trainNo}`);
                }

                // Pre-cache RAC queue
                if (passengersCollection) {
                    const racPassengers = await passengersCollection.find({
                        PNR_Status: 'RAC'
                    }).project({
                        PNR_Number: 1,
                        Name: 1,
                        Boarding_Station: 1,
                        Deboarding_Station: 1,
                        Assigned_Coach: 1,
                        Assigned_berth: 1
                    }).toArray();

                    this.setPassengers(trainNo, 'rac', racPassengers);
                    console.log(`  ✓ Cached ${racPassengers.length} RAC passengers`);
                }
            }

            const duration = Date.now() - startTime;
            console.log(`🔥 Cache warming complete in ${duration}ms`);
            return { success: true, duration };
        } catch (error) {
            console.error('⚠️ Cache warming failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new CacheService();
