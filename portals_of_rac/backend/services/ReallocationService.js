/**
 * ReallocationService.js (REFACTORED)
 * Main orchestrator for RAC reallocation operations
 * Delegates to specialized services for specific tasks
 */

const db = require("../config/db");
const wsManager = require("../config/websocket");
const UpgradeNotificationService = require("./UpgradeNotificationService");
const logger = require("../utils/logger");
const InAppNotificationService = require('./InAppNotificationService');
const WebPushService = require('./WebPushService');

// Import specialized services
const NoShowService = require("./reallocation/NoShowService");
const VacancyService = require("./reallocation/VacancyService");
const EligibilityService = require("./reallocation/EligibilityService");
const RACQueueService = require("./reallocation/RACQueueService");
const AllocationService = require("./reallocation/AllocationService");

class ReallocationService {
  async markNoShow(trainState, pnr) {
    return NoShowService.markNoShow(trainState, pnr);
  }

  getRACQueue(trainState) {
    return RACQueueService.getRACQueue(trainState);
  }

  getVacantBerths(trainState) {
    return VacancyService.getVacantBerths(trainState);
  }

  searchPassenger(trainState, pnr) {
    return RACQueueService.searchPassenger(trainState, pnr);
  }

  isEligibleForSegment(racPassenger, vacantSegment, trainState, currentStationIdx) {
    return EligibilityService.isEligibleForSegment(racPassenger, vacantSegment, trainState, currentStationIdx);
  }

  calculateJourneyDistance(fromStation, toStation, trainState) {
    return EligibilityService.calculateJourneyDistance(fromStation, toStation, trainState);
  }

  checkConflictingCNFPassenger(vacantSegment, trainState) {
    return EligibilityService.checkConflictingCNFPassenger(vacantSegment, trainState);
  }

  findCoPassenger(racPassenger, trainState) {
    return EligibilityService.findCoPassenger(racPassenger, trainState);
  }

  getEligibleRACForVacantSegment(trainState, vacantSegment, currentStationIdx) {
    return EligibilityService.getEligibleRACForVacantSegment(trainState, vacantSegment, currentStationIdx);
  }

  async applyReallocation(trainState, allocations) {
    return AllocationService.applyReallocation(trainState, allocations);
  }

  async upgradeRACPassengerWithCoPassenger(racPNR, newBerthDetails, trainState) {
    return AllocationService.upgradeRACPassengerWithCoPassenger(racPNR, newBerthDetails, trainState);
  }

