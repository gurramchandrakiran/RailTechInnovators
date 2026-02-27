// backend/services/ValidationService.js

class ValidationService {
  /**
   * Validate journey segment
   */
  validateJourneySegment(trainState, coachNo, seatNo, fromIdx, toIdx) {
    try {
      const berth = trainState.findBerth(coachNo, seatNo);

      if (!berth) {
        return {
          valid: false,
          reason: 'Berth not found'
        };
      }

      const isAvailable = berth.isAvailableForSegment(fromIdx, toIdx);

      if (!isAvailable) {
        return {
          valid: false,
          reason: 'Journey segment overlaps with existing passenger'
        };
      }

      return {
        valid: true,
        reason: 'Berth available for journey segment'
      };

    } catch (error) {
      return {
        valid: false,
        reason: error.message
      };
    }
  }

  /**
   * Validate RAC eligibility for vacant berth
   */
  validateRACEligibility(trainState, racPassenger, vacantBerth) {
    if (racPassenger.class !== vacantBerth.class) {
      return {
        eligible: false,
        reason: `Class mismatch: RAC is ${racPassenger.class}, berth is ${vacantBerth.class}`
      };
    }

    const berth = trainState.findBerth(vacantBerth.coachNo, vacantBerth.berthNo);
    
    if (!berth) {
      return {
        eligible: false,
        reason: 'Berth not found'
      };
    }

    const isAvailable = berth.isAvailableForSegment(
      racPassenger.fromIdx,
      racPassenger.toIdx
    );

    if (!isAvailable) {
      return {
        eligible: false,
        reason: 'Journey segment not available'
      };
    }

    return {
      eligible: true,
      reason: 'RAC passenger eligible for this berth'
    };
  }

  /**
   * Validate PNR format
   */
  validatePNR(pnr) {
    if (!pnr) {
      return { valid: false, reason: 'PNR is required' };
    }

    const pnrStr = String(pnr).trim();

    if (pnrStr.length < 10 || pnrStr.length > 12) {
      return { valid: false, reason: 'PNR must be 10-12 characters' };
    }

    if (!/^\d+$/.test(pnrStr)) {
      return { valid: false, reason: 'PNR must contain only digits' };
    }

    return { valid: true };
  }

  /**
   * Validate station index
   */
  validateStationIndex(trainState, stationIdx) {
    if (typeof stationIdx !== 'number') {
      return {
        valid: false,
        reason: 'Station index must be a number'
      };
    }

    if (stationIdx < 0 || stationIdx >= trainState.stations.length) {
      return {
        valid: false,
        reason: `Invalid station index: ${stationIdx}. Must be between 0 and ${trainState.stations.length - 1}`
      };
    }

    return { valid: true };
  }

  /**
   * Validate journey (from < to)
   */
  validateJourney(fromIdx, toIdx, totalStations) {
    if (typeof fromIdx !== 'number' || typeof toIdx !== 'number') {
      return {
        valid: false,
        reason: 'Station indices must be numbers'
      };
    }

    if (fromIdx < 0 || toIdx < 0) {
      return {
        valid: false,
        reason: 'Station indices cannot be negative'
      };
    }

    if (fromIdx >= totalStations || toIdx >= totalStations) {
      return {
        valid: false,
        reason: `Station indices must be less than ${totalStations}`
      };
    }

    if (fromIdx >= toIdx) {
      return {
        valid: false,
        reason: 'Destination station must be after boarding station'
      };
    }

    return { valid: true };
  }

  /**
   * Validate train initialized
   */
  validateTrainInitialized(trainState) {
    if (!trainState) {
      return {
        valid: false,
        reason: 'Train is not initialized. Please initialize the train first.'
      };
    }

    if (!trainState.stations || trainState.stations.length === 0) {
      return {
        valid: false,
        reason: 'Train stations are not loaded'
      };
    }

    if (!trainState.coaches || trainState.coaches.length === 0) {
      return {
        valid: false,
        reason: 'Train coaches are not initialized'
      };
    }

    return { valid: true };
  }

  /**
   * Validate journey started
   */
  validateJourneyStarted(trainState) {
    if (!trainState.journeyStarted) {
      return {
        valid: false,
        reason: 'Journey has not started yet. Please start the journey first.'
      };
    }
    return { valid: true };
  }

  /**
   * Validate journey not complete
   */
  validateJourneyNotComplete(trainState) {
    if (trainState.isJourneyComplete()) {
      return {
        valid: false,
        reason: 'Journey is already complete. Cannot proceed further.'
      };
    }
    return { valid: true };
  }
}

module.exports = new ValidationService();