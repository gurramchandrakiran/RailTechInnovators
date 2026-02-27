// backend/utils/constants.js

module.exports = {
  // Train Configuration (Dynamic - from global.RAC_CONFIG)
  getTRAIN_NO: () => global.RAC_CONFIG?.trainNo || null,
  getTRAIN_NAME: () => global.RAC_CONFIG?.trainName || null,
  TOTAL_COACHES: 9,
  BERTHS_PER_COACH: 72, // Default for SL coaches
  BERTHS_PER_COACH_3A: 64, // For Three_Tier_AC (3A) coaches

  // Berth Types
  BERTH_TYPES: {
    LOWER: 'Lower Berth',
    MIDDLE: 'Middle Berth',
    UPPER: 'Upper Berth',
    SIDE_LOWER: 'Side Lower',
    SIDE_UPPER: 'Side Upper'
  },

  // Berth Status
  BERTH_STATUS: {
    VACANT: 'VACANT',
    OCCUPIED: 'OCCUPIED',
    SHARED: 'SHARED'
  },

  // PNR Status
  PNR_STATUS: {
    CONFIRMED: 'CNF',
    RAC: 'RAC',
    WAITING: 'WL'
  },

  // Class Types
  CLASS_TYPES: {
    SLEEPER: 'SL',
    AC_3_TIER: 'AC_3_Tier',
    AC_2_TIER: '2A',
    AC_1_TIER: '1A',
    CHAIR_CAR: 'CC',
    SECOND_SITTING: '2S'
  },

  // Event Types
  EVENT_TYPES: {
    JOURNEY_STARTED: 'JOURNEY_STARTED',
    STATION_ARRIVAL: 'STATION_ARRIVAL',
    PASSENGER_BOARDED: 'PASSENGER_BOARDED',
    PASSENGER_DEBOARDED: 'PASSENGER_DEBOARDED',
    NO_SHOW: 'NO_SHOW',
    RAC_UPGRADED: 'RAC_UPGRADED',
    TRAIN_RESET: 'TRAIN_RESET'
  },

  // WebSocket Message Types
  WS_MESSAGE_TYPES: {
    TRAIN_UPDATE: 'TRAIN_UPDATE',
    STATION_ARRIVAL: 'STATION_ARRIVAL',
    RAC_REALLOCATION: 'RAC_REALLOCATION',
    NO_SHOW: 'NO_SHOW',
    STATS_UPDATE: 'STATS_UPDATE',
    CONNECTION_SUCCESS: 'CONNECTION_SUCCESS',
    ERROR: 'ERROR'
  },

  // Validation Rules
  VALIDATION: {
    PNR_MIN_LENGTH: 10,
    PNR_MAX_LENGTH: 12,
    TRAIN_NO_LENGTH: 5,
    MAX_PASSENGERS_PER_BERTH: 2,
    MIN_AGE: 1,
    MAX_AGE: 120
  },

  // API Response Messages
  MESSAGES: {
    TRAIN_INITIALIZED: 'Train initialized successfully',
    JOURNEY_STARTED: 'Journey started successfully',
    TRAIN_RESET: 'Train reset to initial state',
    NO_SHOW_MARKED: 'Passenger marked as no-show',
    REALLOCATION_APPLIED: 'Reallocation applied successfully',
    TRAIN_NOT_INITIALIZED: 'Train is not initialized',
    JOURNEY_NOT_STARTED: 'Journey has not started',
    INVALID_PNR: 'Invalid PNR format',
    PASSENGER_NOT_FOUND: 'Passenger not found',
    BERTH_NOT_FOUND: 'Berth not found'
  },

  // Database Collections (Dynamic - from global.RAC_CONFIG)
  getCOLLECTIONS: () => ({
    STATIONS: global.RAC_CONFIG?.stationsCollection || null,
    PASSENGERS: global.RAC_CONFIG?.passengersCollection || null
  }),

  // Database Names (Dynamic - from global.RAC_CONFIG)
  getDATABASES: () => ({
    STATIONS: global.RAC_CONFIG?.stationsDb || null,
    PASSENGERS: global.RAC_CONFIG?.passengersDb || null
  }),

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
  }
};