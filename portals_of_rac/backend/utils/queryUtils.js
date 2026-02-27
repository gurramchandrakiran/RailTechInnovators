// backend/utils/queryUtils.js
// Query utilities for performance optimization

/**
 * Execute a MongoDB query with timeout protection
 * Prevents slow queries from blocking the connection pool
 * 
 * @param {Function} queryFn - Function that returns a MongoDB cursor/promise
 * @param {Object} options - Options including timeout
 * @returns {Promise} Query result or timeout error
 */
async function withTimeout(queryFn, options = {}) {
    const {
        timeout = 5000,     // Default 5 seconds
        name = 'query',     // Query name for logging
        fallback = null     // Value to return on timeout (null throws error)
    } = options;

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            const error = new Error(`Query "${name}" timed out after ${timeout}ms`);
            error.code = 'QUERY_TIMEOUT';
            reject(error);
        }, timeout);
    });

    try {
        const startTime = Date.now();
        const result = await Promise.race([queryFn(), timeoutPromise]);
        const duration = Date.now() - startTime;

        // Log slow queries (but not timed out ones)
        if (duration > 500) {
            console.warn(`⚠️ Slow query "${name}" took ${duration}ms`);
        }

        return result;
    } catch (error) {
        if (error.code === 'QUERY_TIMEOUT' && fallback !== null) {
            console.warn(`⚠️ ${error.message}, returning fallback`);
            return fallback;
        }
        throw error;
    }
}

/**
 * Query timeout presets based on query type
 */
const QueryTimeouts = {
    FAST: 100,        // Index-based queries
    MEDIUM: 500,      // Simple aggregations
    SLOW: 2000,       // Complex aggregations
    BULK: 10000,      // Bulk operations
    DEFAULT: 5000     // General default
};

/**
 * Retry a query with exponential backoff
 * 
 * @param {Function} queryFn - Function to retry
 * @param {Object} options - Retry options
 */
async function withRetry(queryFn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 100,
        maxDelay = 2000,
        name = 'query'
    } = options;

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries) break;

            const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
            console.warn(`⚠️ Query "${name}" failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Paginate query results
 * 
 * @param {Object} collection - MongoDB collection
 * @param {Object} filter - Query filter
 * @param {Object} options - Pagination options
 */
async function paginate(collection, filter, options = {}) {
    const {
        page = 1,
        limit = 50,
        sort = {},
        projection = {}
    } = options;

    const skip = (page - 1) * limit;

    const [results, totalCount] = await Promise.all([
        collection.find(filter)
            .project(projection)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .toArray(),
        collection.countDocuments(filter)
    ]);

    return {
        data: results,
        pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNext: page * limit < totalCount,
            hasPrev: page > 1
        }
    };
}

module.exports = {
    withTimeout,
    withRetry,
    paginate,
    QueryTimeouts
};
