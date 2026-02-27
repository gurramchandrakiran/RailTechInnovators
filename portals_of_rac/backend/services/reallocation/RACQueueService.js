/**
 * RACQueueService.js
 * Handles RAC queue operations and filtering
 * Extracted from ReallocationService.js
 */

const CONSTANTS = require("../../constants/reallocationConstants");

class RACQueueService {
  /**
   * Get RAC queue from train state
   * Includes detailed information about each RAC passenger
   */
  getRACQueue(trainState) {
    try {
      const racQueue = trainState.racQueue || [];

      return racQueue.map(rac => ({
        pnr: rac.pnr,
        name: rac.name,
        pnrStatus: rac.pnrStatus,
        racStatus: rac.racStatus,
        passengerStatus: rac.passengerStatus,
        boarded: rac.boarded,
        from: rac.from,
        to: rac.to,
        fromIdx: rac.fromIdx,
        toIdx: rac.toIdx,
        class: rac.class,
        coach: rac.coach,
        seat: rac.seat,
        noShow: rac.noShow,
        coPassenger: rac.coPassenger,
        vacancyIdLastOffered: rac.vacancyIdLastOffered,
        offerStatus: rac.offerStatus,
      }));
    } catch (error) {
      console.error('Error getting RAC queue:', error.message);
      return [];
    }
  }

  /**
   * Get only boarded, online RAC passengers (eligible for realtime offers)
   * Applies 3-way filter: RAC + Boarded + Online
   */
  getBoardedOnlineRAC(trainState) {
    try {
      const allPassengers = trainState.getAllPassengers();

      return allPassengers.filter(p => {
        // Must be RAC
        const isRAC = p.pnrStatus && p.pnrStatus.toUpperCase() === 'RAC';

        // Must be boarded
        const isBoarded = p.boarded === true;

        // Must be online
        const isOnline = p.passengerStatus && p.passengerStatus.toLowerCase() === 'online';

        // Must not be no-show
        const notNoShow = !p.noShow;

        return isRAC && isBoarded && isOnline && notNoShow;
      });
    } catch (error) {
      console.error('Error getting boarded online RAC:', error.message);
      return [];
    }
  }

  /**
   * Get offline RAC passengers (for TTE manual processing)
   */
  getOfflineRAC(trainState) {
    try {
      const allPassengers = trainState.getAllPassengers();

      return allPassengers.filter(p =>
        p.pnrStatus === 'RAC' &&
        p.passengerStatus !== 'online' &&
        !p.noShow
      );
    } catch (error) {
      console.error('Error getting offline RAC:', error.message);
      return [];
    }
  }

  /**
   * Search for specific passenger in RAC queue
   */
  searchPassenger(trainState, pnr) {
    try {
      const result = trainState.findPassenger(pnr);

      if (!result) {
        return {
          found: false,
          message: `Passenger with PNR ${pnr} not found`,
        };
      }

      const { passenger, berth, coachNo } = result;

      return {
        found: true,
        passenger: {
          pnr: passenger.pnr,
          name: passenger.name,
          pnrStatus: passenger.pnrStatus,
          class: passenger.class,
          from: passenger.from,
          to: passenger.to,
          boarded: passenger.boarded,
          noShow: passenger.noShow,
          passengerStatus: passenger.passengerStatus,
          currentBerth: berth ? berth.fullBerthNo : 'Unallocated',
          coach: coachNo,
        },
      };
    } catch (error) {
      console.error('Error searching passenger:', error.message);
      return {
        found: false,
        message: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Get RAC count statistics
   */
  getRACStats(trainState) {
    try {
      const allRac = this.getRACQueue(trainState);
      const boarded = allRac.filter(r => r.boarded);
      const online = boarded.filter(r => r.passengerStatus === 'online');
      const noShow = allRac.filter(r => r.noShow);

      return {
        total: allRac.length,
        boarded: boarded.length,
        boardedOnline: online.length,
        notBoarded: allRac.length - boarded.length,
        noShow: noShow.length,
        active: online.length, // Active = boarded + online
      };
    } catch (error) {
      console.error('Error getting RAC stats:', error.message);
      return {};
    }
  }

  /**
   * Get RAC passengers by priority
   */
  getRACByPriority(trainState) {
    try {
      const racQueue = this.getRACQueue(trainState);

      // Group by RAC number
      const grouped = {};
      racQueue.forEach(rac => {
        const racNum = rac.racStatus?.match(/RAC\s*(\d+)/i)?.[1] || 'unknown';
        if (!grouped[racNum]) grouped[racNum] = [];
        grouped[racNum].push(rac);
      });

      return grouped;
    } catch (error) {
      console.error('Error getting RAC by priority:', error.message);
      return {};
    }
  }

  /**
   * Add passenger to RAC queue (if not already present)
   */
  addToRACQueue(trainState, passenger) {
    try {
      const existing = trainState.racQueue.find(r => r.pnr === passenger.pnr);
      if (!existing) {
        trainState.racQueue.push(passenger);
        return { success: true, message: 'Added to RAC queue' };
      }
      return { success: false, message: 'Already in RAC queue' };
    } catch (error) {
      console.error('Error adding to RAC queue:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Remove passenger from RAC queue
   */
  removeFromRACQueue(trainState, pnr) {
    try {
      const index = trainState.racQueue.findIndex(r => r.pnr === pnr);
      if (index !== -1) {
        const removed = trainState.racQueue.splice(index, 1);
        return { success: true, message: 'Removed from RAC queue', passenger: removed[0] };
      }
      return { success: false, message: 'Passenger not in RAC queue' };
    } catch (error) {
      console.error('Error removing from RAC queue:', error.message);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new RACQueueService();
