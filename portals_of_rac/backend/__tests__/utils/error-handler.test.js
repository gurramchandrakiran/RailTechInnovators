/**
 * Error Handler Tests
 */

const {
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
} = require('../../utils/error-handler');

describe('Error Classes', () => {
    describe('AppError', () => {
        it('should create app error with defaults', () => {
            const error = new AppError('Test error');
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('INTERNAL_ERROR');
            expect(error.timestamp).toBeDefined();
        });

        it('should create app error with custom values', () => {
            const error = new AppError('Custom error', 400, 'CUSTOM_CODE', { field: 'value' });
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('CUSTOM_CODE');
            expect(error.details).toEqual({ field: 'value' });
        });
    });

    describe('ValidationError', () => {
        it('should create validation error', () => {
            const error = new ValidationError('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('NotFoundError', () => {
        it('should create not found error', () => {
            const error = new NotFoundError('Resource not found');
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('NOT_FOUND');
        });
    });

    describe('AuthenticationError', () => {
        it('should create authentication error', () => {
            const error = new AuthenticationError('Invalid credentials');
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('AUTHENTICATION_ERROR');
        });
    });

    describe('AuthorizationError', () => {
        it('should create authorization error', () => {
            const error = new AuthorizationError('Access denied');
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe('AUTHORIZATION_ERROR');
        });
    });

    describe('ConflictError', () => {
        it('should create conflict error', () => {
            const error = new ConflictError('Resource exists');
            expect(error.statusCode).toBe(409);
            expect(error.code).toBe('CONFLICT_ERROR');
        });
    });

    describe('DatabaseError', () => {
        it('should create database error', () => {
            const error = new DatabaseError('DB connection failed');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('DATABASE_ERROR');
        });
    });

    describe('ExternalServiceError', () => {
        it('should create external service error', () => {
            const error = new ExternalServiceError('Service unavailable');
            expect(error.statusCode).toBe(503);
            expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
        });
    });
});

describe('errorHandler middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        process.env.NODE_ENV = 'test';
    });

    it('should handle AppError', () => {
        const error = new AppError('Test error', 400);
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'Test error',
                    statusCode: 400
                })
            })
        );
    });

    it('should convert ValidationError', () => {
        const error = { name: 'ValidationError', message: 'Invalid', errors: {} };
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should convert CastError', () => {
        const error = { name: 'CastError', message: 'Invalid ID' };
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should convert JsonWebTokenError', () => {
        const error = { name: 'JsonWebTokenError', message: 'Invalid token' };
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should convert TokenExpiredError', () => {
        const error = { name: 'TokenExpiredError', message: 'Token expired' };
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle generic errors', () => {
        const error = new Error('Generic error');
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should include details in development', () => {
        process.env.NODE_ENV = 'development';
        const error = new AppError('Test', 400, 'TEST', { field: 'value' });
        errorHandler(error, req, res, next);

        const response = res.json.mock.calls[0][0];
        expect(response.error.details).toEqual({ field: 'value' });
    });
});

describe('asyncHandler', () => {
    it('should wrap async function', async () => {
        const fn = jest.fn().mockResolvedValue('result');
        const wrapped = asyncHandler(fn);
        const req = {}, res = {}, next = jest.fn();

        await wrapped(req, res, next);

        expect(fn).toHaveBeenCalledWith(req, res, next);
        expect(next).not.toHaveBeenCalled();
    });

    it('should catch async errors', async () => {
        const error = new Error('Async error');
        const fn = jest.fn().mockRejectedValue(error);
        const wrapped = asyncHandler(fn);
        const req = {}, res = {}, next = jest.fn();

        await wrapped(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle async thrown errors', async () => {
        const fn = jest.fn().mockImplementation(async () => {
            throw new Error('Thrown error');
        });
        const wrapped = asyncHandler(fn);
        const req = {}, res = {}, next = jest.fn();

        await wrapped(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should pass through resolved values', async () => {
        const fn = jest.fn().mockResolvedValue({ data: 'test' });
        const wrapped = asyncHandler(fn);
        const req = {}, res = {}, next = jest.fn();

        const result = await wrapped(req, res, next);

        expect(fn).toHaveBeenCalled();
    });
});

describe('formatErrorResponse', () => {
    it('should format error response', () => {
        const error = { message: 'Test error', code: 'TEST' };
        const response = formatErrorResponse(error, 400);

        expect(response).toEqual({
            success: false,
            error: expect.objectContaining({
                code: 'TEST',
                message: 'Test error',
                statusCode: 400,
                timestamp: expect.any(String)
            })
        });
    });

    it('should use default values', () => {
        const error = {};
        const response = formatErrorResponse(error);

        expect(response.error.code).toBe('UNKNOWN_ERROR');
        expect(response.error.message).toBe('An unexpected error occurred');
        expect(response.error.statusCode).toBe(500);
    });

    it('should include stack in development', () => {
        process.env.NODE_ENV = 'development';
        const error = { message: 'Test', stack: 'stack trace', details: {} };
        const response = formatErrorResponse(error);

        expect(response.error.stack).toBe('stack trace');
        expect(response.error.details).toBeDefined();
    });
});

// 22 tests
