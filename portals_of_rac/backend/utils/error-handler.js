/**
 * error-handler.js
 * Standardized error handling for the application
 * Provides consistent error responses across all endpoints
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(message, details = {}) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message, details = {}) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

class AuthorizationError extends AppError {
  constructor(message, details = {}) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

class ConflictError extends AppError {
  constructor(message, details = {}) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

class DatabaseError extends AppError {
  constructor(message, details = {}) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

class ExternalServiceError extends AppError {
  constructor(message, details = {}) {
    super(message, 503, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

/**
 * Global error handler middleware
 * Catches all errors and returns standardized response
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle non-AppError instances
  if (!(error instanceof AppError)) {
    if (error.name === 'ValidationError') {
      error = new ValidationError(error.message, { details: error.errors });
    } else if (error.name === 'CastError') {
      error = new ValidationError('Invalid ID format');
    } else if (error.name === 'JsonWebTokenError') {
      error = new AuthenticationError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      error = new AuthenticationError('Token expired');
    } else {
      error = new AppError(error.message, 500, 'INTERNAL_ERROR', {
        originalError: error.name
      });
    }
  }

  // Log error
  const logLevel = error.statusCode >= 500 ? 'ERROR' : 'WARN';
  console.log(`[${logLevel}] ${error.code} - ${error.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`      Stack: ${error.stack}`);
  }

  // Send response
  return res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      ...(process.env.NODE_ENV === 'development' && { details: error.details }),
      timestamp: error.timestamp
    }
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Error response formatter
 */
const formatErrorResponse = (error, statusCode = 500) => {
  return {
    success: false,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      statusCode,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { 
        details: error.details,
        stack: error.stack 
      })
    }
  };
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  errorHandler,
  asyncHandler,
  formatErrorResponse
};
