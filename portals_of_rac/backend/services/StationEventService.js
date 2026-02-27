// backend/services/StationEventService.js

// Imports moved to top-level to avoid circular dependency anti-pattern
const CONSTANTS = require('./reallocation/reallocationConstants');
const StationWiseApprovalService = require('./StationWiseApprovalService');
const ReallocationService = require('./ReallocationService');

class StationEventService {
  /**
   * Process station arrival - main orchestration
   * Sequence: BOARD → DEBOARD → RAC UPGRADES → NO-SHOWS
   */
  async processStationArrival(trainState) {
    const currentStation = trainState.getCurrentStation();

    if (!currentStation) {
      throw new Error('Invalid station index');
    }

    console.log(`\n🚉 ═══════════════════════════════════════════`);
    console.log(`   Arrived at: ${currentStation.name} (${currentStation.code})`);
    console.log(`   Station ${currentStation.sno} of ${trainState.stations.length}`);
    console.log(`═══════════════════════════════════════════\n`);

    const result = {
      station: currentStation.name,
      stationCode: currentStation.code,
      stationIdx: trainState.currentStationIdx,
      boarded: 0,
      deboarded: 0,
      noShows: 0,
      racAllocated: 0,
      vacancies: 0,
      stats: null,
      upgrades: []
    };

    // **STEP 1: Board passengers FIRST** (they become eligible for upgrades)
    result.boarded = this.boardPassengers(trainState);

    // **STEP 2: Deboard passengers** (creates vacant segments)
    const deboardResult = this.deboardPassengers(trainState);
    result.deboarded = deboardResult.count;

    // **STEP 3: AUTO-CREATE pending reallocations for TTE/Passenger approval**
    try {
      const CurrentStationService = require('./CurrentStationReallocationService');
      const autoResult = await CurrentStationService.createPendingReallocationsFromMatches(trainState);
      result.racAllocated = autoResult.created || 0;
      console.log(`\n✅ Auto-created ${result.racAllocated} pending upgrade(s) for approval`);
    } catch (autoErr) {
      console.error('⚠️ Auto upgrade check failed (non-critical):', autoErr.message);
      result.racAllocated = 0;
    }
    result.upgrades = [];

    // **STEP 4: Process no-shows**
    result.noShows = this.processNoShows(trainState);

    // **STEP 5: Update statistics**
    trainState.updateStats();
    result.stats = { ...trainState.stats };

    console.log(`\n📊 Station Summary:`);
    console.log(`   Boarded: ${result.boarded}`);
    console.log(`   Deboarded: ${result.deboarded}`);
    console.log(`   RAC Upgraded: ${result.racAllocated}`);
    console.log(`   No-shows: ${result.noShows}`);
    console.log(`   Current Onboard: ${result.stats.currentOnboard}`);
    console.log(`   RAC Queue: ${result.stats.racPassengers}`);
    console.log(`   Vacant Berths: ${result.stats.vacantBerths}\n`);

    trainState.logEvent('STATION_ARRIVAL', `Processed station ${currentStation.name}`, result);

    return result;
  }

  /**
   * Deboard passengers at destination
   * Returns: { count, newlyVacantBerths }
   */
  deboardPassengers(trainState) {
    let deboardedCount = 0;
    const currentIdx = trainState.currentStationIdx;
    const newlyVacantBerths = []; // Track berths that just became vacant

    trainState.coaches.forEach(coach => {
      coach.berths.forEach(berth => {
        const deboardingPassengers = berth.getDeboardingPassengers(currentIdx);

        if (deboardingPassengers.length > 0) {
          deboardingPassengers.forEach(p => {
            console.log(`   👋 ${p.name} (PNR: ${p.pnr}) deboarded at ${p.to}`);
            berth.removePassenger(p.pnr);
            deboardedCount++;
            trainState.stats.totalDeboarded++;
          });

          // Track this berth as newly vacant (for targeted vacancy processing)
          newlyVacantBerths.push({
            berth,
            coachNo: coach.coachNo,
            berthNo: berth.berthNo,
            fullBerthNo: berth.fullBerthNo,
            type: berth.type,
            class: coach.class
          });
        }
      });
    });

    return { count: deboardedCount, newlyVacantBerths };
  }

