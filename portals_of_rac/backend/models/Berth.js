// backend/models/Berth.js

class Berth {
  constructor(coachNo, berthNo, type, totalSegments) {
    this.coachNo = coachNo;
    this.berthNo = berthNo;
    this.fullBerthNo = `${coachNo}-${berthNo}`;
    this.type = type;
    this.status = 'VACANT'; // VACANT, OCCUPIED, SHARED

    // Segment-based occupancy - Array of PNR arrays to support RAC sharing
    this.totalSegments = totalSegments;
    this.segmentOccupancy = new Array(totalSegments).fill(null).map(() => []);

    // Passengers list
    this.passengers = [];
  }

  /**
   * Add passenger to berth with segment occupancy
   */
  addPassenger(passenger) {
    // Defensive: Capture ALL fields from passenger object, provide safe defaults
    this.passengers.push({
      ...passenger,  // Spread all fields - future-proof against new fields
      // Ensure critical fields have defaults if missing
      pnr: passenger.pnr || 'UNKNOWN',
      name: passenger.name || 'Unknown Passenger',
      racStatus: passenger.racStatus || '-',
      passengerStatus: passenger.passengerStatus || 'Offline',
      berthType: passenger.berthType || 'Unknown',
      noShow: passenger.noShow || false,
      boarded: passenger.boarded || false
    });

    // Mark segments as occupied - Add PNR to array
    if (!passenger.noShow) {
      for (let i = passenger.fromIdx; i < passenger.toIdx; i++) {
        if (!this.segmentOccupancy[i].includes(passenger.pnr)) {
          this.segmentOccupancy[i].push(passenger.pnr);
        }
      }
    }

    this.updateStatus();
  }

  /**
   * Remove passenger from berth
   */
  removePassenger(pnr) {
    const passenger = this.passengers.find(p => p.pnr === pnr);

    if (passenger) {
      // Clear segment occupancy - Remove PNR from array
      for (let i = 0; i < this.segmentOccupancy.length; i++) {
        const index = this.segmentOccupancy[i].indexOf(pnr);
        if (index > -1) {
          this.segmentOccupancy[i].splice(index, 1);
        }
      }

      // Remove from passengers list
      this.passengers = this.passengers.filter(p => p.pnr !== pnr);
      this.updateStatus();

      return true;
    }

    return false;
  }

  /**
   * Update berth status based on current passengers
   */
  updateStatus() {
    const activePassengers = this.passengers.filter(p => !p.noShow);

    if (activePassengers.length === 0) {
      this.status = 'VACANT';
    } else if (activePassengers.length === 1) {
      this.status = 'OCCUPIED';
    } else {
      this.status = 'SHARED';
    }
  }

  /**
   * Check if berth is available for given journey segment
   * Side Lower berths (RAC) can have up to 2 passengers
   */
  isAvailableForSegment(fromIdx, toIdx) {
    const isRACBerth = this.type === "Side Lower";
    const maxAllowed = isRACBerth ? 2 : 1;

    for (let i = fromIdx; i < toIdx; i++) {
      if (this.segmentOccupancy[i].length >= maxAllowed) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get segment occupancy details
   */
  getSegmentOccupancy() {
    return this.segmentOccupancy.map((pnr, idx) => ({
      segmentId: idx,
      occupied: pnr !== null,
      pnr: pnr
    }));
  }

  /**
   * Get vacant segments
   */
  getVacantSegments() {
    const vacant = [];
    for (let i = 0; i < this.segmentOccupancy.length; i++) {
      if (this.segmentOccupancy[i].length === 0) {
        vacant.push(i);
      }
    }
    return vacant;
  }

  /**
   * Get boarded passengers
   */
  getBoardedPassengers() {
    return this.passengers.filter(p => p.boarded && !p.noShow);
  }

  /**
   * Check if berth is vacant at specific station
   */
  isVacantAtStation(stationIdx) {
    return this.segmentOccupancy[stationIdx].length === 0;
  }

  /**
   * Get passengers deboarding at station
   */
  getDeboardingPassengers(stationIdx) {
    return this.passengers.filter(p =>
      p.toIdx === stationIdx && p.boarded && !p.noShow
    );
  }

  /**
   * Get passengers boarding at station
   */
  getBoardingPassengers(stationIdx) {
    return this.passengers.filter(p =>
      p.fromIdx === stationIdx && !p.boarded && !p.noShow
    );
  }

  /**
   * Get RAC passengers on this berth
   */
  getRACPassengers() {
    return this.passengers.filter(p =>
      p.pnrStatus === 'RAC' && !p.noShow
    );
  }

  /**
   * Check if this is a RAC berth (has 2 RAC passengers)
   */
  isRACBerth() {
    const racPassengers = this.getRACPassengers();
    return racPassengers.length === 2;
  }

  /**
   * Get co-passenger sharing RAC berth
   */
  getCoPassenger(pnr) {
    const racPassengers = this.getRACPassengers();
    if (racPassengers.length === 2) {
      return racPassengers.find(p => p.pnr !== pnr) || null;
    }
    return null;
  }

}

module.exports = Berth;