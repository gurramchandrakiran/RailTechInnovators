// backend/services/SegmentService.js

class SegmentService {
  /**
   * Find eligible RAC passengers for a berth
   */
  findEligibleRACForBerth(trainState, berth, vacantBerth) {
    const eligible = [];
    
    trainState.racQueue.forEach(rac => {
      if (berth.isAvailableForSegment(rac.fromIdx, rac.toIdx)) {
        const segmentsNeeded = [];
        for (let i = rac.fromIdx; i < rac.toIdx; i++) {
          segmentsNeeded.push(i);
        }
        
        eligible.push({
          pnr: rac.pnr,
          name: rac.name,
          racNumber: rac.racNumber,
          pnrStatus: rac.pnrStatus,
          from: rac.from,
          to: rac.to,
          fromIdx: rac.fromIdx,
          toIdx: rac.toIdx,
          segmentsNeeded: segmentsNeeded,
          segmentCount: segmentsNeeded.length
        });
      }
    });
    
    return eligible;
  }

  /**
   * Get berth occupancy timeline
   */
  getBerthOccupancyTimeline(trainState, coachNo, berthNo) {
    const berth = trainState.findBerth(coachNo, berthNo);
    if (!berth) return null;
    
    const timeline = [];
    
    for (let i = 0; i < berth.segmentOccupancy.length; i++) {
      const segment = trainState.segmentMatrix.segments[i];
      const pnr = berth.segmentOccupancy[i];
      
      let passenger = null;
      if (pnr) {
        passenger = berth.passengers.find(p => p.pnr === pnr);
      }
      
      timeline.push({
        segmentId: i,
        from: segment.from,
        to: segment.to,
        occupied: pnr !== null,
        pnr: pnr,
        passengerName: passenger ? passenger.name : null,
        passengerStatus: passenger ? passenger.pnrStatus : null
      });
    }
    
    return timeline;
  }

  /**
   * Get vacancy matrix for all berths
   */
  getVacancyMatrix(trainState) {
    const matrix = [];
    
    trainState.coaches.forEach(coach => {
      const coachData = {
        coachNo: coach.coachNo,
        class: coach.class,
        berths: []
      };
      
      coach.berths.forEach(berth => {
        coachData.berths.push({
          berthNo: berth.berthNo,
          fullBerthNo: berth.fullBerthNo,
          type: berth.type,
          status: berth.status,
          segmentOccupancy: berth.getSegmentOccupancy()
        });
      });
      
      matrix.push(coachData);
    });
    
    return matrix;
  }

  /**
   * Get vacancy for specific segment
   */
  getSegmentVacancy(trainState, segmentId) {
    const vacant = [];
    
    trainState.coaches.forEach(coach => {
      coach.berths.forEach(berth => {
        if (berth.segmentOccupancy[segmentId] === null) {
          vacant.push({
            coachNo: coach.coachNo,
            berthNo: berth.berthNo,
            fullBerthNo: berth.fullBerthNo,
            type: berth.type
          });
        }
      });
    });
    
    return {
      segmentId: segmentId,
      segment: trainState.segmentMatrix.segments[segmentId],
      vacantCount: vacant.length,
      vacantBerths: vacant
    };
  }
}

module.exports = new SegmentService();