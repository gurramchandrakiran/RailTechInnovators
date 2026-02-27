/**
 * Centralized collection and database name configuration.
 * All collection/database names are read from environment variables with sensible defaults.
 * Import this module instead of hardcoding collection names.
 * 
 * NOTE: Train-specific collection names (passengers, stations) are NOT stored here.
 * They come from the Trains_Details collection per train. This module only has
 * application-level (global) collections used across all trains.
 * 
 * Usage:
 *   const { COLLECTIONS, DBS } = require('./config/collections');
 *   const col = racDb.collection(COLLECTIONS.TTE_USERS);
 */

// Database names
const DBS = {
    STATIONS: process.env.STATIONS_DB || 'rac',
    PASSENGERS: process.env.PASSENGERS_DB || 'PassengersDB',
    TRAIN_DETAILS: process.env.TRAIN_DETAILS_DB || 'rac',
};

// Collection names (application-level, shared across all trains)
const COLLECTIONS = {
    // Auth & Users
    TTE_USERS: process.env.TTE_USERS_COLLECTION || 'tte_users',
    PASSENGER_ACCOUNTS: process.env.PASSENGER_ACCOUNTS_COLLECTION || 'passenger_accounts',
    REFRESH_TOKENS: process.env.REFRESH_TOKENS_COLLECTION || 'refresh_tokens',

    // Train management
    TRAINS_DETAILS: process.env.TRAIN_DETAILS_COLLECTION || 'Trains_Details',

    // Notifications & subscriptions
    PUSH_SUBSCRIPTIONS: process.env.PUSH_SUBSCRIPTIONS_COLLECTION || 'push_subscriptions',
    IN_APP_NOTIFICATIONS: process.env.IN_APP_NOTIFICATIONS_COLLECTION || 'in_app_notifications',
    UPGRADE_NOTIFICATIONS: process.env.UPGRADE_NOTIFICATIONS_COLLECTION || 'upgrade_notifications',

    // Reallocation
    STATION_REALLOCATIONS: process.env.STATION_REALLOCATIONS_COLLECTION || 'station_reallocations',

    // OTP
    OTP_STORE: process.env.OTP_STORE_COLLECTION || 'otp_store',
    UPGRADE_DENIAL_LOG: process.env.UPGRADE_DENIAL_LOG_COLLECTION || 'upgrade_denial_log',
};

// Other defaults
const DEFAULTS = {
    TTE_DEFAULT_PASSWORD: process.env.TTE_DEFAULT_PASSWORD || 'Prasanth@123',
};

module.exports = { DBS, COLLECTIONS, DEFAULTS };
