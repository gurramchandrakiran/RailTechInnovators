/**
 * =============================================================================
 * MongoDB Field Name Constants — SINGLE SOURCE OF TRUTH
 * =============================================================================
 *
 * WHY THIS FILE EXISTS:
 * The MongoDB Trains_Details collection uses field names like "Train_No" and
 * "Station_Collection_Name", but developers often accidentally write
 * "Train_Number" or "Stations_Collection_Name" — causing silent 404s and
 * "not found" bugs that are hard to debug.
 *
 * RULE: Never hardcode MongoDB field names. Always import from here.
 *
 * USAGE:
 *   const { TRAIN_FIELDS, PASSENGER_FIELDS, findTrainByNo } = require('../config/fields');
 *   // Then use TRAIN_FIELDS.TRAIN_NO instead of hardcoding 'Train_No'
 *
 * =============================================================================
 */

// ─── Trains_Details Collection Fields ────────────────────────────────────────
// Database: rac | Collection: Trains_Details
// These are the EXACT field names in the MongoDB Trains_Details collection.
const TRAIN_FIELDS = {
    // ⚠️ This is "Train_No" — NOT "Train_Number"
    TRAIN_NO: 'Train_No',
    TRAIN_NAME: 'Train_Name',
    // ⚠️ Some DB documents have a trailing space in this key: "Station_Collection_Name "
    STATION_COLLECTION_NAME: 'Station_Collection_Name',
    PASSENGERS_COLLECTION_NAME: 'Passengers_Collection_Name',
    SLEEPER_COACHES_COUNT: 'Sleeper_Coaches_Count',
    THREE_TIER_AC_COACHES_COUNT: 'Three_TierAC_Coaches_Count',
    STATUS: 'status',
    CURRENT_STATION: 'currentStation',
    CURRENT_STATION_IDX: 'currentStationIdx',
    TOTAL_STATIONS: 'totalStations',
    JOURNEY_DATE: 'journeyDate',
    STATIONS_DB: 'stationsDb',
    PASSENGERS_DB: 'passengersDb',
};

// ─── Passenger Collection Fields ─────────────────────────────────────────────
// Database: PassengersDB | Collection: per-train (e.g. 17225_passengers)
// ⚠️ Passengers use "Train_Number" — this is DIFFERENT from Trains_Details "Train_No"!
const PASSENGER_FIELDS = {
    PNR_NUMBER: 'PNR_Number',
    TRAIN_NUMBER: 'Train_Number',   // ✅ Passengers use Train_Number (NOT Train_No)
    TRAIN_NAME: 'Train_Name',
    JOURNEY_DATE: 'Journey_Date',   // Format: DD-MM-YYYY
    NAME: 'Name',
    AGE: 'Age',
    GENDER: 'Gender',
    BOARDING_STATION: 'Boarding_Station',
    DEBOARDING_STATION: 'Deboarding_Station',
    ASSIGNED_COACH: 'Assigned_Coach',
    ASSIGNED_BERTH: 'Assigned_berth',  // lowercase 'b' !
    BERTH_TYPE: 'Berth_Type',
    PNR_STATUS: 'PNR_Status',
    CURRENT_STATUS: 'Current_Status',
    BOOKING_STATUS: 'Booking_Status',
    BOARDING_STATUS: 'Boarding_Status',
    CLASS: 'Class',
    EMAIL: 'Email',
    IRCTC_ID: 'IRCTC_ID',
    PHONE: 'Phone',
};

// ─── Station Collection Fields ───────────────────────────────────────────────
// Database: rac | Collection: per-train (e.g. stations_17225)
const STATION_FIELDS = {
    STATION_CODE: 'Station_Code',
    STATION_NAME: 'Station_Name',
    ARRIVAL_TIME: 'Arrival_Time',
    DEPARTURE_TIME: 'Departure_Time',
    DISTANCE: 'Distance',
    DAY: 'Day',
    SERIAL_NO: 'Serial_No',
};

// ─── TTE User Fields ─────────────────────────────────────────────────────────
// Collection: tte_users
const TTE_FIELDS = {
    EMPLOYEE_ID: 'employeeId',
    NAME: 'name',
    PASSWORD: 'password',
    ROLE: 'role',
    TRAIN_ASSIGNED: 'trainAssigned',
    EMAIL: 'email',
    PHONE: 'phone',
};


// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Build a MongoDB filter to find a train by its number in Trains_Details.
 * Handles both string and number types.
 *
 * @param {string|number} trainNo
 * @returns {Object} MongoDB filter — use with findOne() or find()
 *
 * @example
 *   const filter = findTrainByNo('17225');
 *   const train = await col.findOne(filter);
 */
function findTrainByNo(trainNo) {
    return {
        [TRAIN_FIELDS.TRAIN_NO]: { $in: [String(trainNo), Number(trainNo)] }
    };
}

/**
 * Safely get the Station_Collection_Name from a Trains_Details document.
 * Handles the trailing space issue in the MongoDB key name.
 *
 * @param {Object} trainDoc - Document from Trains_Details collection
 * @returns {string|null} The station collection name, or null if not found
 *
 * @example
 *   const train = await col.findOne(findTrainByNo('17225'));
 *   const stationsCol = getStationCollectionName(train);
 */
function getStationCollectionName(trainDoc) {
    if (!trainDoc) return null;
    const key = Object.keys(trainDoc).find(k =>
        k.trim() === TRAIN_FIELDS.STATION_COLLECTION_NAME
    );
    return key ? (trainDoc[key] || '').trim() : null;
}

/**
 * Extract a normalized plain object from a Trains_Details document,
 * mapping MongoDB field names → clean camelCase keys for API responses.
 *
 * @param {Object} doc - Raw MongoDB document from Trains_Details
 * @returns {Object} Clean train config object
 *
 * @example
 *   const train = await col.findOne(findTrainByNo('17225'));
 *   res.json({ success: true, data: toTrainConfig(train) });
 */
function toTrainConfig(doc) {
    if (!doc) return null;
    const sleeper = doc[TRAIN_FIELDS.SLEEPER_COACHES_COUNT] || 0;
    const threeAc = doc[TRAIN_FIELDS.THREE_TIER_AC_COACHES_COUNT] || 0;
    return {
        trainNo: String(doc[TRAIN_FIELDS.TRAIN_NO]),
        trainName: doc[TRAIN_FIELDS.TRAIN_NAME] || '',
        stationsCollection: getStationCollectionName(doc) || '',
        passengersCollection: doc[TRAIN_FIELDS.PASSENGERS_COLLECTION_NAME] || '',
        stationsDb: doc[TRAIN_FIELDS.STATIONS_DB] || 'rac',
        passengersDb: doc[TRAIN_FIELDS.PASSENGERS_DB] || 'rac',
        journeyDate: doc[TRAIN_FIELDS.JOURNEY_DATE] || '',
        totalCoaches: sleeper + threeAc,
        sleeperCoachesCount: sleeper,
        threeTierACCoachesCount: threeAc,
        status: doc[TRAIN_FIELDS.STATUS] || 'NOT_INIT',
        currentStation: doc[TRAIN_FIELDS.CURRENT_STATION] || null,
        currentStationIdx: doc[TRAIN_FIELDS.CURRENT_STATION_IDX] || null,
        totalStations: doc[TRAIN_FIELDS.TOTAL_STATIONS] || null,
    };
}


module.exports = {
    TRAIN_FIELDS,
    PASSENGER_FIELDS,
    STATION_FIELDS,
    TTE_FIELDS,
    findTrainByNo,
    getStationCollectionName,
    toTrainConfig,
};
