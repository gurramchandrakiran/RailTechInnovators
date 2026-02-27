/**
 * Environment Validator Tests
 */

const envValidator = require('../../utils/envValidator');

describe('Environment Validator', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('validateEnv', () => {
        it('should validate environment with all required vars', () => {
            process.env.JWT_SECRET = 'test-secret-key';
            envValidator.validateEnv();
            expect(process.env.JWT_SECRET).toBe('test-secret-key');
        });

        it('should use default values when not set', () => {
            delete process.env.PORT;
            envValidator.validateEnv();
            expect(process.env.PORT).toBe('5000');
        });

        it('should set default NODE_ENV', () => {
            delete process.env.NODE_ENV;
            envValidator.validateEnv();
            expect(process.env.NODE_ENV).toBe('development');
        });

        it('should handle missing optional vars', () => {
            delete process.env.VAPID_PUBLIC_KEY;
            envValidator.validateEnv();
            expect(process.env.NODE_ENV).toBeDefined();
        });
    });
});

// 4 tests for envValidator
