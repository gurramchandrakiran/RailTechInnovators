/**
 * EligibilityService.js
 * Handles two-stage eligibility checking for RAC upgrade
 * Stage 1: Hard constraints (Rules 0, 1, 2, 3, 4, 10, 11)
 * Stage 2: Refinement filters (Rules 5, 6, 7, 8, 9)
 */

const CONSTANTS = require("../../constants/reallocationConstants");

// Look-ahead window for Rule 5 co-passenger check
const LOOK_AHEAD_SEGMENTS = 2;

class EligibilityService {
  /**
   * Check Stage 1 eligibility - Hard constraints
   * Must pass ALL rules: 0, 1, 2, 3, 4, 10, 11
   * @returns {Object} - {eligible: boolean, reason: string, stage: 1}
   */
  checkStage1Eligibility(racPassenger, vacantSegment, currentStationIdx, trainState) {
    try {
      console.log(`\n🔍 Stage 1 Check: ${racPassenger.name} (${racPassenger.pnr})`);

      // Rule 0: Must be RAC status
      if (racPassenger.pnrStatus !== 'RAC') {
        return { eligible: false, reason: 'Not RAC status', failedRule: 'Rule 0' };
      }

      // Rule 1: (Removed) - passengerStatus is not reliably set
      // Online/Offline distinction is handled at notification/approval level instead

      // Rule 2: Must be boarded
      if (!racPassenger.boarded) {
        return { eligible: false, reason: 'Not boarded', failedRule: 'Rule 2' };
      }

      // Rule 3: Full journey coverage
      const remainingFromIdx = Math.max(racPassenger.fromIdx, currentStationIdx);
      if (vacantSegment.fromIdx > remainingFromIdx || vacantSegment.toIdx < racPassenger.toIdx) {
        return { eligible: false, reason: 'Insufficient journey coverage', failedRule: 'Rule 3' };
      }

      // Rule 4: Class match
      if (racPassenger.class !== vacantSegment.class) {
        return { eligible: false, reason: 'Class mismatch', failedRule: 'Rule 4' };
      }

      // Rule 10: Sufficient time remaining
      const segmentsRemaining = vacantSegment.toIdx - currentStationIdx;
      if (segmentsRemaining < 1) {
        return { eligible: false, reason: 'Insufficient time remaining', failedRule: 'Rule 10' };
      }

      // Rule 11: Minimum 70km journey
      const distance = this.calculateJourneyDistance(
        racPassenger.from,
        racPassenger.to,
        trainState
      );
      if (distance < CONSTANTS.ELIGIBILITY_RULES.MIN_JOURNEY_DISTANCE) {
        return { eligible: false, reason: `Journey too short (${distance}km < 70km)`, failedRule: 'Rule 11' };
      }

      console.log(`   ✅ Stage 1 PASSED for ${racPassenger.name}`);
      return { eligible: true, reason: 'Stage 1 passed', stage: 1 };
    } catch (error) {
      console.error('❌ Stage 1 Error:', error.message);
      return { eligible: false, reason: `Error: ${error.message}`, failedRule: 'Error' };
    }
  }

  /**
   * Check Stage 2 eligibility - Refinement filters
   * Must pass Rules: 5, 6, 7, 8 (Rule 9 is for sorting)
   * @returns {Object} - {eligible: boolean, reason: string, stage: 2, failedRule?: string}
   */
  checkStage2Eligibility(racPassenger, vacantSegment, currentStationIdx, trainState, vacancyId = null) {
    try {
      console.log(`\n🔍 Stage 2 Check: ${racPassenger.name} (${racPassenger.pnr})`);

      // Rule 5: Solo RAC constraint (WITH EXCEPTION)
      const soloCheck = this.checkSoloRACConstraint(racPassenger, trainState, currentStationIdx);
      if (!soloCheck.eligible) {
        console.log(`   ❌ Rule 5 FAILED: ${soloCheck.reason}`);
        return {
          eligible: false,
          reason: soloCheck.reason,
          failedRule: 'Rule 5: Solo RAC'
        };
      }
      console.log(`   ✅ Rule 5 PASSED: ${soloCheck.reason}`);

      // Rule 6: No conflicting CNF passenger
      if (this.checkConflictingCNFPassenger(vacantSegment, currentStationIdx, trainState)) {
        return {
          eligible: false,
          reason: 'Conflicting CNF passenger',
          failedRule: 'Rule 6: Conflicting CNF'
        };
      }

      // Rule 7: Not already offered this vacancy
      if (racPassenger.vacancyIdLastOffered === vacancyId) {
        return {
          eligible: false,
          reason: 'Already offered this vacancy',
          failedRule: 'Rule 7: Already Offered'
        };
      }

      // Rule 8: Not already accepted another offer
      if (racPassenger.offerStatus === 'accepted') {
        return {
          eligible: false,
          reason: 'Already accepted another offer',
          failedRule: 'Rule 8: Already Accepted'
        };
      }

      console.log(`   ✅✅✅ Stage 2 PASSED! ${racPassenger.name} is FULLY ELIGIBLE!`);
      return { eligible: true, reason: 'All criteria met', stage: 2 };
    } catch (error) {
      console.error('❌ Stage 2 Error:', error.message);
      return { eligible: false, reason: `Error: ${error.message}`, failedRule: 'Error' };
    }
  }