  /**
   * Process no-shows (passengers who didn't board at their origin)
   */
  processNoShows(trainState) {
    let noShowCount = 0;
    const currentIdx = trainState.currentStationIdx;

    trainState.coaches.forEach(coach => {
      coach.berths.forEach(berth => {
        const passengersToRemove = [];

        berth.passengers.forEach(p => {
          // If passenger's origin is at or before current station and they're marked no-show but not boarded
          if (p.fromIdx <= currentIdx && p.noShow && !p.boarded) {
            console.log(`   ❌ ${p.name} (PNR: ${p.pnr}) marked as NO-SHOW at ${p.from}`);
            passengersToRemove.push(p.pnr);
            noShowCount++;
            trainState.stats.totalNoShows++;
          }
        });

        passengersToRemove.forEach(pnr => berth.removePassenger(pnr));
      });
    });

    return noShowCount;
  }

  /**
   * Process RAC upgrades with strict eligibility checking
   * UPDATED: Now supports two modes - AUTO (immediate allocation) and APPROVAL (TTE approval required)
   */
  async processRACUpgradesWithEligibility(trainState, newlyVacantBerths = []) {
    const currentIdx = trainState.currentStationIdx;

    console.log(`\n🎯 Processing RAC upgrades (Mode: ${CONSTANTS.CURRENT_MODE})...`);
    console.log(`   Newly vacant berths: ${newlyVacantBerths.length}`);

    // OPTIMIZATION: Only check newly vacant berths, not all 688 vacant berths!
    if (newlyVacantBerths.length === 0) {
      console.log(`   No new vacancies - skipping RAC upgrade processing`);
      return { count: 0, upgrades: [] };
    }

    // ===== MODE CHECK: AUTO vs APPROVAL =====
    if (CONSTANTS.CURRENT_MODE === CONSTANTS.REALLOCATION_MODE.APPROVAL) {
      // NEW PATH: Create pending reallocations for TTE approval
      console.log(`   📋 Mode: APPROVAL - Creating pending reallocations for TTE`);
      return await StationWiseApprovalService.createPendingReallocations(
        trainState,
        newlyVacantBerths
      );
    }

    // ===== EXISTING PATH: AUTO MODE (Immediate Allocation) =====
    console.log(`   ⚡ Mode: AUTO - Allocating immediately`);

    let upgradeCount = 0;
    const upgrades = [];

    // Get vacant segment ranges ONLY for newly vacant berths
    const vacantSegments = [];
    for (const vacantBerth of newlyVacantBerths) {
      const ranges = this._getVacantSegmentRangesForBerth(
        vacantBerth.berth,
        trainState.stations,
        { coachNo: vacantBerth.coachNo, class: vacantBerth.class }
      );
      vacantSegments.push(...ranges);
    }

    if (vacantSegments.length === 0) {
      console.log(`   No vacant segments found in newly vacant berths for upgrades`);
      return { count: 0, upgrades: [] };
    }

    console.log(`   Found ${vacantSegments.length} vacant segment(s) in newly vacant berths`);

    // For each vacant segment, find the first eligible RAC passenger
    for (const vacantSegment of vacantSegments) {
      console.log(`\n   Checking vacant segment: ${vacantSegment.berth.fullBerthNo} (${vacantSegment.fromStation} → ${vacantSegment.toStation})`);

      // Find first eligible RAC passenger for this segment
      const eligibleRAC = ReallocationService.getEligibleRACForVacantSegment(
        vacantSegment,
        currentIdx,
        trainState
      );

      if (!eligibleRAC) {
        console.log(`      No eligible RAC passengers for this segment`);
        continue;
      }

      console.log(`      Eligible: ${eligibleRAC.name} (${eligibleRAC.pnr}) - RAC ${eligibleRAC.racStatus}`);

      try {
        // Perform upgrade with co-passenger handling
        const upgradeResult = await ReallocationService.upgradeRACPassengerWithCoPassenger(
          eligibleRAC.pnr,
          {
            coachNo: vacantSegment.berth.coachNo,
            berthNo: vacantSegment.berth.berthNo
          },
          trainState
        );

        if (upgradeResult.success) {
          upgradeCount++;
          upgrades.push(upgradeResult);

          // If co-passenger was also upgraded, count it
          if (upgradeResult.coPassenger) {
            upgradeCount++;
          }
        }
      } catch (error) {
        console.error(`      ❌ Upgrade failed: ${error.message}`);
      }
    }

    console.log(`\n✨ Total RAC upgrades: ${upgradeCount}`);

    return { count: upgradeCount, upgrades };
  }

