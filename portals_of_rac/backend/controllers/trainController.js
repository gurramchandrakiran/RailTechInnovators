// backend/controllers/trainController.js (WITH WEBSOCKET + MULTI-TRAIN)

const DataService = require('../services/DataService');
const StationEventService = require('../services/StationEventService');
const RuntimeStateService = require('../services/RuntimeStateService');
const TrainEngineService = require('../services/TrainEngineService');
const db = require('../config/db');
const { COLLECTIONS } = require('../config/collections');

// Multi-train state storage: Map<trainNo, TrainState>
const trainStates = new Map();
let wsManager = null;

// Initialize wsManager after server starts
setTimeout(() => {
  wsManager = require('../config/websocket');
}, 1000);

/**
 * Update train status in MongoDB (Trains_Details collection)
 * so the landing page can show real-time status and current station.
 * → Field names from: backend/config/fields.js (SINGLE SOURCE OF TRUTH)
 */
async function updateTrainStatus(trainNo, status, extraFields = {}) {
  try {
    const { findTrainByNo } = require('../config/fields');
    const racDb = await db.getDb();
    const trainsCollection = racDb.collection(COLLECTIONS.TRAINS_DETAILS);
    await trainsCollection.updateOne(
      findTrainByNo(trainNo),
      { $set: { status, ...extraFields, updatedAt: new Date() } }
    );
    console.log(`   📝 Train ${trainNo} status → ${status}`);
  } catch (err) {
    console.warn(`   ⚠️ Failed to update train status in DB:`, err.message);
  }
}

class TrainController {
  /**
   * Initialize train with data from TWO MongoDB databases
   */
  async reloadTrainAfterAdd(reloadTrainNo) {
    const ts = reloadTrainNo ? trainStates.get(String(reloadTrainNo)) : trainStates.values().next().value;
    if (!ts) return;
    const trainNo = ts.trainNo;
    const journeyDate = ts.journeyDate;
    const newState = await DataService.loadTrainData(trainNo, journeyDate);
    newState.updateStats();
    trainStates.set(String(trainNo), newState);
    if (wsManager) {
      wsManager.broadcastStatsUpdate(newState.stats);
    }
  }

