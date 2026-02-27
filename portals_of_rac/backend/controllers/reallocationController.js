// backend/controllers/reallocationController.js (WITH WEBSOCKET)

const ReallocationService = require('../services/ReallocationService');
const ValidationService = require('../services/ValidationService');
const trainController = require('./trainController');

let wsManager = null;

// Initialize wsManager after server starts
setTimeout(() => {
  wsManager = require('../config/websocket');
}, 1000);

class ReallocationController {
  /**
   * Mark passenger as no-show
   */
  async markPassengerNoShow(req, res) {
    try {
      const { pnr } = req.body;

      // Validation: PNR is required
      if (!pnr) {
        return res.status(400).json({
          success: false,
          message: "PNR is required"
        });
      }

      // Validation: PNR format (basic check)
      if (typeof pnr !== 'string' || pnr.length !== 10) {
        return res.status(400).json({
          success: false,
          message: "Invalid PNR format. PNR must be 10 characters."
        });
      }

      const pnrValidation = ValidationService.validatePNR(pnr);
      if (!pnrValidation.valid) {
        return res.status(400).json({
          success: false,
          message: pnrValidation.reason
        });
      }

      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      // CRITICAL FIX: Get passenger location BEFORE marking no-show
      // because markNoShow removes the passenger from the berth
      const location = trainState.findPassenger(pnr);
      let vacantBerthInfo = null;

      if (location) {
        vacantBerthInfo = {
          berth: location.berth,
          coachNo: location.coachNo,
          berthNo: location.berth.berthNo,
          fullBerthNo: location.berth.fullBerthNo,
          type: location.berth.type,
          class: location.coach?.class || 'SL',
          coachName: location.coach?.coach_name || location.coachNo
        };
      }

      const result = await ReallocationService.markNoShow(trainState, pnr);

      // Send notification to the no-show passenger
      const NotificationService = require('../services/NotificationService');
      const InAppNotificationService = require('../services/InAppNotificationService');
      try {
        const result = trainState.findPassenger(pnr);
        if (result && result.passenger) {
          const passenger = result.passenger;

          // Fetch Email from MongoDB (trainState doesn't include it)
          const db = require('../config/db');
          const passengersCollection = db.getPassengersCollection();
          const passengerFromDB = await passengersCollection.findOne({ PNR_Number: pnr });

          // Merge MongoDB data with in-memory data
          const fullPassenger = {
            ...passenger,
            Email: passengerFromDB?.Email,
            Mobile: passengerFromDB?.Mobile,
            irctcId: passengerFromDB?.IRCTC_ID
          };

          // Send email
          await NotificationService.sendNoShowMarkedNotification(pnr, fullPassenger);
          console.log(`📧 NO-SHOW notification sent to passenger ${pnr}`);

          // Send browser push notification
          const WebPushService = require('../services/WebPushService');
          if (fullPassenger.irctcId) {
            await WebPushService.sendNoShowAlert(fullPassenger.irctcId, {
              pnr: pnr,
              berth: `${fullPassenger.coach}-${fullPassenger.berth}`
            });
            console.log(`📲 Browser push for NO-SHOW sent to ${pnr}`);
          }

          // Create in-app notification
          if (fullPassenger.irctcId) {
            InAppNotificationService.createNotification(
              fullPassenger.irctcId,
              'NO_SHOW_MARKED',
              {
                pnr,
                berth: `${passenger.coach}-${passenger.berth}`,
                coach: passenger.coach,
                message: 'You have been marked as NO-SHOW'
              }
            );
          }
        }
      } catch (notifError) {
        console.error('❌ Failed to send no-show notification:', notifError);
      }

      // Process vacancy for upgrade offers if berth info was captured
      if (vacantBerthInfo) {
        const currentStation = trainState.getCurrentStation();

        // Trigger offer creation for eligible RAC passengers
        try {
          const offerResult = await ReallocationService.processVacancyForUpgrade(
            trainState,
            vacantBerthInfo,
            currentStation
          );

          if (offerResult.error) {
            console.warn(`⚠️  Vacancy processing had errors: ${offerResult.error}`);
          } else if (offerResult.offersCreated > 0) {
            console.log(`✅ Created ${offerResult.offersCreated} upgrade offer(s)`);
          }
        } catch (vacancyError) {
          // Log but don't fail the no-show operation
          console.error('❌ Error processing vacancy for upgrades:', vacancyError);
        }
      } else {
        console.warn('⚠️  Could not capture berth info for vacancy processing');
      }

      // CRITICAL: Emit WebSocket event for real-time vacancy notification
      if (wsManager && vacantBerthInfo) {
        wsManager.emitToAll('VACANCY_CREATED', {
          coach: vacantBerthInfo.coachName || vacantBerthInfo.coachNo,
          berth: vacantBerthInfo.fullBerthNo,
          type: vacantBerthInfo.type,
          class: vacantBerthInfo.class,
          timestamp: new Date().toISOString()
        });
      }

      // ✨ NEW: Check for eligible groups and create upgrade offer
      const GroupUpgradeService = require('../services/GroupUpgradeService');
      const eligibleGroupsData = ReallocationService.getEligibleGroupsForVacantSeats(trainState);

      if (eligibleGroupsData.eligibleGroups && eligibleGroupsData.eligibleGroups.length > 0) {
        console.log(`🎯 Found ${eligibleGroupsData.eligibleGroups.length} eligible group(s) after no-show`);

        // ✅ FIX: Only offer to TOP priority group (prevents seat conflicts)
        // Groups already sorted by RAC position (fairness)
        const topGroup = eligibleGroupsData.eligibleGroups[0];

        const offerResult = await GroupUpgradeService.createGroupUpgradeOffer(
          topGroup.pnr,
          topGroup.passengers.filter(p => p.isSelectable).map(p => p.id),  // Only RAC passengers
          eligibleGroupsData.totalVacantSeats
        );

        if (offerResult.success && wsManager) {
          // Emit event to passenger portal
          wsManager.emitToAll('GROUP_UPGRADE_AVAILABLE', {
            pnr: topGroup.pnr,
            passengerCount: topGroup.eligibleCount,  // RAC count only
            totalCount: topGroup.totalCount,  // Total passengers (RAC + CNF)
            vacantSeatsCount: eligibleGroupsData.totalVacantSeats,
            canUpgradeAll: topGroup.canUpgradeAll,
            expiresAt: offerResult.expiresAt,
            vacantSeats: eligibleGroupsData.vacantSeats,
            passengers: topGroup.passengers.map(p => ({
              id: p.id,
              name: p.name,
              age: p.age,
              gender: p.gender,
              pnrStatus: p.pnrStatus,  // 'RAC' or 'CNF'
              isSelectable: p.isSelectable  // true for RAC, false for CNF
            }))
          });

          console.log(`📨 Sent GROUP_UPGRADE_AVAILABLE event for PNR ${topGroup.pnr} (top priority)`);
        }
      }

      // Broadcast no-show event
      if (wsManager) {
        wsManager.broadcastNoShow({
          passenger: result.passenger,
          currentStation: trainState.getCurrentStation()?.name,
          stats: trainState.stats
        });

        // Also broadcast updated stats
        wsManager.broadcastStatsUpdate(trainState.stats);
      }

      res.json({
        success: true,
        message: "Passenger marked as no-show",
        passenger: result.passenger,
      });

    } catch (error) {
      console.error("❌ Error marking no-show:", error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get RAC queue
   */
  getRACQueue(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const racQueue = ReallocationService.getRACQueue(trainState);

      res.json({
        success: true,
        data: {
          total: racQueue.length,
          queue: racQueue
        }
      });

    } catch (error) {
      console.error("❌ Error getting RAC queue:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get vacant berths with enhanced station information
   */
  getVacantBerths(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const vacancies = ReallocationService.getVacantBerths(trainState);
      const currentStationIdx = trainState.currentStationIdx || 0;
      const stations = trainState.stations || [];

      // Enhance vacancies with full station details
      const enhancedVacancies = vacancies.map(vacancy => {
        const fromStation = stations[vacancy.fromIdx];
        const toStation = stations[vacancy.toIdx];

        // Determine "willOccupyAt" - the next station where someone boards
        // This is the same as toStation in most cases
        const willOccupyAtStation = toStation;

        // Check if this berth is currently vacant (at current station)
        const isCurrentlyVacant = currentStationIdx >= vacancy.fromIdx && currentStationIdx < vacancy.toIdx;

        return {
          coachNo: vacancy.coach,
          berthNo: vacancy.berthNo,
          fullBerthNo: vacancy.berth,
          type: vacancy.type,
          class: vacancy.class,

          // Station names (user-friendly)
          vacantFromStation: fromStation?.name || vacancy.vacantFrom,
          vacantToStation: toStation?.name || vacancy.vacantTo,
          willOccupyAt: willOccupyAtStation?.name || toStation?.name || vacancy.vacantTo,

          // Station codes (short identifiers)
          vacantFromStationCode: fromStation?.code || vacancy.vacantFrom,
          vacantToStationCode: toStation?.code || vacancy.vacantTo,
          willOccupyAtCode: willOccupyAtStation?.code || toStation?.code || vacancy.vacantTo,

          // Index information
          fromIdx: vacancy.fromIdx,
          toIdx: vacancy.toIdx,
          duration: vacancy.duration,

          // Is this berth vacant RIGHT NOW at current station?
          isCurrentlyVacant: isCurrentlyVacant
        };
      });

      res.json({
        success: true,
        data: {
          total: enhancedVacancies.length,
          vacancies: enhancedVacancies,
          currentStation: stations[currentStationIdx]?.name || 'Unknown',
          currentStationIdx: currentStationIdx
        }
      });

    } catch (error) {
      console.error("❌ Error getting vacant berths:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Search passenger by PNR
   */
  searchPassenger(req, res) {
    try {
      const { pnr } = req.params;

      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const passenger = ReallocationService.searchPassenger(trainState, pnr);

      res.json({
        success: true,
        data: passenger
      });

    } catch (error) {
      console.error("❌ Error searching passenger:", error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get Stage 1 eligible passengers (basic constraints)
   */
  getStage1Eligible(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train state not initialized"
        });
      }

      const stage1Matrix = ReallocationService.getStage1Eligible(trainState);

      res.json({
        success: true,
        data: {
          stage1Matrix: stage1Matrix,
          totalVacantBerths: stage1Matrix.length,
          currentStation: trainState.stations?.[trainState.currentStationIdx]?.name || 'Unknown'
        }
      });
    } catch (error) {
      console.error("Error getting Stage 1 eligible:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get Stage 1 eligible passengers"
      });
    }
  }

  /**
   * Get Stage 2 results for specific berth (online/offline/not eligible lists)
   */
  getStage2Results(req, res) {
    try {
      const { coach, berthNo } = req.query;

      if (!coach || !berthNo) {
        return res.status(400).json({
          success: false,
          message: "Coach and berthNo are required"
        });
      }

      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train state not initialized"
        });
      }

      const stage2Results = ReallocationService.getStage2Results(trainState, {
        coach,
        berthNo
      });

      res.json({
        success: true,
        data: stage2Results
      });
    } catch (error) {
      console.error("Error getting Stage 2 results:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get Stage 2 results"
      });
    }
  }

  /**
   * Get eligibility matrix (LEGACY - uses Stage 1 only now)
   */
  getEligibilityMatrix(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train state not initialized"
        });
      }

      const matrix = ReallocationService.getEligibilityMatrix(trainState);

      // ✅ NEW: Get all boarded RAC passengers (not just eligible ones)
      const boardedRACPassengers = trainState.racQueue.filter(r =>
        r.pnrStatus === 'RAC' &&
        r.passengerStatus === 'Online' &&
        r.boarded === true
      ).map(r => ({
        pnr: r.pnr,
        name: r.name,
        racNumber: r.racStatus,
        boarded: r.boarded,
        from: r.from,
        to: r.to,
        fromIdx: r.fromIdx,
        toIdx: r.toIdx,
        class: r.class,
        age: r.age,
        gender: r.gender
      }));

      // ✅ Calculate vacancy summary
      const totalVacancies = matrix.length;
      const vacanciesWithEligible = matrix.filter(m => m.eligibleCount > 0).length;

      res.json({
        success: true,
        data: {
          eligibility: matrix,
          // ✅ NEW: Summary for admin dashboard
          summary: {
            totalVacantBerths: totalVacancies,
            vacanciesWithEligible: vacanciesWithEligible,
            vacanciesWithoutEligible: totalVacancies - vacanciesWithEligible,
            totalBoardedRAC: boardedRACPassengers.length,
            racPassengers: boardedRACPassengers
          }
        }
      });
    } catch (error) {
      console.error("Error getting eligibility matrix:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate eligibility matrix"
      });
    }
  }

  /**
   * Apply reallocation
   */
  applyReallocation(req, res) {
    try {
      const { allocations } = req.body;

      if (!allocations || !Array.isArray(allocations)) {
        return res.status(400).json({
          success: false,
          message: "Allocations array is required"
        });
      }

      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const results = ReallocationService.applyReallocation(trainState, allocations);

      // Broadcast reallocation event
      if (wsManager) {
        wsManager.broadcastRACReallocation({
          success: results.success,
          failed: results.failed,
          totalAllocated: results.success.length,
          currentStation: trainState.getCurrentStation()?.name,
          stats: trainState.stats
        });

        // Broadcast updated stats
        wsManager.broadcastStatsUpdate(trainState.stats);
      }

      res.json({
        success: true,
        message: `Applied ${results.success.length} reallocations`,
        data: results
      });

    } catch (error) {
      console.error("❌ Error applying reallocation:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Send upgrade offer to passenger (instead of auto-applying)
   * For online passengers: Send WebSocket notification
   * For offline passengers: Should use addOfflineUpgrade instead
   */
  async sendUpgradeOffer(req, res) {
    try {
      const { pnr, berthDetails } = req.body;

      if (!pnr || !berthDetails) {
        return res.status(400).json({
          success: false,
          message: "PNR and berth details are required"
        });
      }

      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train state not initialized"
        });
      }

      // Find passenger
      const passenger = trainState.racQueue.find(p => p.pnr === pnr);

      if (!passenger) {
        return res.status(404).json({
          success: false,
          message: "Passenger not found in RAC queue"
        });
      }

      // Check if passenger is online
      const isOnline = passenger.passengerStatus === 'Online' || passenger.Online_Status === 'online';

      if (!isOnline) {
        return res.status(400).json({
          success: false,
          message: "Passenger is offline. Use offline upgrade endpoint instead."
        });
      }

      // Send WebSocket upgrade offer
      const PushNotificationService = require('../services/PushNotificationService');
      const offerResult = await PushNotificationService.sendUpgradeOffer(
        passenger.irctcId || passenger.IRCTC_ID,
        {
          pnr: pnr,
          currentStatus: passenger.pnrStatus,
          offeredBerth: `${berthDetails.coach}-${berthDetails.berthNo}`,
          coach: berthDetails.coach,
          berthNo: berthDetails.berthNo,
          berthType: berthDetails.type || 'Lower',
          expiresIn: 900 // 15 minutes
        }
      );

      console.log(`📤 Upgrade offer sent to ${passenger.name} (${pnr})`);

      res.json({
        success: true,
        message: `Upgrade offer sent to ${passenger.name}`,
        data: {
          pnr: pnr,
          passengerName: passenger.name,
          offeredBerth: `${berthDetails.coach}-${berthDetails.berthNo}`,
          offerSent: true,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }
      });

    } catch (error) {
      console.error("❌ Error sending upgrade offer:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send upgrade offer",
        error: error.message
      });
    }
  }

  /**
   * ✨ NEW: Get eligible PNR groups for group selective upgrade
   */
  async getEligibleGroups(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const result = ReallocationService.getEligibleGroupsForVacantSeats(trainState);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting eligible groups:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * ✨ NEW: Select specific passengers from a group for upgrade
   * Handles both TTE and passenger portal selections
   */
  async selectPassengersForUpgrade(req, res) {
    try {
      const { pnr, selectedPassengerIds, requestedBy } = req.body;

      // Validation
      if (!pnr || !selectedPassengerIds || !Array.isArray(selectedPassengerIds)) {
        return res.status(400).json({
          success: false,
          message: "PNR and selectedPassengerIds (array) are required"
        });
      }

      if (!requestedBy || !['passenger', 'tte'].includes(requestedBy)) {
        return res.status(400).json({
          success: false,
          message: "requestedBy must be 'passenger' or 'tte'"
        });
      }

      // ✅ SECURITY: PNR ownership validation (only if requested by passenger)
      if (requestedBy === 'passenger' && req.user) {
        // req.user is populated by authMiddleware JWT verification
        const authenticatedPNR = req.user.pnr;

        if (!authenticatedPNR) {
          return res.status(401).json({
            success: false,
            message: "Authentication error: PNR not found in user session"
          });
        }

        if (authenticatedPNR !== pnr) {
          return res.status(403).json({
            success: false,
            message: "Access denied: You can only select passengers from your own PNR"
          });
        }
      }

      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      // Get vacant segments
      const VacancyService = require('../services/reallocation/VacancyService');
      const vacantSegments = VacancyService.getVacantSegments(trainState);

      if (vacantSegments.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No vacant seats available"
        });
      }

      // ✅ FIX RACE CONDITION: Re-check vacancy count at selection time
      if (selectedPassengerIds.length > vacantSegments.length) {
        return res.status(409).json({
          message: `Only ${vacantSegments.length} seat(s) currently available. Cannot upgrade ${selectedPassengerIds.length} passengers.`
        });
      }

      // Find all RAC passengers in the PNR (CNF passengers cannot be in racQueue)
      const pnrPassengers = trainState.racQueue.filter(p => p.pnr === pnr);

      if (pnrPassengers.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No RAC passengers found for PNR ${pnr}`
        });
      }

      // ✅ Validate offer hasn't expired (re-check at selection time)
      const GroupUpgradeService = require('../services/GroupUpgradeService');
      const offerStatus = await GroupUpgradeService.getOfferStatus(pnr);

      if (!offerStatus.hasOffer) {
        return res.status(404).json({
          success: false,
          message: 'No active upgrade offer found for this PNR'
        });
      }

      if (offerStatus.isExpired) {
        return res.status(410).json({
          success: false,
          message: 'This upgrade offer has expired. The TTE will handle the upgrade decision.'
        });
      }

      if (!offerStatus.visibleToPassenger && requestedBy === 'passenger') {
        return res.status(403).json({
          success: false,
          message: 'This offer is no longer available to passengers'
        });
      }

      // Validate all selected passengers belong to this PNR
      const selectedPassengers = [];
      for (const selectedId of selectedPassengerIds) {
        const passenger = pnrPassengers.find(p =>
          (p._id?.toString() === selectedId) || (p.pnr === selectedId)
        );

        if (!passenger) {
          return res.status(400).json({
            success: false,
            message: `Passenger ${selectedId} not found in PNR ${pnr}`
          });
        }

        // ✅ Validate passenger is RAC status (only RAC can be upgraded)
        if (passenger.pnrStatus !== 'RAC') {
          return res.status(400).json({
            success: false,
            message: `Passenger ${passenger.name} cannot be upgraded (status: ${passenger.pnrStatus}). Only RAC passengers are eligible.`
          });
        }

        selectedPassengers.push(passenger);
      }

      // Apply upgrades using AllocationService
      const AllocationService = require('../services/reallocation/AllocationService');
      const upgradedPassengers = [];
      const errors = [];
      const usedSegments = new Set(); // Track used segments to avoid double allocation

      for (const passenger of selectedPassengers) {
        // Find the best-fit vacant segment for this passenger's journey
        let bestSegment = null;
        let bestScore = Infinity;

        for (let j = 0; j < vacantSegments.length; j++) {
          if (usedSegments.has(j)) continue; // Skip already-used segments

          const seg = vacantSegments[j];

          // Segment must cover passenger's entire journey:
          // seg.fromIdx <= passenger.fromIdx AND seg.toIdx >= passenger.toIdx
          if (seg.fromIdx <= passenger.fromIdx && seg.toIdx >= passenger.toIdx) {
            // Score: prefer tightest fit (smallest excess vacancy)
            const score = (passenger.fromIdx - seg.fromIdx) + (seg.toIdx - passenger.toIdx);
            if (score < bestScore) {
              bestScore = score;
              bestSegment = { index: j, segment: seg };
            }
          }
        }

        if (!bestSegment) {
          errors.push({
            passenger: passenger.name,
            error: `No matching vacant segment covers journey ${passenger.from} → ${passenger.to}`
          });
          continue;
        }

        const vacantSegment = bestSegment.segment;
        usedSegments.add(bestSegment.index);

        try {
          const fullBerthNo = `${vacantSegment.coachNo}-${vacantSegment.berthNo}`;
          const oldBerth = passenger.coach && passenger.seat
            ? `RAC ${passenger.racStatus || ''} (${passenger.coach}-${passenger.seat})`
            : `RAC ${passenger.racStatus || ''}`;

          await AllocationService.upgradeRACPassengerWithCoPassenger(
            passenger.pnr,
            {
              coachNo: vacantSegment.coachNo,
              berthNo: vacantSegment.berthNo,
              fullBerthNo,
              type: vacantSegment.type
            },
            trainState
          );

          upgradedPassengers.push({
            pnr: passenger.pnr,
            name: passenger.name,
            from: oldBerth,
            to: fullBerthNo,
            selectedBy: requestedBy
          });
        } catch (error) {
          errors.push({
            passenger: passenger.name,
            error: error.message
          });
        }
      }

      // Emit WebSocket event
      if (wsManager && upgradedPassengers.length > 0) {
        wsManager.emitToAll('GROUP_UPGRADE_SELECTED', {
          pnr,
          upgradedPassengers: upgradedPassengers.map(p => ({
            name: p.name,
            berth: p.to
          })),
          remainingInRAC: pnrPassengers.length - upgradedPassengers.length,
          selectedBy: requestedBy
        });
      }

      res.json({
        success: true,
        message: `Successfully upgraded ${upgradedPassengers.length} passenger(s)`,
        data: {
          upgraded: upgradedPassengers,
          errors,
          totalUpgraded: upgradedPassengers.length,
          totalRequested: selectedPassengerIds.length
        }
      });

    } catch (error) {
      console.error('Error in selectPassengersForUpgrade:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Reject a group upgrade offer (passenger declines)
   * Marks entire PNR as rejected - no future offers
   */
  async rejectGroupUpgrade(req, res) {
    try {
      const { pnr, reason } = req.body;

      if (!pnr) {
        return res.status(400).json({
          success: false,
          message: "PNR is required"
        });
      }

      const GroupUpgradeService = require('../services/GroupUpgradeService');
      const result = await GroupUpgradeService.rejectGroupUpgradeOffer(pnr, reason || 'User declined');

      if (result.success) {
        res.json({
          success: true,
          message: `Group upgrade offer rejected for PNR ${pnr}`,
          data: { modifiedCount: result.modifiedCount }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message || 'Failed to reject offer'
        });
      }
    } catch (error) {
      console.error('Error in rejectGroupUpgrade:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * ✅ UX ENHANCEMENT: Check if PNR has active group upgrade offer (for reconnection)
   * GET /api/reallocation/group-upgrade-status/:pnr
   */
  async getGroupUpgradeStatus(req, res) {
    try {
      const { pnr } = req.params;

      if (!pnr) {
        return res.status(400).json({
          success: false,
          message: "PNR is required"
        });
      }

      const GroupUpgradeService = require('../services/GroupUpgradeService');
      const offerStatus = await GroupUpgradeService.getOfferStatus(pnr);

      if (!offerStatus.hasOffer) {
        return res.json({
          success: true,
          hasActiveOffer: false,
          message: 'No active offer for this PNR'
        });
      }

      if (offerStatus.isExpired) {
        return res.json({
          success: true,
          hasActiveOffer: false,
          message: 'Offer has expired'
        });
      }

      // Active offer exists
      res.json({
        success: true,
        hasActiveOffer: true,
        pnr: pnr,
        vacantSeatsCount: offerStatus.vacantSeatsCount,
        passengerCount: offerStatus.passengerCount,
        expiresAt: offerStatus.expiresAt,
        createdAt: offerStatus.createdAt
      });

    } catch (error) {
      console.error('Error in getGroupUpgradeStatus:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ReallocationController();