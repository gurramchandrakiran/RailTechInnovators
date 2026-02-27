// backend/services/SeatPreferenceService.js
// Service to handle seat preference matching and priority allocation

class SeatPreferenceService {

    // Seat preference options
    static PREFERENCES = {
        LOWER_BERTH: 'Lower Berth',
        MIDDLE_BERTH: 'Middle Berth',
        UPPER_BERTH: 'Upper Berth',
        SIDE_LOWER: 'Side Lower',
        SIDE_UPPER: 'Side Upper',
        WINDOW: 'Window',
        AISLE: 'Aisle',
        NO_PREFERENCE: 'No Preference'
    };

    // Priority levels
    static PRIORITY = {
        SENIOR: 3,      // 60+ years
        WOMAN: 2,       // Female passengers
        ADULT: 1,       // 18-59 years
        CHILD: 0        // Under 18
    };

    /**
     * Calculate preference priority based on passenger attributes
     * @param {Object} passenger - Passenger object with Age and Gender
     * @returns {number} Priority level (0-3)
     */
    calculatePriority(passenger) {
        const age = passenger.Age || passenger.age;
        const gender = passenger.Gender || passenger.gender;

        if (age >= 60) {
            return SeatPreferenceService.PRIORITY.SENIOR;
        } else if (gender === 'Female') {
            return SeatPreferenceService.PRIORITY.WOMAN;
        } else if (age >= 18) {
            return SeatPreferenceService.PRIORITY.ADULT;
        }
        return SeatPreferenceService.PRIORITY.CHILD;
    }

    /**
     * Check if a berth type matches the passenger's preference
     * @param {string} berthType - Actual berth type
     * @param {string} preference - Passenger's seat preference
     * @returns {boolean} True if matches
     */
    matchesPreference(berthType, preference) {
        if (!preference || preference === 'No Preference') {
            return true;
        }

        // Normalize berth type names
        const normalizedBerth = this.normalizeBerthType(berthType);

        // Preference to berth type mapping
        const preferenceMapping = {
            'Lower Berth': ['lower', 'lb', 'lower berth'],
            'Middle Berth': ['middle', 'mb', 'middle berth'],
            'Upper Berth': ['upper', 'ub', 'upper berth'],
            'Side Lower': ['side lower', 'sl', 'side-lb', 'side-lower'],
            'Side Upper': ['side upper', 'su', 'side-ub', 'side-upper'],
            'Window': ['lower', 'lb', 'upper', 'ub', 'lower berth', 'upper berth'],  // Corner berths
            'Aisle': ['middle', 'mb', 'side lower', 'sl', 'side upper', 'su', 'middle berth']  // Middle/side berths
        };

        const matchingTypes = preferenceMapping[preference] || [];
        return matchingTypes.includes(normalizedBerth);
    }

    /**
     * Normalize berth type to lowercase standard format
     */
    normalizeBerthType(berthType) {
        if (!berthType) return '';
        return berthType.toLowerCase().trim();
    }

    /**
     * Get recommended preference based on passenger profile
     * @param {Object} passenger - Passenger object
     * @returns {string} Recommended seat preference
     */
    getRecommendedPreference(passenger) {
        const age = passenger.Age || passenger.age;
        const gender = passenger.Gender || passenger.gender;

        // Senior citizens should get lower berth
        if (age >= 60) {
            return 'Lower Berth';
        }

        // Women traveling alone may prefer side lower
        if (gender === 'Female') {
            return 'Side Lower';
        }

        // Young adults can handle upper berths
        if (age >= 18 && age < 40) {
            return 'No Preference';
        }

        // Middle-aged prefer lower/middle
        if (age >= 40 && age < 60) {
            return 'Lower Berth';
        }

        // Children - no specific preference
        return 'No Preference';
    }