  async initializeTrain(req, res) {
    try {
      const { trainNo, journeyDate, trainName } = req.body;

      // Use global config if available
      const config = global.RAC_CONFIG || {};

      const train = trainNo || config.trainNo;
      const date = journeyDate || config.journeyDate;
      const name = trainName || config.trainName || await DataService.getTrainName(train);

      if (!train || !date) {
        return res.status(400).json({
          success: false,
          message: 'Missing train number or journey date.'
        });
      }

      console.log(`\n🚂 Initializing train ${train} for date ${date}...`);

      // ═══════════════════════════════════════════════════════════
      // CLEAR ALL STALE DATA FROM PREVIOUS SESSIONS
      // This ensures a fresh start with no duplicate reallocations
      // ═══════════════════════════════════════════════════════════
      try {
        // Use passengersDb where station_reallocations is stored
        const passengersDb = db.getPassengersDb();

        // Clear ALL upgrade notifications (not just pending)
        const upgradeNotifications = passengersDb.collection(COLLECTIONS.UPGRADE_NOTIFICATIONS);
        const notifResult = await upgradeNotifications.deleteMany({});
        if (notifResult.deletedCount > 0) {
          console.log(`   🗑️ Cleared ${notifResult.deletedCount} upgrade notifications`);
        }

        // Clear ALL station reallocations (pending, approved, rejected)
        const stationReallocations = passengersDb.collection(COLLECTIONS.STATION_REALLOCATIONS);
        const reallocResult = await stationReallocations.deleteMany({});
        if (reallocResult.deletedCount > 0) {
          console.log(`   🗑️ Cleared ${reallocResult.deletedCount} station reallocations`);
        }

        console.log('   ✅ Previous session data cleared - starting fresh');
      } catch (cleanupError) {
        console.warn('   ⚠️ Could not clear stale data:', cleanupError.message);
        // Continue with initialization even if cleanup fails
      }

      const trainState = await DataService.loadTrainData(train, date, name);
      trainStates.set(String(train), trainState);

      // ═══════════════════════════════════════════════════════════
      // RESTORE RUNTIME STATE FROM MONGODB (survives server restart)
      // ═══════════════════════════════════════════════════════════
      const savedState = await RuntimeStateService.loadState(train, date);
      if (savedState) {
        console.log(`   🔄 Restoring saved state: journeyStarted=${savedState.journeyStarted}, stationIdx=${savedState.currentStationIdx}`);
        trainState.journeyStarted = savedState.journeyStarted;

        // If we have a saved station index > 0, re-process stations to rebuild passenger states
        // This is necessary because boarding/deboarding data is not persisted
        if (savedState.currentStationIdx > 0 && savedState.journeyStarted) {
          console.log(`   🔄 Rebuilding state to station ${savedState.currentStationIdx}...`);

          // STEP 1: Pre-board ALL passengers whose fromIdx < savedStationIdx
          // (They should already be on the train but their boarded flag is false after fresh load)
          let preBoarded = 0;
          trainState.coaches.forEach(coach => {
            coach.berths.forEach(berth => {
              berth.passengers.forEach(p => {
                if (p.fromIdx < savedState.currentStationIdx && !p.boarded && !p.noShow) {
                  p.boarded = true;
                  preBoarded++;
                }
              });
            });
          });
          trainState.racQueue.forEach(rac => {
            if (rac.fromIdx < savedState.currentStationIdx && !rac.boarded && !rac.noShow) {
              rac.boarded = true;
              preBoarded++;
            }
          });
          console.log(`      ✓ Pre-boarded ${preBoarded} passengers already on train`);

          // STEP 2: Process each station to handle deboarding and calculate vacancies
          for (let i = 0; i < savedState.currentStationIdx; i++) {
            try {
              await StationEventService.processStationArrival(trainState);
              trainState.currentStationIdx++;
            } catch (stationError) {
              console.error(`      ❌ Error processing station ${i}:`, stationError.message);
            }
          }
          console.log(`   ✅ State rebuilt - now at station ${trainState.currentStationIdx} (${trainState.getCurrentStation().name})`);
          trainState.updateStats();
        } else {
          trainState.currentStationIdx = savedState.currentStationIdx;
        }
      }

      // ═══════════════════════════════════════════════════════════
      // AUTO-RESUME ENGINE if journey was in progress before restart
      // ═══════════════════════════════════════════════════════════
      if (trainState.journeyStarted && !TrainEngineService.isRunning(train)) {
        TrainEngineService.startEngine(train, { intervalMs: 2 * 60 * 1000 });
        console.log(`   🚂 Engine auto-resumed for train ${train} (journey was in progress)`);
      }

      const responseData = {
        trainNo: trainState.trainNo,
        trainName: trainState.trainName,
        journeyDate: trainState.journeyDate,
        totalStations: trainState.stations.length,
        totalPassengers: trainState.stats.totalPassengers,
        cnfPassengers: trainState.stats.cnfPassengers,
        racPassengers: trainState.stats.racPassengers,
        currentStation: trainState.getCurrentStation().name,
        currentStationIdx: trainState.currentStationIdx,
        journeyStarted: trainState.journeyStarted
      };

      // Update status in MongoDB for landing page
      // Use RUNNING if journey was already in progress (engine resumed)
      const trainStatus = trainState.journeyStarted ? 'RUNNING' : 'READY';
      await updateTrainStatus(train, trainStatus, {
        currentStation: trainState.getCurrentStation()?.name || null,
        totalStations: trainState.stations.length
      });

      // Broadcast train initialization
      if (wsManager) {
        wsManager.broadcastTrainUpdate('TRAIN_INITIALIZED', responseData);
      }

      res.json({
        success: true,
        message: "Train initialized successfully",
        data: responseData
      });

    } catch (error) {
      console.error("❌ Error initializing train:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Start journey
   */
  async startJourney(req, res) {
    try {
      const trainNo = req.body.trainNo || req.query.trainNo;
      const trainState = trainNo ? trainStates.get(String(trainNo)) : trainStates.values().next().value;

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      if (trainState.journeyStarted) {
        return res.status(400).json({
          success: false,
          message: "Journey already started"
        });
      }

      trainState.startJourney();

      const responseData = {
        journeyStarted: true,
        currentStation: trainState.getCurrentStation().name,
        currentStationIdx: trainState.currentStationIdx
      };

      // Persist state to MongoDB
      await RuntimeStateService.saveState({
        trainNo: trainState.trainNo,
        journeyDate: trainState.journeyDate,
        journeyStarted: true,
        currentStationIdx: trainState.currentStationIdx,
        engineRunning: true,
        lastTickAt: new Date()
      });

      // Broadcast journey started
      if (wsManager) {
        wsManager.broadcastTrainUpdate('JOURNEY_STARTED', responseData);
      }

      // Update status in MongoDB for landing page
      await updateTrainStatus(trainState.trainNo, 'RUNNING', {
        currentStation: trainState.getCurrentStation()?.name || null,
        currentStationIdx: trainState.currentStationIdx,
        totalStations: trainState.stations?.length || null
      });

      // Start the backend engine timer (auto-moves every 2 minutes)
      TrainEngineService.startEngine(trainState.trainNo, { intervalMs: 2 * 60 * 1000 });

      res.json({
        success: true,
        message: "Journey started",
        data: responseData
      });

    } catch (error) {
      console.error("❌ Error starting journey:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get complete train state
   */
  async getTrainState(req, res) {
    try {
      const trainNo = req.query.trainNo || req.body.trainNo;
      const trainState = trainNo ? trainStates.get(String(trainNo)) : trainStates.values().next().value;

      if (!trainState) {
        // No in-memory state — try loading station data from DB
        try {
          const racDb = await db.getDb();
          const trainsCol = racDb.collection(COLLECTIONS.TRAINS_DETAILS);

          // Find the specific train or just the first one
          const { TRAIN_FIELDS, findTrainByNo, getStationCollectionName } = require('../config/fields');
          const query = trainNo ? findTrainByNo(trainNo) : {};
          const trainDoc = await trainsCol.findOne(query);

          if (trainDoc) {
            // Get station collection name (handles trailing spaces via centralized helper)
            const stationColName = getStationCollectionName(trainDoc);

            let stations = [];
            if (stationColName) {
              const rawStations = await racDb.collection(stationColName)
                .find({}).sort({ SNO: 1 }).toArray();
              // Map DB field names to frontend-expected format
              stations = rawStations.map(s => ({
                idx: (s.SNO || 0) - 1,
                sno: s.SNO,
                code: s.Station_Code,
                name: s.Station_Name,
                arrival: s.Arrival_Time,
                departure: s.Departure_Time,
                distance: s.Distance,
                day: s.Day,
                halt: s.Halt_Duration,
                zone: s.Railway_Zone,
                division: s.Division,
                platform: s.Platform_Number,
                remarks: s.Remarks,
              }));
            }

            return res.json({
              success: true,
              data: {
                initialized: false,
                journeyStarted: false,
                trainNo: trainDoc[TRAIN_FIELDS.TRAIN_NO],
                trainName: trainDoc[TRAIN_FIELDS.TRAIN_NAME],
                stations: stations,
                coaches: [],
                racQueue: [],
                stats: {}
              }
            });
          }
        } catch (dbErr) {
          console.warn('⚠️ Could not load stations from DB:', dbErr.message);
        }

        return res.json({
          success: true,
          data: {
            initialized: false,
            journeyStarted: false,
            stations: [],
            coaches: [],
            racQueue: [],
            stats: {}
          }
        });
      }

      res.json({
        success: true,
        data: {
          trainNo: trainState.trainNo,
          trainName: trainState.trainName,
          journeyDate: trainState.journeyDate,
          currentStationIdx: trainState.currentStationIdx,
          journeyStarted: trainState.journeyStarted,
          stations: trainState.stations,
          coaches: trainState.coaches.map(coach => ({
            coachNo: coach.coachNo,
            class: coach.class,
            capacity: coach.capacity,
            berths: coach.berths.map(berth => ({
              berthNo: berth.berthNo,
              fullBerthNo: berth.fullBerthNo,
              type: berth.type,
              status: berth.status,
              passengers: berth.passengers,
              segmentOccupancy: berth.segmentOccupancy
            }))
          })),
          racQueue: trainState.racQueue,
          stats: trainState.stats
        }
      });

    } catch (error) {
      console.error("❌ Error getting train state:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Move to next station
   */
  async moveToNextStation(req, res) {
    try {
      const trainNo = req.body.trainNo || req.query.trainNo;
      const trainState = trainNo ? trainStates.get(String(trainNo)) : trainStates.values().next().value;

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      if (!trainState.journeyStarted) {
        return res.status(400).json({
          success: false,
          message: "Journey not started"
        });
      }

      if (trainState.isJourneyComplete()) {
        const finalData = {
          finalStation: trainState.stations[trainState.stations.length - 1].name,
          totalPassengers: trainState.stats.totalPassengers,
          finalOnboard: trainState.stats.currentOnboard,
          totalDeboarded: trainState.stats.totalDeboarded,
          totalNoShows: trainState.stats.totalNoShows,
          totalRACUpgraded: trainState.stats.totalRACUpgraded
        };

        // Mark as COMPLETE in MongoDB
        await updateTrainStatus(trainState.trainNo, 'COMPLETE', {
          currentStation: trainState.stations[trainState.stations.length - 1].name
        });

        // Broadcast journey complete
        if (wsManager) {
          wsManager.broadcastTrainUpdate('JOURNEY_COMPLETE', finalData);
        }

        return res.json({
          success: false,
          message: "Train has reached final destination",
          data: finalData
        });
      }

      const result = await StationEventService.processStationArrival(trainState);
      trainState.currentStationIdx++;

      // Unlock station upgrade lock for new station
      trainState.unlockStationForUpgrades();
      console.log(`🔓 Upgrade lock cleared for new station ${trainState.currentStationIdx}`);

      // Broadcast station arrival with all details
      if (wsManager) {
        wsManager.broadcastStationArrival({
          station: result.station,
          stationCode: result.stationCode,
          stationIdx: result.stationIdx,
          deboarded: result.deboarded,
          noShows: result.noShows,
          racAllocated: result.racAllocated,
          boarded: result.boarded,
          vacancies: result.vacancies,
          stats: result.stats,
          nextStation: trainState.getCurrentStation()?.name,
          upgrades: result.upgrades || []
        });

        // Broadcast updated statistics
        wsManager.broadcastStatsUpdate(trainState.stats);
      }

      res.json({
        success: true,
        message: `Processed station: ${result.station}`,
        data: result
      });

      // Persist updated state to MongoDB (after response to avoid blocking)
      RuntimeStateService.saveState({
        trainNo: trainState.trainNo,
        journeyDate: trainState.journeyDate,
        journeyStarted: trainState.journeyStarted,
        currentStationIdx: trainState.currentStationIdx
      });

      // Update current station in MongoDB for landing page
      const currentStationName = trainState.getCurrentStation()?.name || null;
      if (trainState.isJourneyComplete()) {
        await updateTrainStatus(trainState.trainNo, 'COMPLETE', {
          currentStation: currentStationName,
          currentStationIdx: trainState.currentStationIdx,
          totalStations: trainState.stations?.length || null
        });
      } else {
        await updateTrainStatus(trainState.trainNo, 'RUNNING', {
          currentStation: currentStationName,
          currentStationIdx: trainState.currentStationIdx,
          totalStations: trainState.stations?.length || null
        });
      }

    } catch (error) {
      console.error("❌ Error moving to next station:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Reset train to initial state
   */
  async resetTrain(req, res) {
    try {
      const reqTrainNo = req.body.trainNo || req.query.trainNo;
      const trainState = reqTrainNo ? trainStates.get(String(reqTrainNo)) : trainStates.values().next().value;

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const trainNo = trainState.trainNo;
      const journeyDate = trainState.journeyDate;

      console.log(`\n🔄 Resetting train ${trainNo}...`);

      // Stop the background engine if running
      TrainEngineService.stopEngine(trainNo);

      const newTrainState = await DataService.loadTrainData(trainNo, journeyDate);
      trainStates.set(String(trainNo), newTrainState);

      const responseData = {
        trainNo: newTrainState.trainNo,
        currentStation: newTrainState.getCurrentStation().name,
        journeyStarted: newTrainState.journeyStarted,
        stats: newTrainState.stats
      };

      // Broadcast train reset
      if (wsManager) {
        wsManager.broadcastTrainUpdate('TRAIN_RESET', responseData);
      }

      res.json({
        success: true,
        message: "Train reset to initial state",
        data: responseData
      });

      // Clear persisted state on reset
      await RuntimeStateService.clearState(trainNo);

    } catch (error) {
      console.error("❌ Error resetting train:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get train statistics
   */
  getTrainStats(req, res) {
    try {
      const trainNo = req.query.trainNo || req.body.trainNo;
      const trainState = trainNo ? trainStates.get(String(trainNo)) : trainStates.values().next().value;

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const currentStation = trainState.getCurrentStation();

      res.json({
        success: true,
        data: {
          stats: trainState.stats,
          currentStation: {
            name: currentStation.name,
            code: currentStation.code,
            idx: trainState.currentStationIdx
          },
          progress: {
            current: trainState.currentStationIdx + 1,
            total: trainState.stations.length,
            percentage: ((trainState.currentStationIdx + 1) / trainState.stations.length * 100).toFixed(1)
          }
        }
      });

    } catch (error) {
      console.error("❌ Error getting stats:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * List all trains
   * → Field names from: backend/config/fields.js (SINGLE SOURCE OF TRUTH)
   */
  async list(req, res) {
    try {
      const { TRAIN_FIELDS, toTrainConfig } = require('../config/fields');
      const col = db.getTrainDetailsCollection();
      const docs = await col.find({}).sort({ [TRAIN_FIELDS.TRAIN_NO]: 1 }).toArray();

      const items = docs.map(d => toTrainConfig(d));
      res.json({ success: true, data: items });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get allocation errors for diagnostics
   */
  getAllocationErrors(req, res) {
    try {
      const trainNo = req.query.trainNo || req.body.trainNo;
      const trainState = trainNo ? trainStates.get(String(trainNo)) : trainStates.values().next().value;

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      res.json({
        success: true,
        data: {
          stats: trainState.allocationStats || { total: 0, success: 0, failed: 0 },
          errors: trainState.allocationErrors || []
        }
      });

    } catch (error) {
      console.error("❌ Error getting allocation errors:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get global train state (for other controllers)
   * @param {string} [trainNo] - If provided, returns state for that train. Otherwise returns first loaded train.
   */
  getGlobalTrainState(trainNo) {
    if (!trainNo) return trainStates.values().next().value || null;
    return trainStates.get(String(trainNo)) || null;
  }

  /**
   * Get engine status (for admin dashboard)
   */
  getEngineStatus(req, res) {
    const trainNo = req.query.trainNo;
    if (trainNo) {
      res.json({
        success: true,
        data: {
          isRunning: TrainEngineService.isRunning(trainNo),
          timeUntilNextTick: TrainEngineService.getTimeUntilNextTick(trainNo)
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          runningEngines: TrainEngineService.getRunningEngines(),
          totalTrainsLoaded: trainStates.size
        }
      });
    }
  }

  /**
   * Get admin train overview — TTEs, passenger counts, notification stats per train
   * GET /api/admin/train-overview?trainNo=17225  (specific train)
   * GET /api/admin/train-overview                (all trains)
   * → Field names from: backend/config/fields.js (SINGLE SOURCE OF TRUTH)
   */
  async getTrainOverview(req, res) {
    try {
      const db = require('../config/db');
      const { COLLECTIONS, DBS } = require('../config/collections');
      const { TRAIN_FIELDS, findTrainByNo } = require('../config/fields');
      const PushSubscriptionService = require('../services/PushSubscriptionService');

      const racDb = await db.getDb();
      const requestedTrainNo = req.query.trainNo;

      // 1. Get all trains from Trains_Details
      const trainsCollection = racDb.collection(COLLECTIONS.TRAINS_DETAILS);
      const trainFilter = requestedTrainNo ? findTrainByNo(requestedTrainNo) : {};
      const trains = await trainsCollection.find(trainFilter).toArray();

      if (trains.length === 0) {
        return res.json({ success: true, data: { trains: [], summary: { totalTrains: 0 } } });
      }

      // 2. Get all TTEs
      const tteCollection = racDb.collection(COLLECTIONS.TTE_USERS);
      const tteFilter = requestedTrainNo ? { role: 'TTE', trainAssigned: String(requestedTrainNo) } : { role: 'TTE' };
      const allTTEs = await tteCollection.find(tteFilter, {
        projection: { employeeId: 1, name: 1, trainAssigned: 1, email: 1 }
      }).toArray();

      // 3. Get push subscription stats
      const pushCollection = racDb.collection(COLLECTIONS.PUSH_SUBSCRIPTIONS);
      const pushStats = await pushCollection.aggregate([
        { $group: { _id: { type: '$type', userId: '$userId' }, count: { $sum: 1 } } }
      ]).toArray();

      // Build set of users with push enabled
      const pushEnabledUsers = new Set();
      const pushEnabledTTEs = new Set();
      for (const stat of pushStats) {
        if (stat._id.type === 'passenger') pushEnabledUsers.add(stat._id.userId);
        if (stat._id.type === 'tte') pushEnabledTTEs.add(stat._id.userId);
      }

      // 4. Build per-train overview
      let passengersDb = null;
      try {
        passengersDb = db.getPassengersDb ? await db.getPassengersDb() : null;
      } catch (e) {
        // Passengers DB not connected yet — that's fine, we'll skip DB fallback
      }
      const trainOverviews = [];

      for (const train of trains) {
        const trainNo = String(train[TRAIN_FIELDS.TRAIN_NO]);
        const collectionName = train[TRAIN_FIELDS.PASSENGERS_COLLECTION_NAME];

        // TTEs for this train
        const trainTTEs = allTTEs.filter(t => String(t.trainAssigned) === trainNo);

        // Passenger stats from in-memory state (most accurate)
        const trainState = trainStates.get(trainNo);
        let passengerStats = { total: 0, onboard: 0, rac: 0, waitlist: 0, cnf: 0, cancelled: 0 };
        let emailEnabled = 0;
        let pushEnabled = 0;

        if (trainState && trainState.passengers) {
          const passengers = Array.isArray(trainState.passengers) ? trainState.passengers : [];
          passengerStats.total = passengers.length;

          for (const p of passengers) {
            const status = (p.Current_Status || p.Booking_Status || '').toUpperCase();
            if (status === 'CNF' || status === 'CONFIRMED') passengerStats.cnf++;
            else if (status === 'RAC') passengerStats.rac++;
            else if (status === 'WL' || status === 'WAITLIST') passengerStats.waitlist++;
            else if (status === 'CAN' || status === 'CANCELLED') passengerStats.cancelled++;

            if (p.Boarding_Status === 'Boarded') passengerStats.onboard++;
            if (p.Email) emailEnabled++;
            if (p.IRCTC_ID && pushEnabledUsers.has(p.IRCTC_ID)) pushEnabled++;
          }
        } else if (collectionName && passengersDb) {
          // Fallback: query MongoDB if train not loaded in memory
          try {
            const pCol = passengersDb.collection(collectionName);
            passengerStats.total = await pCol.countDocuments();
            passengerStats.cnf = await pCol.countDocuments({ $or: [{ Current_Status: 'CNF' }, { Current_Status: 'Confirmed' }] });
            passengerStats.rac = await pCol.countDocuments({ Current_Status: 'RAC' });
            passengerStats.waitlist = await pCol.countDocuments({ $or: [{ Current_Status: 'WL' }, { Current_Status: 'Waitlist' }] });
            passengerStats.cancelled = await pCol.countDocuments({ $or: [{ Current_Status: 'CAN' }, { Current_Status: 'Cancelled' }] });
            emailEnabled = await pCol.countDocuments({ Email: { $exists: true, $ne: '' } });
          } catch (e) { /* collection may not exist yet */ }
        }

        // TTE push enabled count
        const ttePushEnabled = trainTTEs.filter(t => pushEnabledTTEs.has(t.employeeId)).length;

        trainOverviews.push({
          trainNo,
          trainName: train.Train_Name || trainNo,
          status: train.status || (trainState?.journeyStarted ? 'RUNNING' : 'READY'),
          isEngineRunning: TrainEngineService.isRunning(trainNo),
          currentStation: trainState?.getCurrentStation()?.name || train.currentStation || null,
          ttes: {
            count: trainTTEs.length,
            list: trainTTEs.map(t => ({ employeeId: t.employeeId, name: t.name || t.employeeId })),
            pushEnabled: ttePushEnabled
          },
          passengers: {
            ...passengerStats,
            notifications: {
              pushEnabled,
              emailEnabled
            }
          }
        });
      }

      // 5. Summary
      const summary = {
        totalTrains: trainOverviews.length,
        totalTTEs: allTTEs.length,
        totalPassengers: trainOverviews.reduce((s, t) => s + t.passengers.total, 0),
        totalOnboard: trainOverviews.reduce((s, t) => s + t.passengers.onboard, 0),
        totalPushEnabled: trainOverviews.reduce((s, t) => s + t.passengers.notifications.pushEnabled, 0),
        totalEmailEnabled: trainOverviews.reduce((s, t) => s + t.passengers.notifications.emailEnabled, 0)
      };

      res.json({ success: true, data: { trains: trainOverviews, summary } });

    } catch (error) {
      console.error('❌ Error getting train overview:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

const trainControllerInstance = new TrainController();
// Export both the instance and updateTrainStatus for use by TrainEngineService
module.exports = trainControllerInstance;
module.exports.updateTrainStatus = updateTrainStatus;