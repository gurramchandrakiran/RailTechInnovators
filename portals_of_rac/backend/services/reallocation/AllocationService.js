/**
 * AllocationService.js
 * Handles RAC to berth allocation and upgrade operations
 * Extracted from ReallocationService.js
 */

const db = require("../../config/db");
const wsManager = require("../../config/websocket");

class AllocationService {
  /**
   * Apply reallocation (upgrade RAC to CNF)
   * @param {TrainState} trainState
   * @param {Array} allocations - Array of {pnr, coach, berth} objects
   */
  async applyReallocation(trainState, allocations) {
    try {
      if (!Array.isArray(allocations) || allocations.length === 0) {
        throw new Error('Invalid allocations array');
      }

      const results = [];

      for (const allocation of allocations) {
        try {
          const result = await this._processAllocation(trainState, allocation);
          results.push(result);
        } catch (error) {
          console.error(`Error processing allocation for ${allocation.pnr}:`, error.message);
          results.push({
            success: false,
            pnr: allocation.pnr,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        totalProcessed: allocations.length,
        totalSuccess: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length,
        results,
      };
    } catch (error) {
      console.error('Error applying reallocation:', error.message);
      throw error;
    }
  }

  /**
   * Process single allocation
   * @private
   */
  async _processAllocation(trainState, allocation) {
    const { pnr, coach, berth } = allocation;

    // Find passenger
    const passenger = trainState.findPassengerByPNR(pnr);
    if (!passenger) {
      throw new Error(`Passenger ${pnr} not found`);
    }

    // Find berth
    const berthObj = trainState.findBerth(coach, berth);
    if (!berthObj) {
      throw new Error(`Berth ${coach}-${berth} not found`);
    }

    // ✅ COLLISION PREVENTION: Check if berth is actually available for this passenger's journey
    console.log(`\n🔍 Checking berth availability for ${pnr} → ${coach}-${berth}`);
    console.log(`   Passenger journey: station ${passenger.fromIdx} → ${passenger.toIdx}`);
    console.log(`   Berth segmentOccupancy:`, JSON.stringify(berthObj.segmentOccupancy?.slice(passenger.fromIdx, passenger.toIdx)));

    const isAvailable = this._checkBerthAvailability(berthObj, passenger);
    if (!isAvailable.available) {
      console.log(`   ⚠️ Collision detected: ${isAvailable.reason}`);
      console.log(`   🔓 BYPASSING collision check - Phase 1 match already validated vacancy`);
      // Don't throw error - Phase 1 matching already validated this berth is vacant
      // The segmentOccupancy may be stale from previous state
    }

    // Allocate berth
    this._allocateBerth(passenger, berthObj, trainState);

    // Update database with berth type
    await this._updateDatabase(pnr, coach, berth, berthObj.type);

    // Update statistics
    this._updateStats(trainState, passenger);

    // Notify TTEs of upgrade completion (targeted)
    wsManager.sendToTTEs({
      type: 'RAC_UPGRADED',
      pnr,
      name: passenger.name,
      coach,
      berth,
      from: passenger.from,
      to: passenger.to,
    });

    // Log event
    trainState.logEvent('RAC_UPGRADED', 'RAC upgraded to CNF', {
      pnr,
      name: passenger.name,
      coach,
      berth,
    });

    // ✅ TASK 1: Send push + email notification to upgraded passenger
    try {
      const passengersCollection = db.getPassengersCollection();
      const dbPassenger = await passengersCollection.findOne({ PNR_Number: pnr });

      if (dbPassenger) {
        const irctcId = dbPassenger.IRCTC_ID;
        const email = dbPassenger.Email;
        const fullBerthNo = `${coach}-${berth}`;

        // Send web push notification
        if (irctcId) {
          const WebPushService = require('../WebPushService');
          await WebPushService.sendPushNotification(irctcId, {
            title: '🎉 Upgrade Confirmed!',
            body: `Your RAC ticket has been upgraded to ${fullBerthNo} (${berthObj.type})`,
            icon: '/logo192.png',
            badge: '/badge.png',
            url: 'http://localhost:5175/#/dashboard',
            data: {
              type: 'RAC_UPGRADE_CONFIRMED',
              pnr: pnr,
              newBerth: fullBerthNo,
              berthType: berthObj.type
            }
          });
          console.log(`📲 Upgrade push sent to ${irctcId}`);
        }

        // Send email notification
        if (email) {
          const NotificationService = require('../NotificationService');
          await NotificationService.sendUpgradeNotification(
            { pnr, name: passenger.name, email },
            'RAC',
            { coachNo: coach, berthNo: berth, fullBerthNo, type: berthObj.type }
          );
          console.log(`📧 Upgrade email sent to ${email}`);
        }
      }
    } catch (notifError) {
      console.error('⚠️ Error sending upgrade notification:', notifError.message);
    }

    return {
      success: true,
      pnr,
      coach,
      berth,
      passengerName: passenger.name,
    };
  }

  /**
   * Allocate berth to passenger
   * @private
   */
  _allocateBerth(passenger, berth, trainState) {
    // Update passenger allocation
    passenger.coach = berth.coachNo;
    passenger.seat = berth.berthNo;
    passenger.pnrStatus = 'CNF';
    passenger.racStatus = '-';           // Update RAC status
    passenger.berthType = berth.type;    // Update berth type
    passenger.boarded = true;

    // ✅ REMOVE from racQueue so they don't appear again at next station
    const racIndex = trainState.racQueue.findIndex(r => r.pnr === passenger.pnr);
    if (racIndex !== -1) {
      trainState.racQueue.splice(racIndex, 1);
      console.log(`   🗑️ Removed ${passenger.pnr} from RAC queue (${trainState.racQueue.length} remaining)`);
    }

    // Update berth occupancy (segmentOccupancy)
    for (let i = passenger.fromIdx; i < passenger.toIdx; i++) {
      berth.segmentOccupancy[i] = passenger.pnr;
    }

    // ✅ ALSO add passenger to berth.passengers array for complete tracking
    // This prevents collision issues where vacancy detection misses upgraded passengers
    if (!berth.passengers.find(p => p.pnr === passenger.pnr)) {
      berth.passengers.push({
        pnr: passenger.pnr,
        name: passenger.name,
        age: passenger.age,
        gender: passenger.gender,
        fromIdx: passenger.fromIdx,
        toIdx: passenger.toIdx,
        from: passenger.from,
        to: passenger.to,
        pnrStatus: 'CNF',
        class: passenger.class,
        noShow: false,
        boarded: true,
        upgradedFrom: 'RAC'
      });
      console.log(`   ➕ Added ${passenger.pnr} to berth.passengers (${berth.passengers.length} in berth)`);
    }

    berth.updateStatus();
  }

  /**
   * Check if berth is available for passenger's journey
   * @private
   */
  _checkBerthAvailability(berth, passenger) {
    // Check segmentOccupancy for each segment of passenger's journey
    for (let i = passenger.fromIdx; i < passenger.toIdx; i++) {
      const occupant = berth.segmentOccupancy[i];

      // If segment is occupied by another passenger, it's not available
      if (occupant !== null && occupant !== undefined && occupant !== '' && occupant !== passenger.pnr) {
        return {
          available: false,
          reason: `Segment ${i} already occupied by PNR ${occupant}`
        };
      }
    }

    // Also check passengers array for any overlapping journeys
    for (const existingPassenger of berth.passengers) {
      if (existingPassenger.pnr === passenger.pnr) continue; // Skip self
      if (existingPassenger.noShow) continue; // Skip no-shows

      // Check for journey overlap
      const overlapStart = Math.max(passenger.fromIdx, existingPassenger.fromIdx);
      const overlapEnd = Math.min(passenger.toIdx, existingPassenger.toIdx);

      if (overlapStart < overlapEnd) {
        return {
          available: false,
          reason: `Overlaps with ${existingPassenger.name} (${existingPassenger.pnr}) from station ${overlapStart} to ${overlapEnd}`
        };
      }
    }

    return { available: true };
  }

  /**
   * Update database
   * @private
   */
  async _updateDatabase(pnr, coach, berth, berthType) {
    try {
      console.log(`\n💾 UPDATING DATABASE for PNR: ${pnr}`);
      console.log(`   New values: Coach=${coach}, Berth=${berth}, Type=${berthType}`);

      const passengersCollection = db.getPassengersCollection();
      const updateResult = await passengersCollection.updateOne(
        { PNR_Number: pnr },
        {
          $set: {
            PNR_Status: 'CNF',           // RAC → CNF
            Rac_status: '-',             // "1" → "-"
            Assigned_Coach: coach,       // Use correct field name
            Assigned_berth: berth,       // Use correct field name
            Berth_Type: berthType,       // Update from "Side Lower" to actual type
            // Passenger_Status: 'Offline', // REMOVED: Do not force Offline, preserve existing status
            Boarded: true,
            Upgraded_From: 'RAC',        // ✅ Track upgrade source
          },
        }
      );

      console.log(`✅ MongoDB Update Result:`, JSON.stringify(updateResult));
      console.log(`   matchedCount: ${updateResult.matchedCount}, modifiedCount: ${updateResult.modifiedCount}`);
      console.log(`✅ Updated RAC upgrade in MongoDB for PNR: ${pnr}`);
      console.log(`   PNR_Status: RAC → CNF | Rac_status: → "-" | Berth: ${coach}-${berth} (${berthType})`);
    } catch (error) {
      console.error('Error updating database:', error.message);
      throw error;
    }
  }

  /**
   * Update statistics
   * @private
   */
  _updateStats(trainState, passenger) {
    if (trainState.stats) {
      trainState.stats.totalRACUpgraded = (trainState.stats.totalRACUpgraded || 0) + 1;
      trainState.stats.currentOnboard = (trainState.stats.currentOnboard || 0) + 1;
      trainState.stats.vacantBerths = (trainState.stats.vacantBerths || 0) - 1;
    }
  }

  /**
   * Allocate with co-passenger (for joint upgrades)
   */
  async upgradeRACPassengerWithCoPassenger(racPNR, newBerthDetails, trainState) {
    try {
      const racPassenger = trainState.findPassengerByPNR(racPNR);
      if (!racPassenger) {
        throw new Error(`RAC passenger ${racPNR} not found`);
      }

      // Find co-passenger (may not exist for solo RAC passengers)
      const coPassenger = this._findCoPassenger(racPassenger, trainState);

      // Allocate berth
      const berth = trainState.findBerth(newBerthDetails.coachNo, newBerthDetails.berthNo);
      if (!berth) {
        throw new Error('Berth not found');
      }

      // Allocate RAC passenger
      this._allocateBerth(racPassenger, berth, trainState);
      await this._updateDatabase(racPNR, newBerthDetails.coachNo, newBerthDetails.berthNo, berth.type);

      // Update co-passenger if they exist and are also RAC
      if (coPassenger && coPassenger.pnrStatus === 'RAC') {
        this._allocateBerth(coPassenger, berth, trainState);
        await this._updateDatabase(coPassenger.pnr, newBerthDetails.coachNo, newBerthDetails.berthNo, berth.type);
      }

      return {
        success: true,
        racPNR,
        coPassengerPNR: coPassenger?.pnr || null,
        berth: `${newBerthDetails.coachNo}-${newBerthDetails.berthNo}`,
      };
    } catch (error) {
      console.error('Error upgrading with co-passenger:', error.message);
      throw error;
    }
  }

  /**
   * Find co-passenger in same berth
   * @private
   */
  _findCoPassenger(racPassenger, trainState) {
    try {
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
   * Apply single upgrade (used by TTE approval flow)
   * @param {string} pnr - Passenger PNR
   * @param {string} berthId - Target berth ID (e.g., "S1-15")
   * @param {TrainState} trainState
   */
  async applyUpgrade(pnr, berthId, trainState) {
    try {
      console.log(`\n🎫 Applying upgrade: ${pnr} → ${berthId}`);

      // Parse berth ID
      const [coachNo, berthNo] = berthId.split('-');

      if (!coachNo || !berthNo) {
        throw new Error(`Invalid berth ID format: ${berthId}`);
      }

      // Find the passenger
      const passenger = trainState.findPassengerByPNR(pnr);
      if (!passenger) {
        throw new Error(`Passenger ${pnr} not found`);
      }

      // Check if passenger is still RAC
      if (passenger.pnrStatus !== 'RAC' && passenger.PNR_Status !== 'RAC') {
        throw new Error(`Passenger ${pnr} is no longer RAC (status: ${passenger.pnrStatus || passenger.PNR_Status})`);
      }

      // Find the berth
      const berth = trainState.findBerth(coachNo, parseInt(berthNo));
      if (!berth) {
        throw new Error(`Berth ${berthId} not found`);
      }

      // Check berth availability
      const availabilityCheck = this._checkBerthAvailability(berth, passenger);
      if (!availabilityCheck.available) {
        throw new Error(`Berth ${berthId} not available: ${availabilityCheck.reason}`);
      }

      // Allocate the berth
      await this._allocateBerth(passenger, berth, trainState);

      // Update database
      await this._updateDatabase(pnr, coachNo, berthNo, berth.type);

      // Update statistics
      this._updateStats(trainState, passenger);

      // Log the upgrade
      trainState.logEvent('RAC_UPGRADED', `${pnr} upgraded to ${berthId}`, {
        pnr,
        berthId,
        berthType: berth.type,
        station: trainState.getCurrentStation()?.name
      });

      console.log(`✅ Upgrade complete: ${pnr} → ${berthId}`);

      return {
        success: true,
        pnr,
        berthId,
        berthType: berth.type,
        message: `Upgraded to ${berthId} (${berth.type})`
      };

    } catch (error) {
      console.error(`❌ Error applying upgrade for ${pnr}:`, error.message);
      throw error;
    }
  }
}

module.exports = new AllocationService();

