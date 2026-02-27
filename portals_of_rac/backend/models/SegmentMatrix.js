// backend/models/SegmentMatrix.js

class SegmentMatrix {
  constructor(stations) {
    this.stations = stations;
    this.segments = this.createSegments();
  }

  /**
   * Create segments from stations
   */
  createSegments() {
    const segments = [];
    
    for (let i = 0; i < this.stations.length - 1; i++) {
      segments.push({
        id: i,
        from: this.stations[i].code,
        to: this.stations[i + 1].code,
        fromIdx: i,
        toIdx: i + 1,
        name: `${this.stations[i].code}→${this.stations[i + 1].code}`
      });
    }
    
    return segments;
  }

  /**
   * Get segment IDs for journey
   */
  getSegmentIdsForJourney(fromIdx, toIdx) {
    const segmentIds = [];
    
    for (let i = fromIdx; i < toIdx; i++) {
      segmentIds.push(i);
    }
    
    return segmentIds;
  }

  /**
   * Check if two journeys overlap
   */
  journeysOverlap(journey1, journey2) {
    const segments1 = this.getSegmentIdsForJourney(journey1.fromIdx, journey1.toIdx);
    const segments2 = this.getSegmentIdsForJourney(journey2.fromIdx, journey2.toIdx);
    
    return segments1.some(s => segments2.includes(s));
  }

  /**
   * Get segment name
   */
  getSegmentName(segmentId) {
    return this.segments[segmentId]?.name || `Segment ${segmentId}`;
  }
}

module.exports = SegmentMatrix;