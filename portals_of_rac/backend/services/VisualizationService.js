// backend/services/VisualizationService.js - YOUR ORIGINAL + ONLY STATIONS MAPPING FIX (ALL FUNCTIONALITY PRESERVED)

class VisualizationService {
  /**
   * Generate segment matrix data for visualization (YOUR ORIGINAL LOGIC + STATIONS MAPPING FIXED FOR FULL TABLE)
   */
  generateSegmentMatrixData(trainState) {
    const segments = trainState.segmentMatrix.segments;
    const matrix = [];

    trainState.coaches.forEach(coach => {
      coach.berths.forEach(berth => {
        const row = {
          berth: berth.fullBerthNo,
          coach: coach.coachNo,
          type: berth.type,
          segments: []
        };

        segments.forEach((seg, idx) => {
          const pnrs = berth.segmentOccupancy[idx] || [];
          const pnr = pnrs.length > 0 ? pnrs.join(', ') : null; // Join multiple PNRs with comma
          const passenger = pnrs.length > 0 ? berth.passengers.find(p => p.pnr === pnrs[0]) : null;

          row.segments.push({
            segmentId: idx,
            segmentName: seg.name,
            occupied: pnrs.length > 0,
            pnr: pnr,
            passengerName: passenger ? passenger.name : null
          });
        });

        matrix.push(row);
      });
    });

    return {
      stations: trainState.stations.map(s => ({ // FIXED: Full mapping – sends all fields for table rows/summary (your original shallow map caused 0/empty)
        sno: s.sno, // # column
        code: s.code, // CODE column
        name: s.name, // STATION NAME column
        arrival: s.arrival || '-', // ARRIVAL (default for origin "-")
        departure: s.departure || '-', // DEPARTURE (default for end "-")
        halt: s.halt || 0, // HALT (prevents blank cells)
        distance: s.distance || 0, // DISTANCE (for km summary calc)
        day: s.day || 1, // DAY column
        zone: s.zone || 'South Central', // ZONE column
        division: s.division || 'Vijayawada', // DIVISION column
        platform: s.platform || '-', // PLATFORM column
        remarks: s.remarks || '-', // REMARKS column
        idx: s.idx // Internal use (segment matching)
      })),
      segments: segments, // YOUR ORIGINAL: Full segments array (unchanged)
      matrix: matrix // YOUR ORIGINAL: Full berth-segment grid (unchanged)
    };
  }

  /**
   * Generate graph data for network visualization (YOUR ORIGINAL 100% PRESERVED)
   */
  generateGraphData(trainState) {
    const nodes = [];
    const edges = [];

    trainState.stations.forEach((station, idx) => {
      nodes.push({
        id: `station-${idx}`,
        label: station.code,
        type: 'station',
        data: station
      });

      if (idx < trainState.stations.length - 1) {
        edges.push({
          id: `segment-${idx}`,
          source: `station-${idx}`,
          target: `station-${idx + 1}`,
          label: `Segment ${idx}`,
          data: {
            segmentId: idx,
            vacantBerths: this.getVacantBerthsForSegment(trainState, idx)
          }
        });
      }
    });

    return { nodes, edges };
  }

  /**
   * Get vacant berths count for a segment
   */
  getVacantBerthsForSegment(trainState, segmentId) {
    let count = 0;

    trainState.coaches.forEach(coach => {
      coach.berths.forEach(berth => {
        const occupants = berth.segmentOccupancy[segmentId] || [];
        if (occupants.length === 0) {
          count++;
        }
      });
    });

    return count;
  }

  /**
   * Generate heatmap data (YOUR ORIGINAL 100% PRESERVED)
   */
  generateHeatmapData(trainState) {
    const heatmap = [];

    trainState.coaches.forEach(coach => {
      const coachHeatmap = {
        coach: coach.coachNo,
        data: []
      };

      coach.berths.forEach(berth => {
        const occupancyPercentage = this.calculateOccupancyPercentage(berth);
        coachHeatmap.data.push({
          berth: berth.berthNo,
          occupancy: occupancyPercentage,
          color: this.getHeatmapColor(occupancyPercentage)
        });
      });

      heatmap.push(coachHeatmap);
    });

    return heatmap;
  }

  /**
   * Calculate occupancy percentage for a berth
   */
  calculateOccupancyPercentage(berth) {
    const totalSegments = berth.segmentOccupancy.length;
    const occupiedSegments = berth.segmentOccupancy.filter(s => s && s.length > 0).length;
    return (occupiedSegments / totalSegments) * 100;
  }

  /**
   * Get heatmap color based on occupancy (YOUR ORIGINAL 100% PRESERVED)
   */
  getHeatmapColor(percentage) {
    if (percentage === 0) return '#e8f5e9'; // Green - vacant
    if (percentage < 50) return '#fff9c4'; // Yellow - partially occupied
    if (percentage < 100) return '#ffccbc'; // Orange - mostly occupied
    return '#f44336'; // Red - fully occupied
  }
}

module.exports = new VisualizationService();