/**
 * NoShowService.js
 * Handles marking passengers as no-show and berth deallocation
 * Extracted from ReallocationService.js
 */

const db = require("../../config/db");
const wsManager = require("../../config/websocket");
const CONSTANTS = require("../../constants/reallocationConstants");

class NoShowService {
  /**
   * Mark passenger as no-show
   * @param {TrainState} trainState - Current train state
   * @param {string} pnr - Passenger PNR number
   * @returns {Object} - Result with success status and passenger details
   */
  async markNoShow(trainState, pnr) {
    try {
      // Find passenger in train state
      const result = trainState.findPassenger(pnr);
      if (!result) {
        throw new Error(`${CONSTANTS.ERROR_MESSAGES.PASSENGER_NOT_FOUND}`);
      }

      const { passenger, berth, coachNo } = result;

      // Validation checks
      if (passenger.boarded) {
        throw new Error(`${CONSTANTS.ERROR_MESSAGES.ALREADY_BOARDED}`);
      }

      if (passenger.noShow) {
        throw new Error(`${CONSTANTS.ERROR_MESSAGES.ALREADY_MARKED}`);
      }

      // Mark as no-show in memory
      passenger.noShow = true;

      // Clear segment occupancy
      await this._deallocateBerth(berth, passenger);

      // Update berth status
      berth.updateStatus();

      // Update MongoDB
      await this._updateDatabase(pnr);

      // Log event
      trainState.logEvent("NO_SHOW", `Passenger marked as no-show`, {
        pnr: pnr,
        name: passenger.name,
        from: passenger.from,
        to: passenger.to,
        coach: coachNo,
        berth: berth.fullBerthNo,
      });

      console.log(`❌ Marked ${passenger.name} (PNR: ${pnr}) as NO-SHOW`);

      return {
        success: true,
        passenger: {
          pnr: passenger.pnr,
          name: passenger.name,
          from: passenger.from,
          to: passenger.to,
          coach: coachNo,
          berth: berth.fullBerthNo,
        },
      };
    } catch (error) {
      console.error(`❌ Error marking no-show:`, error.message);
      throw error;
    }
  }

  /**
   * Deallocate berth by clearing segment occupancy
   * @private
   */
  async _deallocateBerth(berth, passenger) {
    for (let i = passenger.fromIdx; i < passenger.toIdx; i++) {
      if (berth.segmentOccupancy[i] === passenger.pnr) {
        berth.segmentOccupancy[i] = null;
      }
    }
  }

  /**
   * Update database with no-show status
   * @private
   */
  async _updateDatabase(pnr) {
    try {
      const passengersCollection = db.getPassengersCollection();
      await passengersCollection.updateOne(
        { PNR_Number: pnr },
        { $set: { NO_show: true } }
      );
      console.log(`✅ Updated NO_show in MongoDB for PNR: ${pnr}`);
    } catch (dbError) {
      console.error(`⚠️  Failed to update MongoDB:`, dbError.message);
      throw dbError;
    }
  }

  /**
   * Update statistics when passenger marked as no-show
   * @private
   */
  _updateStats(trainState, passenger) {
    if (trainState.stats) {
      trainState.stats.totalNoShow = (trainState.stats.totalNoShow || 0) + 1;
      if (passenger.pnrStatus === 'RAC') {
        trainState.stats.racNoShow = (trainState.stats.racNoShow || 0) + 1;
      }
    }
  }
}

module.exports = new NoShowService();