  /**
   * Get all vacant segment ranges across all berths
   */
  getVacantSegmentRanges(trainState) {
    const vacantSegments = [];
    const stations = trainState.stations;

    trainState.coaches.forEach(coach => {
      coach.berths.forEach(berth => {
        const ranges = this._getVacantSegmentRangesForBerth(berth, stations, coach);
        vacantSegments.push(...ranges);
      });
    });

    return vacantSegments;
  }

  /**
   * Get vacant segment ranges for a specific berth
   */
  _getVacantSegmentRangesForBerth(berth, stations, coach) {
    const ranges = [];
    let rangeStart = null;

    for (let i = 0; i < berth.segmentOccupancy.length; i++) {
      if (berth.segmentOccupancy[i] === null) {
        // Vacant segment
        if (rangeStart === null) {
          rangeStart = i;
        }
      } else {
        // Occupied segment
        if (rangeStart !== null) {
          // Close the range
          ranges.push({
            berth: berth,
            coachNo: coach.coachNo,
            class: coach.class,
            fromIdx: rangeStart,
            toIdx: i,
            fromStation: stations[rangeStart]?.code || `S${rangeStart}`,
            toStation: stations[i]?.code || `S${i}`,
          });
          rangeStart = null;
        }
      }
    }

    // Close final range if it extends to the end
    if (rangeStart !== null) {
      ranges.push({
        berth: berth,
        coachNo: coach.coachNo,
        class: coach.class,
        fromIdx: rangeStart,
        toIdx: berth.segmentOccupancy.length,
        fromStation: stations[rangeStart]?.code || `S${rangeStart}`,
        toStation: stations[berth.segmentOccupancy.length]?.code || `S${berth.segmentOccupancy.length}`,
      });
    }

    return ranges;
  }

  /**
   * Board passengers at origin (CNF + RAC passengers)
   */
  boardPassengers(trainState) {
    let boardedCount = 0;
    const currentIdx = trainState.currentStationIdx;

    console.log(`\n👥 Boarding passengers at station...`);

    // Board CNF passengers from berths
    trainState.coaches.forEach(coach => {
      coach.berths.forEach(berth => {
        const boardingPassengers = berth.getBoardingPassengers(currentIdx);

        boardingPassengers.forEach(p => {
          p.boarded = true;
          console.log(`   ✅ ${p.name} (PNR: ${p.pnr}) boarded at ${p.from}`);
          boardedCount++;
        });
      });
    });

    // Also board RAC passengers whose journey starts at current station
    trainState.racQueue.forEach(rac => {
      if (rac.fromIdx === currentIdx && !rac.boarded && !rac.noShow) {
        rac.boarded = true;
        console.log(`   ✅ RAC: ${rac.name} (PNR: ${rac.pnr}) boarded at ${rac.from}`);
        boardedCount++;
      }
    });

    return boardedCount;
  }
}

module.exports = new StationEventService();