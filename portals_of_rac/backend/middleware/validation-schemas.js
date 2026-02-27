/**
 * validation-schemas.js
 * Joi validation schemas for all API inputs
 * Ensures type safety and data integrity
 */

const Joi = require('joi');

const schemas = {
  // ============= TRAIN CONFIGURATION =============

  trainInitialize: Joi.object({
    trainNo: Joi.string().required().messages({
      'string.empty': 'Train number is required'
    }),
    trainName: Joi.string().required(),
    route: Joi.string().required(),
    totalCoaches: Joi.number().integer().positive().required(),
    startDate: Joi.date().iso().required(),
    berthsPerCoach: Joi.number().integer().positive().default(72),
    stationsDbName: Joi.string().optional(),
    stationsCollection: Joi.string().optional(),
    passengersDbName: Joi.string().optional(),
    passengersCollection: Joi.string().optional()
  }),

  trainNextStation: Joi.object({
    trainNo: Joi.string().required(),
    stationCode: Joi.string().required(),
    arrivalTime: Joi.date().iso().optional(),
    departureTime: Joi.date().iso().optional()
  }),

  // ============= PASSENGER OPERATIONS =============

  markNoShow: Joi.object({
    pnr: Joi.string().required().messages({
      'string.empty': 'PNR is required'
    }),
    trainNo: Joi.string().optional(),
    reason: Joi.string().optional()
  }),

  searchPassenger: Joi.object({
    pnr: Joi.string().required(),
    includeHistory: Joi.boolean().default(false)
  }),

  addPassenger: Joi.object({
    pnr: Joi.string().required(),
    name: Joi.string().required(),
    age: Joi.number().integer().min(1).max(120).required(),
    gender: Joi.string().valid('M', 'F', 'O').required(),
    email: Joi.string().email().optional(),
    mobile: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    from: Joi.string().required(),
    to: Joi.string().required(),
    class: Joi.string().valid('AC 1', 'AC 2', 'AC 3', 'SL', 'GN').required(),
    pnrStatus: Joi.string().valid('CNF', 'RAC', 'WL').required(),
    racNumber: Joi.number().integer().positive().optional(),
    coachNo: Joi.string().optional(),
    berthNo: Joi.string().optional()
  }),

  // ============= REALLOCATION OPERATIONS =============

  applyReallocation: Joi.object({
    trainNo: Joi.string().required(),
    allocations: Joi.array().items(
      Joi.object({
        pnr: Joi.string().required(),
        coach: Joi.string().required(),
        berth: Joi.string().required(),
        reason: Joi.string().optional()
      })
    ).min(1).required(),
    reason: Joi.string().optional()
  }),

  getEligibilityMatrix: Joi.object({
    trainNo: Joi.string().required(),
    coachNo: Joi.string().optional(),
    detailed: Joi.boolean().default(false)
  }),

  // ============= AUTHENTICATION =============

  staffLogin: Joi.object({
    username: Joi.string().required().messages({
      'string.empty': 'Username is required'
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required'
    }),
    staffType: Joi.string().valid('TTE', 'ADMIN', 'STAFF').optional()
  }),

  // ============= QUERY PARAMETERS =============

  pagination: Joi.object({
    page: Joi.number().integer().positive().default(1),
    limit: Joi.number().integer().positive().max(100).default(20),
    sort: Joi.string().optional(),
    filter: Joi.string().optional()
  }),

  filterPassengers: Joi.object({
    status: Joi.string().valid('RAC', 'CNF', 'WL', 'CAN', 'NO_SHOW').optional(),
    class: Joi.string().valid('AC 1', 'AC 2', 'AC 3', 'SL', 'GN').optional(),
    boarded: Joi.boolean().optional(),
    onlineStatus: Joi.string().valid('Online', 'Offline').optional()
  }),

  // ============= STATION OPERATIONS =============

  stationArrival: Joi.object({
    trainNo: Joi.string().required(),
    stationCode: Joi.string().required(),
    actualArrivalTime: Joi.date().iso().optional()
  }),

  // ============= NOTIFICATION =============

  sendNotification: Joi.object({
    pnr: Joi.string().required(),
    type: Joi.string().valid('EMAIL', 'WEBSOCKET', 'IN_APP').required(),
    message: Joi.string().required(),
    subject: Joi.string().optional(),
    metadata: Joi.object().optional()
  })
};

module.exports = schemas;