  /**
   * Rule 5: Check Solo RAC Constraint with 2-segment exception
   * LOGIC:
   * - IF passenger is ALONE on berth:
   *     - IF co-passenger will board within next 2 segments: ELIGIBLE (exception)
   *     - ELSE: NOT ELIGIBLE (already has full berth)
   * - ELSE (sharing): ELIGIBLE
   */
  checkSoloRACConstraint(racPassenger, trainState, currentStationIdx) {
    // Check if currently sharing
    if (racPassenger.coPassenger) {
      return { eligible: true, reason: 'Currently sharing berth' };
    }

    // Find co-passenger
    const coPassenger = this.findCoPassenger(racPassenger, trainState);

    if (!coPassenger) {
      // Solo passenger with no co-passenger at all
      return {
        eligible: false,
        reason: 'Solo RAC with no co-passenger scheduled'
      };
    }

    // Check if co-passenger boards within next N segments
    const boardingGap = coPassenger.fromIdx - currentStationIdx;

    if (boardingGap > 0 && boardingGap <= LOOK_AHEAD_SEGMENTS) {
      return {
        eligible: true,
        reason: `Co-passenger boards in ${boardingGap} segment(s) (exception)`
      };
    }

    // Co-passenger boards too far in future or already boarded
    if (boardingGap > LOOK_AHEAD_SEGMENTS) {
      return {
        eligible: false,
        reason: `Solo RAC, co-passenger boards in ${boardingGap} segments (>${LOOK_AHEAD_SEGMENTS})`
      };
    }

    // Co-passenger already on train (boardingGap <= 0)
    return { eligible: true, reason: 'Sharing or will share soon' };
  }

  /**
   * Find co-passenger (same berth, different person)
   */
  findCoPassenger(racPassenger, trainState) {
    try {
      const coach = trainState.findCoach(racPassenger.coach);
      if (!coach) return null;

      const berth = coach.berths.find(b => b.berthNo === racPassenger.seat);
      if (!berth) return null;

      // Find other passenger in same berth
      return trainState.getAllPassengers().find(p =>
        p.pnr !== racPassenger.pnr &&
        p.coach === racPassenger.coach &&
        p.seat === racPassenger.seat &&
        p.fromIdx < racPassenger.toIdx &&
        p.toIdx > racPassenger.fromIdx
      );
    } catch (error) {
      console.error('Error finding co-passenger:', error.message);
      return null;
    }
  }

  /**
   * Check for conflicting CNF passenger (Rule 6)
   */
  checkConflictingCNFPassenger(vacantSegment, currentStationIdx, trainState) {
    try {
      const berth = trainState.findBerth(vacantSegment.coach, vacantSegment.berthNo);
      if (!berth) return false;

      // Check segment occupancy for any CNF passenger
      for (let i = vacantSegment.fromIdx; i < vacantSegment.toIdx; i++) {
        const pnr = berth.segmentOccupancy[i];
        if (pnr) {
          const passenger = trainState.findPassengerByPNR(pnr);
          if (passenger && passenger.pnrStatus === 'CNF') {
            return true; // Conflict found
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking conflicts:', error.message);
      return false;
    }
  }

  /**
   * Calculate journey distance from station codes
   */
  calculateJourneyDistance(fromStationCode, toStationCode, trainState) {
    try {
      const fromStation = trainState.stations?.find(s => s.stationCode === fromStationCode);
      const toStation = trainState.stations?.find(s => s.stationCode === toStationCode);

      if (!fromStation || !toStation) {
        return 999; // Assume valid if stations not found
      }

      const distance = toStation.distance - fromStation.distance;
      return Math.abs(distance);
    } catch (error) {
      console.error('Error calculating distance:', error.message);
      return 999; // Assume valid on error
    }
  }

  /**
   * Get Stage 1 eligible RAC passengers for a vacant segment
   * Returns passengers who pass basic constraints
   */
  getStage1EligibleRAC(vacantSegment, currentStationIdx, trainState) {
    try {
      const racQueue = trainState.getBoardedRACPassengers();
      const eligible = [];

      racQueue.forEach(rac => {
        const result = this.checkStage1Eligibility(
          rac,
          vacantSegment,
          currentStationIdx,
          trainState
        );

        if (result.eligible) {
          eligible.push({
            ...rac,
            stage1Passed: true,
          });
        }
      });

      // Sort by RAC priority (RAC 1 > RAC 2 > RAC 3) - Rule 9
      eligible.sort((a, b) => {
        const getRACNum = (status) => {
          const match = status?.match(/RAC\s*(\d+)/i);
          return match ? parseInt(match[1]) : 999;
        };
        return getRACNum(a.racStatus) - getRACNum(b.racStatus);
      });

      return eligible;
    } catch (error) {
      console.error('Error getting Stage 1 eligible:', error.message);
      return [];
    }
  }

  /**
   * Get Stage 2 results (three lists: online eligible, offline eligible, not eligible)
   */
  getStage2Results(stage1Eligible, vacantSegment, currentStationIdx, trainState, vacancyId = null) {
    const onlineEligible = [];
    const offlineEligible = [];
    const notEligible = [];

    stage1Eligible.forEach(rac => {
      const result = this.checkStage2Eligibility(
        rac,
        vacantSegment,
        currentStationIdx,
        trainState,
        vacancyId
      );

      if (result.eligible) {
        // Separate by online/offline status
        if (rac.passengerStatus?.toLowerCase() === 'online') {
          onlineEligible.push({
            ...rac,
            stage2Passed: true,
          });
        } else {
          offlineEligible.push({
            ...rac,
            stage2Passed: true,
          });
        }
      } else {
        // Failed Stage 2
        notEligible.push({
          ...rac,
          stage2Passed: false,
          failedRule: result.failedRule,
          failureReason: result.reason,
        });
      }
    });

    return {
      onlineEligible,
      offlineEligible,
      notEligible,
    };
  }
}

module.exports = new EligibilityService();