  /**
   * Process a vacant berth to send upgrade offers to eligible RAC passengers
   * Called when a berth becomes vacant (e.g., no-show)
   */
  async processVacancyForUpgrade(trainState, vacantBerthInfo, currentStation) {
    try {
      // Validate inputs
      if (!trainState) {
        console.error('❌ processVacancyForUpgrade: trainState is null');
        return { error: 'Train state not initialized', offersCreated: 0 };
      }

      if (!vacantBerthInfo || !vacantBerthInfo.fullBerthNo) {
        console.error('❌ processVacancyForUpgrade: Invalid vacantBerthInfo', vacantBerthInfo);
        return { error: 'Invalid vacant berth information', offersCreated: 0 };
      }

      if (!currentStation) {
        console.error('❌ processVacancyForUpgrade: currentStation is null');
        return { error: 'Current station not provided', offersCreated: 0 };
      }

      logger.debug(`Processing vacancy for upgrade: ${vacantBerthInfo.fullBerthNo}`);
      logger.debug(`At station: ${currentStation.name} (${currentStation.code})`);

      // Find eligible RAC passengers (using loop since hasDeniedBerth is async)
      const eligibleRAC = [];
      for (const rac of trainState.racQueue) {
        // Must be boarded
        if (!rac.boarded) continue;

        // Check if passenger already denied this specific berth
        if (await UpgradeNotificationService.hasDeniedBerth(rac.pnr, vacantBerthInfo.fullBerthNo, trainState.trainNo)) {
          logger.debug(`Skipping ${rac.name} - previously denied ${vacantBerthInfo.fullBerthNo}`);
          continue;
        }

        eligibleRAC.push(rac);
      }

      logger.debug(`Found ${eligibleRAC.length} eligible RAC passenger(s)`);

      // Create notifications for eligible passengers
      let offersCreated = 0;

      for (const racPassenger of eligibleRAC) {
        try {
          const notification = await UpgradeNotificationService.createUpgradeNotification(
            racPassenger,
            vacantBerthInfo,
            currentStation,
            true,
            trainState.trainNo
          );

          if (notification) {
            offersCreated++;
            logger.info(`Created upgrade offer for ${racPassenger.name} (${racPassenger.pnr})`);

            // Create in-app notification
            if (racPassenger.irctcId) {
              await InAppNotificationService.createNotification(
                racPassenger.irctcId,
                'UPGRADE_OFFER',
                {
                  pnr: racPassenger.pnr,
                  berth: vacantBerthInfo.fullBerthNo,
                  coach: vacantBerthInfo.coachNo,
                  berthType: vacantBerthInfo.type,
                  offerId: notification.id,
                  message: `Upgrade offer available: ${vacantBerthInfo.fullBerthNo}`
                }
              );

              // Send browser push notification to passenger
              await WebPushService.sendPushNotification(
                racPassenger.irctcId,
                {
                  title: '🎉 Upgrade Offer Available!',
                  body: `Berth ${vacantBerthInfo.fullBerthNo} in ${vacantBerthInfo.coachNo} is available!`,
                  url: 'http://localhost:5175/#/upgrade-offers',
                  tag: `upgrade-${racPassenger.pnr}`
                }
              );
              logger.debug(`Push sent to passenger ${racPassenger.pnr}`);

            }
          }
        } catch (notifError) {
          console.error(`   ❌ Failed to create notification for ${racPassenger.pnr}:`, notifError.message);
        }
      }

      return { offersCreated, error: null };
    } catch (error) {
      console.error('❌ Error in processVacancyForUpgrade:', error);
      return { error: error.message, offersCreated: 0 };
    }
  }


  /**
   * Get Stage 1 eligibility matrix - shows RAC passengers passing basic constraints
   * Returns: Array of vacant berths with stage1Eligible passengers
   */
  getStage1Eligible(trainState) {
    try {
      const vacantSegments = VacancyService.getVacantSegments(trainState);
      const currentStationIdx = trainState.currentStationIdx || 0;
      const stage1Matrix = [];

      vacantSegments.forEach((vacantSegment) => {
        const stage1Eligible = EligibilityService.getStage1EligibleRAC(
          vacantSegment,
          currentStationIdx,
          trainState
        );

        if (stage1Eligible.length > 0) {
          stage1Matrix.push({
            berth: `${vacantSegment.coachNo}-${vacantSegment.berthNo}`,
            coach: vacantSegment.coachNo,
            berthNo: vacantSegment.berthNo,
            type: vacantSegment.type,
            berthType: vacantSegment.type,
            class: vacantSegment.class,
            vacantFrom: trainState.stations?.[vacantSegment.fromIdx]?.name || vacantSegment.from,
            vacantTo: trainState.stations?.[vacantSegment.toIdx]?.name || vacantSegment.to,
            vacantFromIdx: vacantSegment.fromIdx,
            vacantToIdx: vacantSegment.toIdx,
            stage1Eligible: stage1Eligible,
            stage1Count: stage1Eligible.length,
          });
        }
      });

      return stage1Matrix;
    } catch (error) {
      console.error('Error generating Stage 1 matrix:', error);
      return [];
    }
  }

  /**
   * Get Stage 2 results - three separate lists (online, offline, not eligible)
   * Returns: Object with onlineEligible, offlineEligible, notEligible arrays
   */
  getStage2Results(trainState, vacantBerthData) {
    try {
      const currentStationIdx = trainState.currentStationIdx || 0;

      // Find the vacant segment
      const vacantSegments = VacancyService.getVacantSegments(trainState);
      const vacantSegment = vacantSegments.find(
        seg => seg.coachNo === vacantBerthData.coach &&
          seg.berthNo === vacantBerthData.berthNo
      );

      if (!vacantSegment) {
        return {
          onlineEligible: [],
          offlineEligible: [],
          notEligible: [],
          error: 'Vacant berth not found'
        };
      }

      // Get Stage 1 eligible first
      const stage1Eligible = EligibilityService.getStage1EligibleRAC(
        vacantSegment,
        currentStationIdx,
        trainState
      );

      // Apply Stage 2 filtering
      const stage2Results = EligibilityService.getStage2Results(
        stage1Eligible,
        vacantSegment,
        currentStationIdx,
        trainState
      );

      return {
        berth: `${vacantSegment.coachNo}-${vacantSegment.berthNo}`,
        coach: vacantSegment.coachNo,
        berthNo: vacantSegment.berthNo,
        type: vacantSegment.type,
        class: vacantSegment.class,
        vacantFrom: trainState.stations?.[vacantSegment.fromIdx]?.name || vacantSegment.from,
        vacantTo: trainState.stations?.[vacantSegment.toIdx]?.name || vacantSegment.to,
        ...stage2Results,
      };
    } catch (error) {
      console.error('Error generating Stage 2 results:', error);
      return {
        onlineEligible: [],
        offlineEligible: [],
        notEligible: [],
        error: error.message
      };
    }
  }

