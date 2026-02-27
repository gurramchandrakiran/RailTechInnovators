/**
 * reallocationConstants.js
 * Centralized configuration for reallocation service
 * Single source of truth for all magic numbers and configurations
 */

module.exports = {
  // ============= REALLOCATION MODE CONFIGURATION =============

  // Reallocation mode: AUTO or APPROVAL
  REALLOCATION_MODE: {
    AUTO: 'AUTO',         // Automatically allocate RAC passengers (current behavior)
    APPROVAL: 'APPROVAL'  // Require TTE approval before allocation (new feature)
  },

  // Current active mode (toggle here to switch modes)
  CURRENT_MODE: 'APPROVAL', // Change to 'AUTO' to restore automatic allocation

  // ============= ELIGIBILITY RULES CONFIGURATION =============

  // Rule 11: Minimum journey distance for RAC upgrade eligibility
  MIN_JOURNEY_DISTANCE: 70, // km - only passengers traveling 70km+ are eligible

  // ============= UPGRADE OFFER CONFIGURATION =============

  // Offer expiry time
  OFFER_EXPIRY_TTL: 900000, // 15 minutes in milliseconds
  OFFER_EXPIRY_SECONDS: 900, // Alternative: in seconds

  // Offer status constants
  OFFER_STATUS: {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    EXPIRED: 'EXPIRED',
    WITHDRAWN: 'WITHDRAWN'
  },

  // ============= PASSENGER STATUS CONSTANTS =============

  PNR_STATUS: {
    RAC: 'RAC',
    CNF: 'CNF',
    WL: 'WL',
    CAN: 'CAN'
  },

  PASSENGER_STATUS: {
    ONLINE: 'Online',
    OFFLINE: 'Offline',
    INACTIVE: 'Inactive'
  },

  // ============= BERTH CONFIGURATION =============

  BERTH_TYPES: {
    LOWER: 'Lower',
    MIDDLE: 'Middle',
    UPPER: 'Upper',
    SIDE_LOWER: 'Side Lower',
    SIDE_UPPER: 'Side Upper',
    COUPE: 'Coupe'
  },

  CLASS_TYPES: {
    AC_1: 'AC 1',
    AC_2: 'AC 2',
    AC_3: 'AC 3',
    SL: 'SL',
    GN: 'GN'
  },

  // ============= DATABASE CONFIGURATION =============

  // Batch processing
  BATCH_SIZE: 10, // Process passenger offers in batches
  BATCH_TIMEOUT_MS: 5000, // 5 seconds between batches

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,

  // ============= ERROR MESSAGES =============

  ERROR_MESSAGES: {
    PASSENGER_NOT_FOUND: 'Passenger not found in queue',
    BERTH_NOT_FOUND: 'Berth not found',
    INVALID_PNR_STATUS: 'Invalid PNR status for reallocation',
    NOT_RAC: 'Passenger is not RAC status',
    NOT_ONLINE: 'Passenger is offline',
    NOT_BOARDED: 'Passenger has not boarded',
    NO_SHOW: 'Passenger marked as no-show',
    VACANCY_INSUFFICIENT: 'Vacancy does not cover full journey',
    CLASS_MISMATCH: 'Class mismatch',
    SOLO_RAC_CONSTRAINT: 'Already has full Side Lower (No co-passenger)',
    CONFLICTING_CNF: 'Conflicting CNF passenger will board',
    ALREADY_OFFERED: 'Already offered this vacancy',
    ALREADY_ACCEPTED: 'Already accepted another offer',
    JOURNEY_TOO_SHORT: 'Journey too short',
    TIME_GAP_INSUFFICIENT: 'Insufficient time remaining'
  },

  // ============= SUCCESS MESSAGES =============

  SUCCESS_MESSAGES: {
    NO_SHOW_MARKED: 'Passenger marked as no-show',
    OFFER_CREATED: 'Upgrade offer created',
    OFFER_ACCEPTED: 'Upgrade offer accepted',
    UPGRADE_COMPLETED: 'RAC upgrade to CNF completed',
    REALLOCATION_APPLIED: 'Reallocation applied successfully'
  },

  // ============= WEBSOCKET EVENTS =============

  WEBSOCKET_EVENTS: {
    NO_SHOW: 'NO_SHOW',
    VACANCY_DETECTED: 'VACANCY_DETECTED',
    UPGRADE_OFFER_CREATED: 'UPGRADE_OFFER_CREATED',
    UPGRADE_OFFER_EXPIRED: 'UPGRADE_OFFER_EXPIRED',
    UPGRADE_ACCEPTED: 'UPGRADE_ACCEPTED',
    RAC_UPGRADED: 'RAC_UPGRADED',
    REALLOCATION_APPLIED: 'REALLOCATION_APPLIED'
  },

  // ============= ELIGIBILITY RULE IDs =============

  ELIGIBILITY_RULES: {
    RULE_0: 'Must have RAC status',
    RULE_1: 'Passenger must be online',
    RULE_2: 'Passenger must be boarded',
    RULE_3: 'Vacancy must cover full journey',
    RULE_4: 'Class must match',
    RULE_5: 'Must be sharing or will share berth',
    RULE_6: 'No conflicting CNF passenger',
    RULE_7: 'Not already offered this vacancy',
    RULE_8: 'Not already accepted another offer',
    RULE_9: 'RAC priority ranking',
    RULE_10: 'Time-gap constraint',
    RULE_11: 'Minimum journey distance (70km)'
  },

  // ============= NOTIFICATION CONFIGURATION =============

  NOTIFICATION: {
    CHANNELS: ['EMAIL', 'WEBSOCKET', 'IN_APP'],
    UPGRADE_TEMPLATE: 'UPGRADE_OFFER',
    EXPIRY_TEMPLATE: 'OFFER_EXPIRED',
    ACCEPTED_TEMPLATE: 'UPGRADE_ACCEPTED'
  },

  // ============= LOGGING CONFIGURATION =============

  LOG_LEVELS: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
  },

  // ============= TIME CONFIGURATION =============

  TIME: {
    ONE_HOUR_MS: 3600000,
    ONE_MINUTE_MS: 60000,
    ONE_SECOND_MS: 1000
  }
};
