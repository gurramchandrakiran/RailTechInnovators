/**
 * Logger Utility
 * Provides level-gated logging based on LOG_LEVEL environment variable
 * 
 * Levels: ERROR < WARN < INFO < DEBUG
 * Default: INFO
 * 
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.debug('Eligibility check', { pnr, vacancy });
 *   logger.info('Upgrade completed');
 *   logger.warn('Berth conflict detected');
 *   logger.error('Database connection failed', error);
 */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Get configured log level from environment, default to INFO
const getConfiguredLevel = () => {
    const envLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
    return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.INFO;
};

const configuredLevel = getConfiguredLevel();

/**
 * Format log message with timestamp and level
 */
const formatMessage = (level, message, data) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;

    if (data !== undefined) {
        return { prefix, message, data };
    }
    return { prefix, message };
};

/**
 * Log at DEBUG level (most verbose)
 * Use for: eligibility calculations, detailed flow tracing
 */
const debug = (message, data) => {
    if (configuredLevel >= LOG_LEVELS.DEBUG) {
        const { prefix } = formatMessage('DEBUG', message, data);
        if (data !== undefined) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }
};

/**
 * Log at INFO level
 * Use for: successful operations, state changes
 */
const info = (message, data) => {
    if (configuredLevel >= LOG_LEVELS.INFO) {
        const { prefix } = formatMessage('INFO', message, data);
        if (data !== undefined) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }
};

/**
 * Log at WARN level
 * Use for: recoverable issues, deprecated usage
 */
const warn = (message, data) => {
    if (configuredLevel >= LOG_LEVELS.WARN) {
        const { prefix } = formatMessage('WARN', message, data);
        if (data !== undefined) {
            console.warn(`${prefix} ${message}`, data);
        } else {
            console.warn(`${prefix} ${message}`);
        }
    }
};

/**
 * Log at ERROR level (always logged unless LOG_LEVEL=SILENT)
 * Use for: unrecoverable errors, exceptions
 */
const error = (message, data) => {
    if (configuredLevel >= LOG_LEVELS.ERROR) {
        const { prefix } = formatMessage('ERROR', message, data);
        if (data !== undefined) {
            console.error(`${prefix} ${message}`, data);
        } else {
            console.error(`${prefix} ${message}`);
        }
    }
};

/**
 * Check if a specific log level is enabled
 */
const isEnabled = (level) => {
    const levelNum = LOG_LEVELS[level.toUpperCase()];
    return levelNum !== undefined && configuredLevel >= levelNum;
};

module.exports = {
    debug,
    info,
    warn,
    error,
    isEnabled,
    LOG_LEVELS
};
