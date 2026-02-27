// backend/utils/berthAllocator.js

class BerthAllocator {
  /**
   * Get all side lower berth numbers for Sleeper (SL) coaches - 72 berths
   */
  static getSideLowerBerths(coachClass = 'SL') {
    if (coachClass === 'AC_3_Tier') {
      // Three_Tier_AC coaches - 64 berths, RAC berths are side lower
      return [7, 15, 23, 31, 39, 47, 55, 63];
    }
    // Sleeper coaches - 72 berths
    return [7, 15, 23, 31, 39, 47, 55, 63, 71];
  }

  static isSideLowerBerth(seatNo, coachClass = 'SL') {
    return this.getSideLowerBerths(coachClass).includes(parseInt(seatNo));
  }

  static getBerthPriority(berthType) {
    const priority = {
      'Lower Berth': 1,
      'Side Lower': 2,
      'Middle Berth': 3,
      'Upper Berth': 4,
      'Side Upper': 5
    };
    return priority[berthType] || 99;
  }

  /**
   * Sort berths by priority
   */
  static sortBerthsByPriority(berths) {
    return berths.sort((a, b) => {
      const priorityA = this.getBerthPriority(a.type);
      const priorityB = this.getBerthPriority(b.type);
      return priorityA - priorityB;
    });
  }

  /**
   * Parse berth notation (e.g., "S1-15" -> {coach: "S1", seat: "15"})
   */
  static parseBerthNotation(berthNotation) {
    const parts = berthNotation.split('-');
    return {
      coach: parts[0],
      seat: parts[1]
    };
  }

  /**
   * Calculate total berths
   */
  static calculateTotalBerths(coachCount, berthsPerCoach) {
    return coachCount * berthsPerCoach;
  }

  /**
   * Get available RAC berths (side lower berths)
   */
  static getAvailableRACBerths(coach) {
    const sideLowerBerths = this.getSideLowerBerths(coach.class);
    return coach.berths.filter(berth =>
      sideLowerBerths.includes(berth.berthNo) &&
      (berth.status === 'VACANT' || berth.status === 'OCCUPIED')
    );
  }

  /**
   * Get berth type from seat number and coach class
   */
  static getBerthTypeFromSeatNo(seatNo, coachClass = 'SL') {
    // Three_Tier_AC (3A) coaches use 64 berths
    if (coachClass === 'AC_3_Tier') {
      const berthMapping3A = {
        lowerBerths: [1, 4, 9, 12, 17, 20, 25, 28, 33, 36, 41, 44, 49, 52, 57, 60],
        middleBerths: [2, 5, 10, 13, 18, 21, 26, 29, 34, 37, 42, 45, 50, 53, 58, 61],
        upperBerths: [3, 6, 11, 14, 19, 22, 27, 30, 35, 38, 43, 46, 51, 54, 59, 62],
        sideLower: [7, 15, 23, 31, 39, 47, 55, 63],  // RAC Berths
        sideUpper: [8, 16, 24, 32, 40, 48, 56, 64]
      };

      if (berthMapping3A.lowerBerths.includes(seatNo)) return "Lower Berth";
      if (berthMapping3A.middleBerths.includes(seatNo)) return "Middle Berth";
      if (berthMapping3A.upperBerths.includes(seatNo)) return "Upper Berth";
      if (berthMapping3A.sideLower.includes(seatNo)) return "Side Lower";
      if (berthMapping3A.sideUpper.includes(seatNo)) return "Side Upper";

      return "Lower Berth";
    }

    // Sleeper (SL) coaches use 72 berths
    const berthMapping = {
      lowerBerths: [1, 4, 9, 12, 17, 20, 25, 28, 33, 36, 41, 44, 49, 52, 57, 60, 65, 68],
      middleBerths: [2, 5, 10, 13, 18, 21, 26, 29, 34, 37, 42, 45, 50, 53, 58, 61, 66, 69],
      upperBerths: [3, 6, 11, 14, 19, 22, 27, 30, 35, 38, 43, 46, 51, 54, 59, 62, 67, 70],
      sideLower: [7, 15, 23, 31, 39, 47, 55, 63, 71],
      sideUpper: [8, 16, 24, 32, 40, 48, 56, 64, 72]
    };

    if (berthMapping.lowerBerths.includes(seatNo)) return "Lower Berth";
    if (berthMapping.middleBerths.includes(seatNo)) return "Middle Berth";
    if (berthMapping.upperBerths.includes(seatNo)) return "Upper Berth";
    if (berthMapping.sideLower.includes(seatNo)) return "Side Lower";
    if (berthMapping.sideUpper.includes(seatNo)) return "Side Upper";

    return "Lower Berth";
  }

  /**
   * Check if berth can accommodate RAC
   * @param {Object} berth - Berth object
   * @param {String} coachClass - Coach class ('SL' or 'AC_3_Tier'), required parameter
   */
  static canAccommodateRAC(berth, coachClass = 'SL') {
    return this.isSideLowerBerth(berth.berthNo, coachClass) && berth.passengers.length < 2;
  }

  /**
   * Get compartment number from seat
   */
  static getCompartmentNumber(seatNo) {
    return Math.ceil(seatNo / 8);
  }

  /**
   * Check if berths are in same compartment
   */
  static areBerthsInSameCompartment(seatNo1, seatNo2) {
    return this.getCompartmentNumber(seatNo1) === this.getCompartmentNumber(seatNo2);
  }

  /**
   * Get all berths in compartment
   */
  static getBerthsInCompartment(compartmentNo) {
    const start = (compartmentNo - 1) * 8 + 1;
    const end = compartmentNo * 8;
    const berths = [];
    for (let i = start; i <= end; i++) {
      berths.push(i);
    }
    return berths;
  }

  /**
   * Validate berth allocation
   */
  static validateBerthAllocation(berth, passenger, trainState) {
    // Get coach class from trainState
    const coachClass = trainState.getCoachClassFromBerth(berth);

    // Check class match
    if (coachClass !== passenger.class) {
      return {
        valid: false,
        reason: 'Class mismatch'
      };
    }

    // Check segment availability
    if (!berth.isAvailableForSegment(passenger.fromIdx, passenger.toIdx)) {
      return {
        valid: false,
        reason: 'Segment not available'
      };
    }

    return {
      valid: true,
      reason: 'Valid allocation'
    };
  }

  /**
   * Find optimal berth for passenger
   */
  static findOptimalBerth(vacantBerths, passenger, preferredType = null) {
    let filtered = vacantBerths;

    // Filter by preferred type if specified
    if (preferredType) {
      filtered = filtered.filter(b => b.type === preferredType);
    }

    // Sort by priority
    filtered = this.sortBerthsByPriority(filtered);

    // Return first available
    return filtered.length > 0 ? filtered[0] : null;
  }
}

module.exports = BerthAllocator;