  /**
   * ✨ NEW: Get eligible PNR groups for vacant seats (Group Selective Upgrade)
   * Returns groups where at least ONE passenger is eligible for vacant segment
   * Enables selective upgrade when group size > vacant seats
   */
  getEligibleGroupsForVacantSeats(trainState) {
    try {
      const vacantSegments = VacancyService.getVacantSegments(trainState);
      const currentStationIdx = trainState.currentStationIdx || 0;

      if (vacantSegments.length === 0) {
        return {
          totalVacantSeats: 0,
          eligibleGroups: [],
          message: 'No vacant seats available'
        };
      }

      // Get all RAC passengers sorted by queue position
      const racQueue = RACQueueService.getRACQueue(trainState);

      // Group ALL passengers by PNR (not just RAC - need to show CNF too)
      const groupsByPNR = new Map();

      // First, add all RAC passengers
      racQueue.forEach(racPassenger => {
        const pnr = racPassenger.pnr;
        if (!groupsByPNR.has(pnr)) {
          groupsByPNR.set(pnr, { racPassengers: [], cnfPassengers: [] });
        }
        groupsByPNR.get(pnr).racPassengers.push(racPassenger);
      });

      // Then, add CNF passengers from the same PNRs
      trainState.coaches.forEach(coach => {
        coach.berths.forEach(berth => {
          if (berth.passenger && berth.passenger.pnrStatus === 'CNF') {
            const pnr = berth.passenger.pnr;
            // Only add if this PNR already has RAC passengers
            if (groupsByPNR.has(pnr)) {
              groupsByPNR.get(pnr).cnfPassengers.push(berth.passenger);
            }
          }
        });
      });

      const eligibleGroups = [];

      // For each PNR group, check if ANY RAC passenger is eligible for ANY vacant segment
      groupsByPNR.forEach((group, pnr) => {
        const { racPassengers, cnfPassengers } = group;

        // Skip if this PNR has been rejected before
        const hasRejected = racPassengers.some(p => p.hasRejectedGroupUpgrade === true);
        if (hasRejected) {
          console.log(`⚠️ PNR ${pnr} previously rejected group upgrade - skipping`);
          return;
        }

        let groupIsEligible = false;
        let topRACPosition = Math.min(...racPassengers.map(p => p.racStatus || Infinity));

        // Check each RAC passenger against all vacant segments
        for (const passenger of racPassengers) {
          for (const vacantSegment of vacantSegments) {
            const isEligible = EligibilityService.isEligibleForSegment(
              passenger,
              vacantSegment,
              trainState,
              currentStationIdx
            );

            if (isEligible) {
              groupIsEligible = true;
              break;
            }
          }
          if (groupIsEligible) break;
        }

        if (groupIsEligible) {
          // Combine all passengers (RAC + CNF) for display
          const allPassengers = [
            ...racPassengers.map(p => ({
              id: p._id?.toString() || p.pnr,
              pnr: p.pnr,
              name: p.name,
              age: p.age,
              gender: p.gender,
              racStatus: p.racStatus,
              pnrStatus: 'RAC',  // Mark as RAC
              coach: p.coach,
              berth: p.berth,
              from: p.from,
              to: p.to,
              passengerStatus: p.passengerStatus || 'Offline',
              boarded: p.boarded || false,
              isSelectable: true  // Can be selected for upgrade
            })),
            ...cnfPassengers.map(p => ({
              id: p._id?.toString() || p.pnr,
              pnr: p.pnr,
              name: p.name,
              age: p.age,
              gender: p.gender,
              racStatus: null,
              pnrStatus: 'CNF',  // Mark as CNF
              coach: p.coach,
              berth: p.berth,
              from: p.from,
              to: p.to,
              passengerStatus: p.passengerStatus || 'Offline',
              boarded: p.boarded || false,
              isSelectable: false  // Cannot be selected (already confirmed)
            }))
          ];

          const racCount = racPassengers.length;
          const canUpgradeAll = racCount <= vacantSegments.length;

          eligibleGroups.push({
            pnr,
            passengers: allPassengers,  // All passengers (CNF + RAC)
            racPassengers: racPassengers.map(p => ({ // Only RAC passengers for selection
              id: p._id?.toString() || p.pnr,
              name: p.name,
              age: p.age,
              gender: p.gender
            })),
            eligibleCount: racCount,  // Only count RAC passengers
            totalCount: allPassengers.length,  // Total in group
            canUpgradeAll,
            topRACPosition,
            // Priority: Lower RAC number = higher priority
            priority: topRACPosition
          });
        }
      });

      // Sort by RAC position (fairness - best RAC position goes first)
      eligibleGroups.sort((a, b) => a.topRACPosition - b.topRACPosition);

      return {
        totalVacantSeats: vacantSegments.length,
        vacantSeats: vacantSegments.map(seg => ({
          berth: `${seg.coachNo}-${seg.berthNo}`,
          coach: seg.coachNo,
          berthNo: seg.berthNo,
          type: seg.type,
          class: seg.class,
          from: trainState.stations?.[seg.fromIdx]?.name || seg.from,
          to: trainState.stations?.[seg.toIdx]?.name || seg.to
        })),
        eligibleGroups,
        message: eligibleGroups.length > 0
          ? `Found ${eligibleGroups.length} eligible group(s)`
          : 'No eligible groups found'
      };
    } catch (error) {
      console.error('Error in getEligibleGroupsForVacantSeats:', error);
      return {
        totalVacantSeats: 0,
        eligibleGroups: [],
        error: error.message
      };
    }
  }


