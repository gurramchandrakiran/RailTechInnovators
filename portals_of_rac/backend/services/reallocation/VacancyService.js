/**
 * VacancyService.js
 * Handles vacant berth detection and segment range calculations
 * Extracted from ReallocationService.js
 */

const CONSTANTS = require("../../constants/reallocationConstants");

class VacancyService {
  /**
   * Get all vacant berths in train
   * @param {TrainState} trainState - Current train state
   * @returns {Array} - Array of vacant berth objects
   */
  getVacantBerths(trainState) {
    const vacancies = [];

    trainState.coaches.forEach(coach => {
      coach.berths.forEach(berth => {
        // Find vacant segment ranges for this berth
        const ranges = this._getVacantSegmentRanges(berth, trainState.stations);

        ranges.forEach(range => {
          vacancies.push({
            berth: berth.fullBerthNo,
            coach: coach.coachNo,
            berthNo: berth.berthNo,
            type: berth.type,
            class: coach.class,
            vacantFrom: range.fromStation,
            vacantTo: range.toStation,
            fromIdx: range.fromIdx,
            toIdx: range.toIdx,
            duration: range.toIdx - range.fromIdx,
          });
        });
      });
    });

    return vacancies;
  }

  /**
   * Find continuous vacant segment ranges in a berth
   * Groups consecutive vacant segments (empty arrays in segmentOccupancy)
   * FIXED: Now supports array-based occupancy for RAC sharing
   * @private
   */
  _getVacantSegmentRanges(berth, stations) {
    const ranges = [];
    let startIdx = null;

    for (let i = 0; i < berth.segmentOccupancy.length; i++) {
      // FIX: Check if segment is vacant (empty array or null)
      // After Berth.js changes, segmentOccupancy[i] is an array of PNRs
      // Vacant = array is empty (length === 0)
      const isVacant = Array.isArray(berth.segmentOccupancy[i])
        ? berth.segmentOccupancy[i].length === 0
        : berth.segmentOccupancy[i] === null; // Fallback for old data

      if (isVacant) {
        // Start of a vacant segment
        if (startIdx === null) {
          startIdx = i;
        }
      } else {
        // End of a vacant segment
        if (startIdx !== null) {
          ranges.push({
            fromIdx: startIdx,
            toIdx: i,
            fromStation: stations[startIdx]?.stationCode || 'UNKNOWN',
            toStation: stations[i]?.stationCode || 'UNKNOWN',
          });
          startIdx = null;
        }
      }
    }

    // Handle case where vacancy extends to end
    if (startIdx !== null) {
      ranges.push({
        fromIdx: startIdx,
        toIdx: berth.segmentOccupancy.length,
        fromStation: stations[startIdx]?.stationCode || 'UNKNOWN',
        toStation: stations[berth.segmentOccupancy.length]?.stationCode || 'UNKNOWN',
      });
    }

    return ranges;
  }

  /**
   * Merge adjacent vacancy segments for same berth
   * Optimizes allocation by combining small fragmented vacancies
   * @private
   */
  _mergeAdjacentVacancies(ranges) {
    if (ranges.length <= 1) return ranges;

    const merged = [ranges[0]];

    for (let i = 1; i < ranges.length; i++) {
      const last = merged[merged.length - 1];
      const current = ranges[i];

      // Check if adjacent (last's toIdx == current's fromIdx)
      if (last.toIdx === current.fromIdx && last.toStation === current.fromStation) {
        // Merge: extend last range
        last.toIdx = current.toIdx;
        last.toStation = current.toStation;
      } else {
        // Not adjacent: add as separate range
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Calculate total vacant berth count
   */
  getTotalVacantBerths(trainState) {
    return this.getVacantBerths(trainState).length;
  }

  /**
   * Get vacancies for a specific coach
   */
  getVacanciesByCoach(trainState, coachNo) {
    return this.getVacantBerths(trainState).filter(v => v.coach === coachNo);
  }

  /**
   * Get vacancies for a specific class
   */
  getVacanciesByClass(trainState, classType) {
    return this.getVacantBerths(trainState).filter(v => v.class === classType);
  }

  /**
   * Get longest continuous vacancies (good for long-distance passengers)
   */
  getLongestVacancies(trainState, limit = 5) {
    return this.getVacantBerths(trainState)
      .sort((a, b) => (b.toIdx - b.fromIdx) - (a.toIdx - a.fromIdx))
      .slice(0, limit);
  }

  /**
   * Alias for getVacantBerths - for backward compatibility
   * Returns vacant segments (same as vacant berths)
   */
  getVacantSegments(trainState) {
    return this.getVacantBerths(trainState);
  }
}

module.exports = new VacancyService();

