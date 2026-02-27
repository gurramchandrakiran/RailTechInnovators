/**
 * Reallocation Service Constants
 * Extracted from ReallocationService.js for centralized configuration
 */

const REALLOCATION_CONSTANTS = {
  // Eligibility Rules
  ELIGIBILITY_RULES: {
    MIN_JOURNEY_DISTANCE: 70,      // km - Rule 11
    MAX_RAC_PRIORITY: 'RAC 3',      // Maximum RAC number
    FULL_JOURNEY_COVERAGE: true,    // Rule 3 - Must cover full journey
    CLASS_MATCHING: true,            // Rule 4 - Must match class
    SOLO_RAC_CONSTRAINT: true,       // Rule 5 - Must be sharing
    NO_CNF_CONFLICT: true,           // Rule 6 - No CNF passenger
  },

  // Offer Management
  UPGRADE_OFFER: {
    EXPIRY_TTL: 900000,             // 15 minutes in ms
    OFFER_TIMEOUT_CHECK: 60000,     // Check expiry every 1 minute
    MAX_OFFERS_PER_PASSENGER: 1,    // One active offer at a time
  },

  // Berth Configuration
  BERTH_TYPES: {
    SL: 'SL',                        // Side Lower
    AC_3_TIER: '3A',
    AC_2_TIER: '2A',
    AC_1_TIER: '1A',
    FIRST_CLASS: 'FC',
  },

  // Passenger Status
  PASSENGER_STATUS: {
    RAC: 'RAC',
    CNF: 'CNF',
    WL: 'WL',
    NO_SHOW: 'NO_SHOW',
    BOARDED: 'BOARDED',
    DEBOARDED: 'DEBOARDED',
  },

  // Passenger Online Status
  ONLINE_STATUS: {
    ONLINE: 'online',
    OFFLINE: 'offline',
  },

  // Sharing Status
  SHARING_STATUS: {
    SOLO: 'solo',                    // Alone on berth
    SHARING: 'sharing',              // Sharing berth
    WILL_SHARE: 'will_share',        // Co-passenger will board later
  },

  // Vacancy Types
  VACANCY_TYPE: {
    NO_SHOW: 'no_show',
    CANCELLATION: 'cancellation',
    DEBOARDED: 'deboarded',
    TRANSITION: 'transition',        // Freed during station transition
  },

  // Error Messages
  ERROR_MESSAGES: {
    NO_ELIGIBLE_CANDIDATES: 'No eligible RAC passengers found',
    PASSENGER_NOT_FOUND: 'Passenger not found',
    BERTH_NOT_AVAILABLE: 'Berth not available',
    INVALID_UPGRADE: 'Cannot upgrade: constraints not met',
    ALREADY_BOARDED: 'Passenger has already boarded',
    ALREADY_MARKED: 'Passenger already marked as no-show',
    SHARING_REQUIRED: 'Passenger must be sharing berth',
    JOURNEY_TOO_SHORT: 'Journey distance less than 70km',
    CLASS_MISMATCH: 'Berth class does not match passenger class',
    CONFLICTING_CNF: 'Conflicting confirmed passenger',
  },

  // Logging
  LOG_LEVELS: {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG',
  },

  // Database
  DB_CONFIG: {
    BATCH_SIZE: 100,                // Batch updates
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,              // ms
  },
};

module.exports = REALLOCATION_CONSTANTS;