  /**
   * LEGACY: Get eligibility matrix - shows which RAC passengers are eligible for each vacant berth
   * NOTE: This uses the OLD single-stage logic. Use getStage1Eligible() for new UI.
   */
  getEligibilityMatrix(trainState) {
    try {
      const vacantSegments = VacancyService.getVacantSegments(trainState);
      const currentStationIdx = trainState.currentStationIdx || 0;
      const eligibilityMatrix = [];

      vacantSegments.forEach((vacantSegment) => {
        const stage1Eligible = EligibilityService.getStage1EligibleRAC(
          vacantSegment,
          currentStationIdx,
          trainState
        );

        if (stage1Eligible.length > 0) {
          eligibilityMatrix.push({
            berth: `${vacantSegment.coachNo}-${vacantSegment.berthNo}`,
            coach: vacantSegment.coachNo,
            berthNo: vacantSegment.berthNo,
            type: vacantSegment.type,
            berthType: vacantSegment.type,
            class: vacantSegment.class,
            vacantFrom: trainState.stations?.[vacantSegment.fromIdx]?.code || vacantSegment.from,
            vacantTo: trainState.stations?.[vacantSegment.toIdx]?.code || vacantSegment.to,
            vacantFromIdx: vacantSegment.fromIdx,
            vacantToIdx: vacantSegment.toIdx,
            vacantSegment: `${trainState.stations?.[vacantSegment.fromIdx]?.name || vacantSegment.from} → ${trainState.stations?.[vacantSegment.toIdx]?.name || vacantSegment.to}`,
            eligibleRAC: stage1Eligible,
            eligibleCount: stage1Eligible.length,
            topEligible: stage1Eligible[0], // Highest priority passenger
            topCandidate: stage1Eligible[0], // Compatibility field
          });
        }
      });

      return eligibilityMatrix;
    } catch (error) {
      console.error('Error generating eligibility matrix:', error);
      return [];
    }
  }

  getRACStats(trainState) {
    return RACQueueService.getRACStats(trainState);
  }
}

module.exports = new ReallocationService();

