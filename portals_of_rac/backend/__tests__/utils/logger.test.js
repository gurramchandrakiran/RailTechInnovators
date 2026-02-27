/**
 * Logger Tests
 */

describe('Logger', () => {
    let logger;
    let consoleLogSpy, consoleWarnSpy, consoleErrorSpy;

    beforeEach(() => {
        jest.resetModules();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        logger = require('../../utils/logger');
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('info', () => {
        it('should log info messages', () => {
            logger.info('Test info');
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe('warn', () => {
        it('should log warning messages', () => {
            logger.warn('Test warning');
            expect(consoleWarnSpy).toHaveBeenCalled();
        });
    });

    describe('error', () => {
        it('should log error messages', () => {
            logger.error('Test error');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('debug', () => {
        it('should have debug method', () => {
            expect(typeof logger.debug).toBe('function');
        });
    });
});

// 4 tests
