// backend/middleware/errorHandler.js
// Standardized error handling middleware

/**
 * Custom error class for API errors
 */
class APIError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.code = code;
        this.timestamp = new Date().toISOString();

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Common error types
 */
const ErrorTypes = {
    // 400 - Bad Request
    BAD_REQUEST: (message = 'Bad request') => new APIError(message, 400, 'BAD_REQUEST'),
    VALIDATION_ERROR: (message = 'Validation failed') => new APIError(message, 400, 'VALIDATION_ERROR'),
    INVALID_INPUT: (message = 'Invalid input') => new APIError(message, 400, 'INVALID_INPUT'),

    // 401 - Unauthorized
    UNAUTHORIZED: (message = 'Authentication required') => new APIError(message, 401, 'UNAUTHORIZED'),
    TOKEN_EXPIRED: (message = 'Token has expired') => new APIError(message, 401, 'TOKEN_EXPIRED'),
    INVALID_TOKEN: (message = 'Invalid token') => new APIError(message, 401, 'INVALID_TOKEN'),

    // 403 - Forbidden
    FORBIDDEN: (message = 'Access denied') => new APIError(message, 403, 'FORBIDDEN'),
    INSUFFICIENT_PERMISSIONS: (message = 'Insufficient permissions') => new APIError(message, 403, 'INSUFFICIENT_PERMISSIONS'),

    // 404 - Not Found
    NOT_FOUND: (message = 'Resource not found') => new APIError(message, 404, 'NOT_FOUND'),
    PASSENGER_NOT_FOUND: (message = 'Passenger not found') => new APIError(message, 404, 'PASSENGER_NOT_FOUND'),
    TRAIN_NOT_FOUND: (message = 'Train not found') => new APIError(message, 404, 'TRAIN_NOT_FOUND'),

    // 409 - Conflict
    CONFLICT: (message = 'Resource conflict') => new APIError(message, 409, 'CONFLICT'),
    ALREADY_EXISTS: (message = 'Resource already exists') => new APIError(message, 409, 'ALREADY_EXISTS'),

    // 429 - Too Many Requests
    RATE_LIMITED: (message = 'Too many requests') => new APIError(message, 429, 'RATE_LIMITED'),

    // 500 - Server Error
    INTERNAL_ERROR: (message = 'Internal server error') => new APIError(message, 500, 'INTERNAL_ERROR'),
    DATABASE_ERROR: (message = 'Database operation failed') => new APIError(message, 500, 'DATABASE_ERROR'),
    SERVICE_UNAVAILABLE: (message = 'Service temporarily unavailable') => new APIError(message, 503, 'SERVICE_UNAVAILABLE')
};

/**
 * Async handler wrapper - catches errors in async route handlers
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handler middleware
 * Must be registered AFTER all routes
 */
const errorHandler = (err, req, res, next) => {
    // Log error
    console.error('❌ Error:', {
        message: err.message,
        code: err.code || 'UNKNOWN',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Handle known APIError
    if (err instanceof APIError) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                timestamp: err.timestamp
            }
        });
    }

    // Handle Mongoose/MongoDB errors
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'DUPLICATE_KEY',
                    message: 'Resource already exists',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: err.message,
                timestamp: new Date().toISOString()
            }
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid token',
                timestamp: new Date().toISOString()
            }
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_EXPIRED',
                message: 'Token has expired',
                timestamp: new Date().toISOString()
            }
        });
    }

    // Default to 500 Internal Server Error
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred'
                : err.message,
            timestamp: new Date().toISOString()
        }
    });
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
            timestamp: new Date().toISOString()
        }
    });
};

module.exports = {
    APIError,
    ErrorTypes,
    asyncHandler,
    errorHandler,
    notFoundHandler
};