    /**
     * Find best berth match for a passenger's preference
     * @param {Object} trainState - Current train state
     * @param {Object} passenger - Passenger requesting seat
     * @param {number} fromIdx - Boarding station index
     * @param {number} toIdx - Deboarding station index
     * @returns {Object} Best match result
     */
    findBestMatch(trainState, passenger, fromIdx, toIdx) {
        const preference = passenger.Seat_Preference || passenger.seatPreference || 'No Preference';
        const bookingClass = passenger.Booking_Class || passenger.bookingClass || passenger.Class;

        let bestMatch = null;
        let exactMatch = false;

        for (const coach of trainState.coaches) {
            // Skip if coach class doesn't match booking
            if (bookingClass && coach.class !== bookingClass &&
                coach.coach_class !== bookingClass) {
                continue;
            }

            for (const berth of coach.berths) {
                // Check if berth is available for the journey segment
                if (!this.isBerthAvailable(berth, fromIdx, toIdx)) {
                    continue;
                }

                const berthType = berth.berth_type || berth.type;

                if (this.matchesPreference(berthType, preference)) {
                    // Exact match found
                    exactMatch = true;
                    bestMatch = {
                        coach: coach.coach_name || coach.coachNo,
                        berth: berth,
                        berthNo: berth.berth_no || berth.berthNo,
                        berthType: berthType
                    };
                    break;
                }

                // Keep first available as fallback
                if (!bestMatch) {
                    bestMatch = {
                        coach: coach.coach_name || coach.coachNo,
                        berth: berth,
                        berthNo: berth.berth_no || berth.berthNo,
                        berthType: berthType
                    };
                }
            }

            if (exactMatch) break;
        }

        return { match: bestMatch, exactMatch, preference };
    }

