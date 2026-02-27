// backend/controllers/passengerController.js
const DataService = require("../services/DataService");
const PassengerService = require("../services/PassengerService");
const db = require("../config/db");
const wsManager = require("../config/websocket");
const trainController = require("./trainController");

class PassengerController {
  /**
   * Get PNR details (PUBLIC - no authentication required)
   */
  async getPNRDetails(req, res) {
    try {
      const { pnr } = req.params;

      if (!pnr) {
        return res.status(400).json({
          success: false,
          message: "PNR number is required",
        });
      }

      const trainState = trainController.getGlobalTrainState();
      const passengerDetails = await PassengerService.getPassengerDetails(pnr, trainState);

      res.json({
        success: true,
        data: passengerDetails
      });
    } catch (error) {
      console.error("❌ Error getting PNR details:", error);

      const statusCode = error.message === 'PNR not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get passenger details by IRCTC_ID (for passenger portal)
   * Works even without train initialization — falls back to searching all passenger collections
   */
  async getPassengerByIRCTC(req, res) {
    try {
      const { irctcId } = req.params;

      if (!irctcId) {
        return res.status(400).json({
          success: false,
          message: "IRCTC ID is required",
        });
      }

      let passenger = null;

      // Strategy 1: Try configured collection first
      try {
        passenger = await db.getPassengersCollection().findOne({ IRCTC_ID: irctcId });
      } catch (_) {
        // Collection not configured — fall through to strategy 2
      }

      // Strategy 2: Search across all trains' passenger collections
      if (!passenger) {
        try {
          const { COLLECTIONS } = require('../config/collections');
          const racDb = await db.getDb();
          const passengersDb = db.getPassengersDb();
          const trainsCol = racDb.collection(COLLECTIONS.TRAINS_DETAILS);
          const trains = await trainsCol.find({}, {
            projection: { Passengers_Collection_Name: 1, passengersCollection: 1 }
          }).toArray();

          const collectionNames = new Set();
          for (const t of trains) {
            const name = t.passengersCollection || t.Passengers_Collection_Name;
            if (name) collectionNames.add(name.trim());
          }

          for (const colName of collectionNames) {
            try {
              passenger = await passengersDb.collection(colName).findOne({ IRCTC_ID: irctcId });
              if (passenger) break;
            } catch (e) { /* skip */ }
          }
        } catch (e) {
          console.warn('Could not search passenger collections:', e.message);
        }
      }

      if (!passenger) {
        return res.status(404).json({
          success: false,
          message: "No booking found for this IRCTC ID"
        });
      }

      res.json({
        success: true,
        data: passenger
      });
    } catch (error) {
      console.error("❌ Error getting passenger by IRCTC ID:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Mark passenger as no-show (self-cancellation)
   */
  async markNoShow(req, res) {
    try {
      const { pnr } = req.body;

      if (!pnr) {
        return res.status(400).json({
          success: false,
          message: "PNR number is required",
        });
      }

      const passengersCollection = db.getPassengersCollection();
      const trainState = trainController.getGlobalTrainState();

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized",
        });
      }

      // Update MongoDB
      const result = await passengersCollection.updateOne(
        { PNR_Number: pnr },
        { $set: { NO_show: true } },
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "PNR not found",
        });
      }

      // Update in-memory state
      const passenger = trainState.findPassengerByPNR(pnr);
      if (passenger) {
        passenger.noShow = true;

        // Free up the berth
        const location = trainState.findPassenger(pnr);
        if (location) {
          location.berth.removePassenger(pnr);
          location.berth.updateStatus();
        }

        trainState.stats.totalNoShows++;
        trainState.updateStats();
      }

      // Broadcast update
      if (wsManager) {
        wsManager.broadcastTrainUpdate("NO_SHOW_MARKED", {
          pnr: pnr,
          stats: trainState.stats,
        });
      }

      res.json({
        success: true,
        message: "Passenger marked as no-show successfully",
        data: { pnr: pnr },
      });
    } catch (error) {
      console.error("❌ Error marking no-show:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get list of vacant berths with details
   */
  async getVacantBerths(req, res) {
    try {
      const trainState = global.trainState;

      if (!trainState) {
        return res.status(404).json({
          success: false,
          message: "Train not initialized",
        });
      }

      const vacantBerthsList = [];
      const stations = trainState.stations;

      // Loop through all coaches
      for (const coach of trainState.coaches) {
        // Loop through all berths in the coach
        for (const berth of coach.berths) {
          // Find vacant segments in this berth
          const vacantSegments = [];
          let segmentStart = null;

          for (let i = 0; i < berth.segments.length; i++) {
            if (berth.segments[i].status === "vacant") {
              if (segmentStart === null) {
                segmentStart = i;
              }

              // If this is the last segment or next segment is occupied
              if (
                i === berth.segments.length - 1 ||
                berth.segments[i + 1].status !== "vacant"
              ) {
                vacantSegments.push({
                  startIdx: segmentStart,
                  endIdx: i,
                  startStation: stations[segmentStart].code,
                  endStation: stations[i + 1].code,
                  startStationName: stations[segmentStart].name,
                  endStationName: stations[i + 1].name,
                });
                segmentStart = null;
              }
            }
          }

          // If this berth has vacant segments, add to list
          if (vacantSegments.length > 0) {
            vacantBerthsList.push({
              berthId: berth.berth_id,
              berthNo: berth.berth_no,
              coachName: coach.coach_name,
              berthType: berth.berth_type,
              vacantSegments: vacantSegments,
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          totalVacant: vacantBerthsList.length,
          vacantBerths: vacantBerthsList,
        },
      });
    } catch (error) {
      console.error("❌ Error getting vacant berths:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Add new passenger dynamically
   */
  async addPassenger(req, res) {
    try {
      const passengerData = req.body;

      // Validate required fields
      const required = [
        "irctc_id",
        "pnr",
        "name",
        "age",
        "gender",
        "from",
        "to",
        "class",
        "coach",
        "seat_no",
      ];
      for (const field of required) {
        if (!passengerData[field]) {
          return res.status(400).json({
            success: false,
            message: `Missing required field: ${field}`,
          });
        }
      }
      const trainState = trainController.getGlobalTrainState();
      if (!trainState) {
        return res
          .status(400)
          .json({ success: false, message: "Train not initialized" });
      }
      const passengersCollection = db.getPassengersCollection();
      // Find stations by code
      const fromStation = DataService.findStation(
        trainState.stations,
        passengerData.from,
      );
      const toStation = DataService.findStation(
        trainState.stations,
        passengerData.to,
      );
      if (!fromStation || !toStation) {
        return res.status(400).json({
          success: false,
          message: "Invalid boarding or deboarding station",
        });
      }
      if (fromStation.idx >= toStation.idx) {
        return res.status(400).json({
          success: false,
          message: "To station must be after From station",
        });
      }
      // Check if PNR already exists
      const existing = await passengersCollection.findOne({
        pnr: passengerData.pnr,
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "PNR already exists",
        });
      }
      // Find coach and berth
      const coach = trainState.coaches.find(
        (c) => c.coach_name === passengerData.coach,
      );
      if (!coach) {
        return res.status(400).json({
          success: false,
          message: "Invalid coach",
        });
      }
      const berth = coach.berths.find(
        (b) => b.berth_no === passengerData.seat_no,
      );
      if (!berth) {
        return res.status(400).json({
          success: false,
          message: "Invalid berth number",
        });
      }
      // Check if berth is available for this journey
      const isAvailable = this.checkBerthAvailability(
        berth,
        fromStation.idx,
        toStation.idx,
      );
      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          message: "Berth not available for selected journey",
        });
      }
      // Create new passenger document matching MongoDB schema
      const newPassenger = {
        IRCTC_ID: passengerData.irctc_id || `IR_${Date.now()}`,
        PNR_Number: passengerData.pnr,
        Train_Number: trainState.trainNo,
        Train_Name: passengerData.train_name || trainState.trainName || "Express",
        Journey_Date: passengerData.journey_date || trainState.journeyDate,
        Name: passengerData.name,
        Age: parseInt(passengerData.age),
        Gender: passengerData.gender,
        Mobile: passengerData.mobile || "",
        Email: passengerData.email || "",
        PNR_Status: passengerData.pnr_status || "CNF",
        Class: passengerData.class,
        Rac_status: passengerData.rac_status || "-",
        Boarding_Station: passengerData.from,
        Deboarding_Station: passengerData.to,
        Assigned_Coach: passengerData.coach,
        Assigned_berth: parseInt(passengerData.seat_no),
        Berth_Type: berth.berth_type,
        Passenger_Status: passengerData.passenger_status || "Offline",
        NO_show: false,
      };
      // Insert into MongoDB
      await passengersCollection.insertOne(newPassenger);

      // Update berth segmentOccupancy in trainState
      if (!berth.segmentOccupancy) {
        berth.segmentOccupancy = new Array(trainState.stations.length).fill(
          null,
        );
      }
      for (let i = fromStation.idx; i < toStation.idx; i++) {
        berth.segmentOccupancy[i] = newPassenger.PNR_Number;
      }

      // Also update legacy segments if they exist
      if (berth.segments) {
        for (let i = fromStation.idx; i < toStation.idx; i++) {
          berth.segments[i].status = "occupied";
          berth.segments[i].pnr = newPassenger.PNR_Number;
        }
      }

      // Update berth overall status
      berth.updateStatus();
      // Update statistics
      trainState.stats.totalPassengers++;
      // Check if passenger has RAC status (PNR_Status is "RAC")
      if (newPassenger.PNR_Status === "RAC") {
        // Add to RAC queue
        const racNumber = newPassenger.Rac_status
          ? parseInt(newPassenger.Rac_status)
          : 999;

        trainState.racQueue.push({
          pnr: newPassenger.PNR_Number,
          name: newPassenger.Name,
          age: newPassenger.Age,
          gender: newPassenger.Gender,
          racNumber: racNumber,
          class: newPassenger.Class,
          from: fromStation.code,
          fromIdx: fromStation.idx,
          to: toStation.code,
          toIdx: toStation.idx,
          pnrStatus: newPassenger.PNR_Status,
          racStatus: newPassenger.Rac_status
            ? `RAC ${newPassenger.Rac_status}`
            : "RAC",
          coach: newPassenger.Assigned_Coach,
          seatNo: newPassenger.Assigned_berth,
          berthType: newPassenger.Berth_Type,
        });

        // Sort RAC queue by RAC number
        trainState.racQueue.sort((a, b) => a.racNumber - b.racNumber);

        trainState.stats.racPassengers++;
      } else if (newPassenger.PNR_Status === "CNF") {
        trainState.stats.cnfPassengers++;
      }
      // Recalculate vacant berths
      trainState.stats.vacantBerths = this.countVacantBerths(trainState);

      // Broadcast update via WebSocket
      if (wsManager) {
        wsManager.broadcastTrainUpdate("PASSENGER_ADDED", {
          passenger: newPassenger,
          stats: trainState.stats,
        });
      }
      res.json({
        success: true,
        message: "Passenger added successfully",
        data: newPassenger,
      });
    } catch (error) {
      console.error("❌ Error getting passenger counts:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Helper method to check berth availability
  checkBerthAvailability(berth, fromIdx, toIdx) {
    const isRACBerth = berth.type === "Side Lower";
    const maxAllowed = isRACBerth ? 2 : 1;

    // Check segmentOccupancy first (modern approach with arrays)
    if (berth.segmentOccupancy && Array.isArray(berth.segmentOccupancy)) {
      for (let i = fromIdx; i < toIdx; i++) {
        const occupants = berth.segmentOccupancy[i] || [];
        if (occupants.length >= maxAllowed) {
          return false; // Segment is fully occupied
        }
      }
      return true;
    }

    return false; // No valid data structure found
  }

  // Helper method to count vacant berths at current station
  countVacantBerths(trainState) {
    let count = 0;
    const currentIdx = trainState.currentStationIdx;

    for (const coach of trainState.coaches) {
      for (const berth of coach.berths) {
        // Count vacant berths at CURRENT station using segment occupancy
        if (
          berth.segmentOccupancy &&
          berth.segmentOccupancy[currentIdx] === null
        ) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Get all passengers
   */
  getAllPassengers(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState();
      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized",
        });
      }

      const passengers = trainState.getAllPassengers();

      res.json({
        success: true,
        data: {
          total: passengers.length,
          passengers: passengers,
        },
      });
    } catch (error) {
      console.error("❌ Error adding passenger:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get passengers by status
   */
  getPassengersByStatus(req, res) {
    try {
      const { status } = req.params;
      const trainState = trainController.getGlobalTrainState();

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized",
        });
      }

      const allPassengers = trainState.getAllPassengers();
      let filtered = [];

      switch (status.toLowerCase()) {
        case "cnf":
          filtered = allPassengers.filter((p) => p.pnrStatus === "CNF");
          break;
        case "rac":
          filtered = allPassengers.filter((p) => p.pnrStatus.startsWith("RAC"));
          break;
        case "boarded":
          filtered = allPassengers.filter((p) => p.boarded);
          break;
        case "no-show":
          filtered = allPassengers.filter((p) => p.noShow);
          break;
        case "upcoming":
          filtered = allPassengers.filter(
            (p) => p.fromIdx > trainState.currentStationIdx && !p.noShow,
          );
          break;
        case "missed":
          filtered = allPassengers.filter(
            (p) =>
              p.fromIdx <= trainState.currentStationIdx &&
              !p.boarded &&
              !p.noShow,
          );
          break;
        default:
          return res.status(400).json({
            success: false,
            message: `Invalid status: ${status}`,
          });
      }

      res.json({
        success: true,
        data: {
          status: status,
          count: filtered.length,
          passengers: filtered,
        },
      });
    } catch (error) {
      console.error("❌ Error getting passengers by status:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get passenger counts by status
   */
  getPassengerCounts(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState();

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized",
        });
      }

      // Use getAllPassengers() which includes both berth passengers AND RAC queue
      const allPassengers = trainState.getAllPassengers();

      const counts = {
        total: allPassengers.length,
        cnf: allPassengers.filter((p) => p.pnrStatus === "CNF").length,
        rac: allPassengers.filter((p) => p.pnrStatus === "RAC").length,
        boarded: allPassengers.filter((p) => p.boarded && !p.noShow).length,
        noShow: allPassengers.filter((p) => p.noShow).length,
        online: allPassengers.filter((p) => p.passengerStatus && p.passengerStatus.toLowerCase() === 'online').length,
        offline: allPassengers.filter((p) => !p.passengerStatus || p.passengerStatus.toLowerCase() === 'offline').length,
      };

      res.json({
        success: true,
        data: counts,
      });
    } catch (error) {
      console.error("❌ Error getting passenger counts:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get pending upgrade notifications for a passenger
   */
  async getUpgradeNotifications(req, res) {
    try {
      const { pnr } = req.params;
      const UpgradeNotificationService = require("../services/UpgradeNotificationService");

      const notifications =
        await UpgradeNotificationService.getPendingNotifications(pnr);

      res.json({
        success: true,
        data: {
          pnr: pnr,
          count: notifications.length,
          notifications: notifications,
        },
      });
    } catch (error) {
      console.error("❌ Error getting upgrade notifications:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Accept an upgrade offer
   */
  async acceptUpgrade(req, res) {
    try {
      const { pnr, notificationId } = req.body;

      // Validation
      if (!pnr || !notificationId) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: pnr, notificationId",
        });
      }

      const trainState = trainController.getGlobalTrainState();

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized",
        });
      }

      // Call service for business logic
      const result = await PassengerService.acceptUpgrade(pnr, notificationId, trainState);

      // Note: Actual upgrade will be performed by TTE confirmation
      // This just marks the passenger's acceptance

      // Broadcast update via WebSocket
      if (wsManager) {
        wsManager.broadcastTrainUpdate("RAC_UPGRADE_ACCEPTED", {
          pnr: pnr,
          notification: result.notification,
          passenger: result.passenger
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error) {
      console.error("❌ Error accepting upgrade:", error);

      const statusCode = error.message.includes('not found') ? 404 :
        error.message.includes('expired') ? 400 :
          error.message.includes('already') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Deny an upgrade offer
   */
  async denyUpgrade(req, res) {
    try {
      const { pnr, notificationId, reason } = req.body;

      // Validation
      if (!pnr || !notificationId) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: pnr, notificationId",
        });
      }

      // Call service for business logic
      const result = await PassengerService.denyUpgrade(pnr, notificationId);

      // Broadcast update via WebSocket
      if (wsManager) {
        wsManager.broadcastTrainUpdate("RAC_UPGRADE_DENIED", {
          pnr: pnr,
          notification: result.notification,
          reason: reason || "Passenger declined"
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.notification,
      });
    } catch (error) {
      console.error("❌ Error denying upgrade:", error);

      const statusCode = error.message.includes('not found') ? 404 :
        error.message.includes('already') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Set passenger online/offline status
   * Used to mark passengers as available for reallocation
   */
  async setPassengerStatus(req, res) {
    try {
      const { pnr, status } = req.body;

      if (!pnr || !status) {
        return res.status(400).json({
          success: false,
          message: "PNR and status are required"
        });
      }

      if (status !== 'online' && status !== 'offline') {
        return res.status(400).json({
          success: false,
          message: "Status must be 'online' or 'offline'"
        });
      }

      const trainState = trainController.getGlobalTrainState();
      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      // Find passenger in train state
      const passengerLocation = trainState.findPassenger(pnr);
      if (!passengerLocation) {
        return res.status(404).json({
          success: false,
          message: "Passenger not found"
        });
      }

      const passenger = passengerLocation.passenger;
      const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);

      // Update in-memory state
      passenger.passengerStatus = capitalizedStatus;

      // Update MongoDB
      try {
        const passengersCollection = db.getPassengersCollection();
        await passengersCollection.updateOne(
          { PNR_Number: pnr },
          { $set: { Passenger_Status: capitalizedStatus } }
        );
        console.log(`✅ Updated passenger status in MongoDB: ${pnr} -> ${capitalizedStatus}`);
      } catch (dbError) {
        console.error(`⚠️  Failed to update MongoDB:`, dbError.message);
      }

      // Update RAC queue if this is a RAC passenger
      const racPassenger = trainState.racQueue.find(r => r.pnr === pnr);
      if (racPassenger) {
        racPassenger.passengerStatus = capitalizedStatus;
      }

      console.log(`🔄 Passenger ${pnr} status updated: ${capitalizedStatus}`);

      res.json({
        success: true,
        message: `Passenger status updated to ${capitalizedStatus}`,
        data: {
          pnr: pnr,
          name: passenger.name,
          status: capitalizedStatus,
          pnrStatus: passenger.pnrStatus
        }
      });
    } catch (error) {
      console.error("❌ Error setting passenger status:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Self-revert NO-SHOW status (passenger initiated)
   * POST /api/passenger/revert-no-show
   * Body: { pnr: "PNR_NUMBER" }
   * Headers: Authorization Bearer token (authenticated passenger)
   */
  async selfRevertNoShow(req, res) {
    try {
      const { pnr } = req.body;

      if (!pnr) {
        return res.status(400).json({
          success: false,
          message: 'PNR is required'
        });
      }

      // Optional: Verify that the authenticated user owns this PNR
      // if (req.user && req.user.pnr !== pnr) {
      //   return res.status(403).json({
      //     success: false,
      //     message: 'You can only revert your own PNR'
      //   });
      // }

      const trainState = trainController.getGlobalTrainState();

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: 'Train not initialized'
        });
      }

      // Use the same revert method from TrainState
      const result = await trainState.revertBoardedPassengerNoShow(pnr);

      res.json({
        success: true,
        message: `NO-SHOW status reverted successfully for passenger ${pnr}`,
        pnr: result.pnr,
        passenger: result.passenger
      });
    } catch (error) {
      console.error('❌ Error self-reverting no-show:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('not marked as NO-SHOW')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('Cannot revert')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Get in-app notifications for passenger
   * GET /api/passenger/notifications
   */
  getInAppNotifications(req, res) {
    try {
      // Get IRCTC ID from authenticated user or query
      const irctcId = req.user?.irctcId || req.query.irctcId;

      if (!irctcId) {
        return res.status(400).json({
          success: false,
          message: 'IRCTC ID is required'
        });
      }

      const InAppNotificationService = require('../services/InAppNotificationService');
      const notifications = InAppNotificationService.getNotifications(irctcId);
      const stats = InAppNotificationService.getStats(irctcId);

      res.json({
        success: true,
        data: {
          notifications,
          stats
        }
      });
    } catch (error) {
      console.error('❌ Error getting notifications:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get unread notification count
   * GET /api/passenger/notifications/unread-count
   */
  getUnreadCount(req, res) {
    try {
      const irctcId = req.user?.irctcId || req.query.irctcId;

      if (!irctcId) {
        return res.status(400).json({
          success: false,
          message: 'IRCTC ID is required'
        });
      }

      const InAppNotificationService = require('../services/InAppNotificationService');
      const count = InAppNotificationService.getUnreadCount(irctcId);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Mark notification as read
   * POST /api/passenger/notifications/:id/read
   */
  markNotificationRead(req, res) {
    try {
      const { id } = req.params;
      const irctcId = req.user?.irctcId || req.body.irctcId;

      if (!irctcId) {
        return res.status(400).json({
          success: false,
          message: 'IRCTC ID is required'
        });
      }

      const InAppNotificationService = require('../services/InAppNotificationService');
      const notification = InAppNotificationService.markAsRead(irctcId, id);

      res.json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Mark all notifications as read
   * POST /api/passenger/notifications/mark-all-read
   */
  markAllNotificationsRead(req, res) {
    try {
      const irctcId = req.user?.irctcId || req.body.irctcId;

      if (!irctcId) {
        return res.status(400).json({
          success: false,
          message: 'IRCTC ID is required'
        });
      }

      const InAppNotificationService = require('../services/InAppNotificationService');
      const count = InAppNotificationService.markAllAsRead(irctcId);

      res.json({
        success: true,
        message: `Marked ${count} notifications as read`,
        data: { count }
      });
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Subscribe to push notifications
   * POST /api/passenger/push-subscribe
   */
  async subscribeToPush(req, res) {
    try {
      const { irctcId, subscription } = req.body;

      console.log('🔔 Push subscribe request received:', { irctcId: irctcId ? '✓' : '✗', subscription: subscription ? '✓' : '✗' });

      if (!irctcId || !subscription) {
        console.error('❌ Missing required fields:', { irctcId, hasSubscription: !!subscription });
        return res.status(400).json({
          success: false,
          message: 'IRCTC ID and subscription are required',
          received: { irctcId: !!irctcId, subscription: !!subscription }
        });
      }

      const PushSubscriptionService = require('../services/PushSubscriptionService');
      await PushSubscriptionService.addSubscription(irctcId, subscription, req.headers['user-agent']);

      console.log(`✅ Passenger ${irctcId} subscribed to push notifications`);
      res.json({
        success: true,
        message: 'Subscribed to push notifications (stored in MongoDB)',
        irctcId
      });
    } catch (error) {
      console.error('❌ Error subscribing to push:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.toString()
      });
    }
  }

  /**
   * Unsubscribe from push notifications
   * POST /api/passenger/push-unsubscribe
   */
  async unsubscribeFromPush(req, res) {
    try {
      const { irctcId, endpoint } = req.body;

      if (!irctcId || !endpoint) {
        return res.status(400).json({
          success: false,
          message: 'IRCTC ID and endpoint are required'
        });
      }

      const PushSubscriptionService = require('../services/PushSubscriptionService');
      const removed = await PushSubscriptionService.removeSubscription(irctcId, endpoint);

      res.json({
        success: removed,
        message: removed ? 'Unsubscribed successfully' : 'Subscription not found'
      });
    } catch (error) {
      console.error('❌ Error unsubscribing from push:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get VAPID public key for push subscription
   * GET /api/passenger/vapid-public-key
   */
  getVapidPublicKey(req, res) {
    try {
      const WebPushService = require('../services/WebPushService');
      const publicKey = WebPushService.getVapidPublicKey();

      res.json({
        success: true,
        publicKey
      });
    } catch (error) {
      console.error('❌ Error getting VAPID key:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get available boarding stations for change (next 3 forward stations)
   * GET /api/passenger/available-boarding-stations/:pnr
   */
  async getAvailableBoardingStations(req, res) {
    try {
      const { pnr } = req.params;

      if (!pnr) {
        return res.status(400).json({
          success: false,
          message: 'PNR number is required'
        });
      }

      // Get passenger from database first
      let passenger = await db.getPassengersCollection().findOne({
        $or: [
          { PNR_Number: pnr },
          { pnr: pnr }
        ]
      });

      // Fallback: Try in-memory state if DB lookup fails
      if (!passenger) {
        const trainState = trainController.getGlobalTrainState();
        if (trainState) {
          const memPassenger = trainState.findPassengerByPNR(pnr);
          if (memPassenger) {
            // Create a pseudo-passenger object from in-memory data
            passenger = {
              PNR_Number: memPassenger.pnr || pnr,
              From: memPassenger.from,
              To: memPassenger.to,
              Boarding_Station: memPassenger.from,
              Deboarding_Station: memPassenger.to,
              boardingStationChanged: memPassenger.boardingStationChanged || false
            };
          }
        }
      }

      if (!passenger) {
        return res.status(404).json({
          success: false,
          message: 'Passenger not found'
        });
      }

      // Check if already changed
      if (passenger.boardingStationChanged) {
        return res.json({
          success: true,
          alreadyChanged: true,
          message: 'Boarding station has already been changed once',
          currentStation: passenger.Boarding_Station
        });
      }

      // Get train state to access route
      const trainState = trainController.getGlobalTrainState();
      if (!trainState || !trainState.stations || trainState.stations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Train journey not initialized'
        });
      }

      const stations = trainState.stations;

      // Find current boarding station index
      // Try to use From code first, fallback to matching Boarding_Station name
      let currentFromCode = passenger.From;
      let currentStationIdx = -1;

      if (currentFromCode) {
        currentStationIdx = stations.findIndex(s => s.code === currentFromCode);
      }

      // If not found by code, try matching by full station name
      if (currentStationIdx === -1 && passenger.Boarding_Station) {
        currentStationIdx = stations.findIndex(s =>
          s.name.toLowerCase() === passenger.Boarding_Station.toLowerCase() ||
          s.name.toLowerCase().includes(passenger.Boarding_Station.toLowerCase()) ||
          passenger.Boarding_Station.toLowerCase().includes(s.name.toLowerCase())
        );
      }

      if (currentStationIdx === -1) {
        console.error('Station lookup failed:', {
          From: passenger.From,
          Boarding_Station: passenger.Boarding_Station,
          availableStations: stations.map(s => ({ code: s.code, name: s.name }))
        });
        return res.status(400).json({
          success: false,
          message: 'Current boarding station not found in route'
        });
      }

      // Get next 3 forward stations (excluding current and deboarding station)
      let toCode = passenger.To;
      let toIdx = -1;

      if (toCode) {
        toIdx = stations.findIndex(s => s.code === toCode);
      }

      // If not found by code, try matching by deboarding station name
      if (toIdx === -1 && passenger.Deboarding_Station) {
        toIdx = stations.findIndex(s =>
          s.name.toLowerCase() === passenger.Deboarding_Station.toLowerCase() ||
          s.name.toLowerCase().includes(passenger.Deboarding_Station.toLowerCase()) ||
          passenger.Deboarding_Station.toLowerCase().includes(s.name.toLowerCase())
        );
      }

      // Default to last station if not found
      if (toIdx === -1) {
        toIdx = stations.length;
      }

      const availableStations = [];
      for (let i = currentStationIdx + 1; i < Math.min(currentStationIdx + 4, toIdx); i++) {
        if (i < stations.length) {
          availableStations.push({
            code: stations[i].code,
            name: stations[i].name,
            arrivalTime: stations[i].arrival
          });
        }
      }

      res.json({
        success: true,
        alreadyChanged: false,
        currentStation: {
          code: currentFromCode,
          name: passenger.Boarding_Station
        },
        availableStations,
        deboardingStation: {
          code: toCode,
          name: passenger.Deboarding_Station
        }
      });

    } catch (error) {
      console.error('❌ Error getting available boarding stations:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Change boarding station for passenger
   * POST /api/passenger/change-boarding-station
   * Body: { pnr, irctcId, newStationCode }
   */
  async changeBoardingStation(req, res) {
    try {
      const { pnr, irctcId, newStationCode } = req.body;

      if (!pnr || !irctcId || !newStationCode) {
        return res.status(400).json({
          success: false,
          message: 'PNR, IRCTC ID, and new station code are required'
        });
      }

      // Get passenger from database - try both PNR field names
      const passenger = await db.getPassengersCollection().findOne({
        $or: [
          { PNR_Number: pnr, IRCTC_ID: irctcId },
          { pnr: pnr, IRCTC_ID: irctcId }
        ]
      });

      if (!passenger) {
        return res.status(404).json({
          success: false,
          message: 'Passenger not found or IRCTC ID does not match'
        });
      }

      // Check if already changed
      if (passenger.boardingStationChanged) {
        return res.status(400).json({
          success: false,
          message: 'Boarding station can only be changed once. Already changed previously.'
        });
      }

      // Get train state to validate new station
      const trainState = trainController.getGlobalTrainState();
      if (!trainState || !trainState.stations || trainState.stations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Train journey not initialized'
        });
      }

      const stations = trainState.stations;
      const currentFromCode = passenger.From;
      const currentStationIdx = stations.findIndex(s => s.code === currentFromCode);
      const newStationIdx = stations.findIndex(s => s.code === newStationCode);
      const toIdx = stations.findIndex(s => s.code === passenger.To);

      // Validate: new station must be after current and before destination
      if (newStationIdx === -1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid station code'
        });
      }

      if (newStationIdx <= currentStationIdx) {
        return res.status(400).json({
          success: false,
          message: 'Can only change to forward stations'
        });
      }

      if (newStationIdx >= toIdx) {
        return res.status(400).json({
          success: false,
          message: 'New boarding station must be before deboarding station'
        });
      }

      // Check if within next 3 stations
      if (newStationIdx > currentStationIdx + 3) {
        return res.status(400).json({
          success: false,
          message: 'Can only change to one of the next 3 stations'
        });
      }

      const newStation = stations[newStationIdx];

      // Update database
      const result = await db.getPassengersCollection().updateOne(
        { PNR_Number: pnr, IRCTC_ID: irctcId },
        {
          $set: {
            Boarding_Station: newStation.name,
            From: newStation.code,
            boardingStationChanged: true,
            boardingStationChangedAt: new Date(),
            previousBoardingStation: passenger.Boarding_Station,
            previousFrom: passenger.From
          }
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update boarding station'
        });
      }

      // Also update in-memory trainState if passenger exists there
      if (trainState.passengers) {
        const memPassenger = trainState.passengers.find(p => p.pnr === pnr);
        if (memPassenger) {
          memPassenger.from = newStation.code;
          memPassenger.fromIdx = newStationIdx;
        }
      }

      console.log(`✅ Boarding station changed for ${pnr}: ${passenger.Boarding_Station} → ${newStation.name}`);

      res.json({
        success: true,
        message: 'Boarding station changed successfully',
        newStation: {
          code: newStation.code,
          name: newStation.name
        },
        previousStation: {
          code: passenger.From,
          name: passenger.Boarding_Station
        }
      });

    } catch (error) {
      console.error('❌ Error changing boarding station:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Self-cancel ticket (passenger marks themselves as NO-SHOW)
   * POST /api/passenger/self-cancel
   * Body: { pnr, irctcId }
   */
  async selfCancelTicket(req, res) {
    try {
      const { pnr, irctcId } = req.body;

      if (!pnr || !irctcId) {
        return res.status(400).json({
          success: false,
          message: 'PNR and IRCTC ID are required'
        });
      }

      // Get passenger from database and verify IRCTC ID - try both PNR field names
      const passenger = await db.getPassengersCollection().findOne({
        $or: [
          { PNR_Number: pnr, IRCTC_ID: irctcId },
          { pnr: pnr, IRCTC_ID: irctcId }
        ]
      });

      if (!passenger) {
        return res.status(404).json({
          success: false,
          message: 'Passenger not found or IRCTC ID does not match'
        });
      }

      // Check if already cancelled/no-show
      if (passenger.NO_show) {
        return res.status(400).json({
          success: false,
          message: 'Ticket is already cancelled'
        });
      }

      // Update database - set NO_show to true
      const result = await db.getPassengersCollection().updateOne(
        { PNR_Number: pnr, IRCTC_ID: irctcId },
        {
          $set: {
            NO_show: true,
            NO_show_timestamp: new Date(),
            selfCancelled: true,
            selfCancelledAt: new Date()
          }
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(500).json({
          success: false,
          message: 'Failed to cancel ticket'
        });
      }

      // Update in-memory state if train is initialized
      const trainState = trainController.getGlobalTrainState();
      if (trainState) {
        const memPassenger = trainState.findPassengerByPNR(pnr);
        if (memPassenger) {
          memPassenger.noShow = true;

          // Free up the berth
          const location = trainState.findPassenger(pnr);
          if (location) {
            location.berth.removePassenger(pnr);
            location.berth.updateStatus();
          }
        }
      }

      console.log(`✅ Ticket self-cancelled for PNR: ${pnr}`);

      res.json({
        success: true,
        message: 'Ticket cancelled successfully. Your berth will be made available for other passengers.',
        pnr: pnr
      });

    } catch (error) {
      console.error('❌ Error self-cancelling ticket:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * ✅ DUAL-APPROVAL: Get pending upgrade offers for a passenger
   * GET /api/passenger/pending-upgrades/:irctcId
   */
  async getPendingUpgrades(req, res) {
    try {
      const { irctcId } = req.params;

      if (!irctcId) {
        return res.status(400).json({
          success: false,
          message: 'IRCTC ID is required'
        });
      }

      // Query pending reallocations from MongoDB
      const stationReallocationCollection = db.getStationReallocationCollection();
      const pendingUpgrades = await stationReallocationCollection.find({
        passengerIrctcId: irctcId,
        status: 'pending',
        approvalTarget: 'BOTH'  // Only show offers that allow passenger self-approval
      }).toArray();

      console.log(`📋 Found ${pendingUpgrades.length} pending upgrades for ${irctcId}`);

      res.json({
        success: true,
        data: {
          count: pendingUpgrades.length,
          upgrades: pendingUpgrades.map(u => ({
            id: u._id.toString(),
            pnr: u.passengerPNR,
            passengerName: u.passengerName,
            currentBerth: u.currentBerth,
            proposedCoach: u.proposedCoach,
            proposedBerth: u.proposedBerth,
            proposedBerthFull: u.proposedBerthFull,
            proposedBerthType: u.proposedBerthType,
            stationName: u.stationName,
            createdAt: u.createdAt
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error getting pending upgrades:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * ✅ DUAL-APPROVAL: Passenger approves their own RAC upgrade
   * POST /api/passenger/approve-upgrade
   * Body: { upgradeId, irctcId }
   */
  async approveUpgrade(req, res) {
    try {
      const { upgradeId, irctcId } = req.body;

      if (!upgradeId || !irctcId) {
        return res.status(400).json({
          success: false,
          message: 'Upgrade ID and IRCTC ID are required'
        });
      }

      const { ObjectId } = require('mongodb');
      const StationWiseApprovalService = require('../services/StationWiseApprovalService');
      const stationReallocationCollection = db.getStationReallocationCollection();

      // Find the pending reallocation
      const pending = await stationReallocationCollection.findOne({
        _id: new ObjectId(upgradeId),
        passengerIrctcId: irctcId,
        status: 'pending'
      });

      if (!pending) {
        return res.status(404).json({
          success: false,
          message: 'Upgrade offer not found or already processed'
        });
      }

      // Verify passenger owns this upgrade
      if (pending.passengerIrctcId !== irctcId) {
        return res.status(403).json({
          success: false,
          message: 'You can only approve your own upgrade offers'
        });
      }

      // Use existing approval service (same logic as TTE approval)
      const trainState = trainController.getGlobalTrainState();
      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: 'Train not initialized'
        });
      }

      // Perform the actual upgrade using existing service
      // Note: approveBatch expects (ids, tteId, trainState) - pass trainState, not trainNo
      const result = await StationWiseApprovalService.approveBatch([upgradeId], 'PASSENGER_SELF', trainState);

      if (result.totalApproved > 0) {
        // Mark as approved by PASSENGER
        await stationReallocationCollection.updateOne(
          { _id: new ObjectId(upgradeId) },
          { $set: { approvedBy: 'PASSENGER', approvedAt: new Date() } }
        );

        // Broadcast to TTE portal to remove this from their list
        if (wsManager) {
          wsManager.broadcastTrainUpdate('UPGRADE_APPROVED_BY_PASSENGER', {
            upgradeId: upgradeId,
            pnr: pending.passengerPNR,
            passengerName: pending.passengerName,
            proposedBerth: pending.proposedBerthFull
          });
        }

        console.log(`✅ PASSENGER ${irctcId} approved their own upgrade: ${pending.passengerPNR} → ${pending.proposedBerthFull}`);

        res.json({
          success: true,
          message: 'Upgrade approved successfully!',
          data: {
            pnr: pending.passengerPNR,
            newBerth: pending.proposedBerthFull,
            coach: pending.proposedCoach
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.errors?.[0] || 'Failed to approve upgrade'
        });
      }
    } catch (error) {
      console.error('❌ Error in passenger approveUpgrade:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new PassengerController();