    /**
     * Check if a berth is available for a journey segment
     */
    isBerthAvailable(berth, fromIdx, toIdx) {
        // Check segmentOccupancy if available
        if (berth.segmentOccupancy) {
            for (let i = fromIdx; i < toIdx; i++) {
                if (berth.segmentOccupancy[i] !== null &&
                    berth.segmentOccupancy[i] !== undefined) {
                    // Check if it's RAC (allow 2 passengers)
                    const isRACBerth = berth.berth_type === 'Side Lower' ||
                        berth.type === 'Side Lower';
                    if (!isRACBerth) {
                        return false;
                    }
                    // For RAC, check if already has 2 passengers
                    const occupants = Array.isArray(berth.segmentOccupancy[i])
                        ? berth.segmentOccupancy[i]
                        : [berth.segmentOccupancy[i]];
                    if (occupants.length >= 2) {
                        return false;
                    }
                }
            }
        }

        // Check segments array if available
        if (berth.segments) {
            for (let i = fromIdx; i < toIdx; i++) {
                if (berth.segments[i] && berth.segments[i].status !== 'vacant') {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Sort passengers by preference priority (seniors first, etc.)
     * @param {Array} passengers - Array of passengers
     * @returns {Array} Sorted passengers
     */
    sortByPriority(passengers) {
        return [...passengers].sort((a, b) => {
            const priorityA = a.Preference_Priority || a.preferencePriority || this.calculatePriority(a);
            const priorityB = b.Preference_Priority || b.preferencePriority || this.calculatePriority(b);
            return priorityB - priorityA;  // Higher priority first
        });
    }

    /**
     * Find the best coach for a group to stay together
     * @param {Object} trainState - Current train state
     * @param {Object} group - Booking group with passengers
     * @returns {string|null} Best coach name or null
     */
    findBestCoachForGroup(trainState, group) {
        const requiredSeats = group.passengers?.length || group.totalPassengers || 1;
        const bookingClass = group.passengers?.[0]?.Booking_Class ||
            group.passengers?.[0]?.bookingClass || 'Sleeper';

        let bestCoach = null;
        let maxAvailable = 0;

        for (const coach of trainState.coaches) {
            if (bookingClass && coach.class !== bookingClass &&
                coach.coach_class !== bookingClass) {
                continue;
            }

            let availableCount = 0;
            for (const berth of coach.berths) {
                // Simplified availability check for the current station
                const currentIdx = trainState.currentStationIdx || 0;
                if (this.isBerthAvailable(berth, currentIdx, currentIdx + 1)) {
                    availableCount++;
                }
            }

            // Check if this coach can fit the whole group
            if (availableCount >= requiredSeats && availableCount > maxAvailable) {
                maxAvailable = availableCount;
                bestCoach = coach.coach_name || coach.coachNo;
            }
        }

        return bestCoach;
    }

    /**
     * Allocate seats for a group, keeping them together when possible
     * @param {Object} trainState - Current train state
     * @param {Object} group - Booking group
     * @returns {Array} Allocation results for each passenger
     */
    async allocateGroupSeats(trainState, group) {
        const results = [];
        const sortedPassengers = this.sortByPriority(group.passengers || [group]);

        // Try to find a coach where the whole group can stay together
        const preferredCoach = this.findBestCoachForGroup(trainState, group);

        for (const passenger of sortedPassengers) {
            const fromIdx = passenger.fromIdx !== undefined ? passenger.fromIdx : 0;
            const toIdx = passenger.toIdx !== undefined ? passenger.toIdx : trainState.stations.length - 1;

            const { match, exactMatch } = this.findBestMatch(
                trainState,
                passenger,
                fromIdx,
                toIdx
            );

            results.push({
                passenger: passenger,
                passengerIndex: passenger.Passenger_Index || passenger.passengerIndex || 1,
                allocatedBerth: match,
                preferenceMatched: exactMatch,
                preferredCoach: preferredCoach
            });
        }

        return results;
    }

    /**
     * Get all passengers in a booking group from trainState
     * @param {Object} trainState - Train state object
     * @param {string} pnr - PNR number
     * @returns {Array} Array of passengers
     */
    getPassengersInGroup(trainState, pnr) {
        const passengers = [];

        // Search in berths
        for (const coach of trainState.coaches) {
            for (const berth of coach.berths) {
                if (berth.passengers) {
                    berth.passengers
                        .filter(p => p.pnr === pnr || p.PNR_Number === pnr)
                        .forEach(p => passengers.push({
                            ...p,
                            coach: coach.coach_name || coach.coachNo,
                            berth: berth.berth_no || berth.berthNo
                        }));
                }
            }
        }

        // Search in RAC queue
        if (trainState.racQueue) {
            trainState.racQueue
                .filter(r => r.pnr === pnr || r.PNR_Number === pnr)
                .forEach(r => passengers.push(r));
        }

        // Sort by passenger index
        passengers.sort((a, b) => {
            const idxA = a.Passenger_Index || a.passengerIndex || 1;
            const idxB = b.Passenger_Index || b.passengerIndex || 1;
            return idxA - idxB;
        });

        return passengers;
    }

    /**
     * Get booking group summary
     * @param {Object} trainState - Train state
     * @param {string} pnr - PNR number
     * @returns {Object|null} Group summary
     */
    getBookingGroupSummary(trainState, pnr) {
        const passengers = this.getPassengersInGroup(trainState, pnr);
        if (passengers.length === 0) return null;

        const leader = passengers.find(p => p.Is_Group_Leader || p.isGroupLeader) || passengers[0];

        return {
            pnr: pnr,
            totalPassengers: passengers.length,
            irctcId: leader.IRCTC_ID || leader.irctcId,
            trainNumber: leader.Train_Number || leader.trainNumber,
            journeyDate: leader.Journey_Date || leader.journeyDate,
            boardingStation: leader.Boarding_Station || leader.from,
            deboardingStation: leader.Deboarding_Station || leader.to,
            stats: {
                boarded: passengers.filter(p => p.boarded || p.Boarded).length,
                noShow: passengers.filter(p => p.noShow || p.NO_show).length,
                cnf: passengers.filter(p => (p.pnrStatus || p.PNR_Status) === 'CNF').length,
                rac: passengers.filter(p => (p.pnrStatus || p.PNR_Status) === 'RAC').length
            },
            passengers: passengers
        };
    }
}

module.exports = new SeatPreferenceService();
