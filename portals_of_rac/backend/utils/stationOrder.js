// backend/utils/stationOrder.js

class StationOrder {
  /**
   * Get station by index
   */
  static getStationByIndex(stations, idx) {
    return stations.find(s => s.idx === idx);
  }

  /**
   * Get station by code
   */
  static getStationByCode(stations, code) {
    return stations.find(s => s.code === code);
  }

  /**
   * Get station by name
   */
  static getStationByName(stations, name) {
    return stations.find(s => s.name === name);
  }

  /**
 * Find station by search string with flexible matching
 */
  static findStation(stations, searchStr) {
    // Defensive: Handle missing/invalid inputs
    if (!stations || !Array.isArray(stations) || stations.length === 0) {
      console.warn('⚠️ StationOrder.findStation: Invalid stations array');
      return null;
    }

    if (!searchStr || typeof searchStr !== 'string') {
      console.warn('⚠️ StationOrder.findStation: Invalid search string');
      return null;
    }

    // First try exact match
    let station = stations.find(s =>
      s.code === searchStr ||
      s.name === searchStr
    );

    if (station) return station;

    // Try includes match
    station = stations.find(s =>
      searchStr.includes(s.code) ||
      searchStr.includes(s.name)
    );

    if (station) return station;

    // Fuzzy match: normalize and compare
    const normalize = (str) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .replace(/\s*\([a-z0-9]+\)\s*/gi, '')  // Remove station codes like (NR), (TGL)
        .replace(/\s+(jn|junction|station|halt|town|city|road)$/i, '')  // Remove suffixes
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalizedSearch = normalize(searchStr);

    return stations.find(s => {
      const normalizedCode = normalize(s.code);
      const normalizedName = normalize(s.name);

      return normalizedCode === normalizedSearch ||
        normalizedName === normalizedSearch ||
        normalizedSearch.includes(normalizedCode) ||
        normalizedSearch.includes(normalizedName);
    }) || null;  // Always return null instead of undefined
  }

  /**
   * Get station index by code
   */
  static getIndexByCode(stations, code) {
    const station = this.getStationByCode(stations, code);
    return station ? station.idx : -1;
  }

  /**
   * Get next station
   */
  static getNextStation(stations, currentIdx) {
    return stations.find(s => s.idx === currentIdx + 1);
  }

  /**
   * Get previous station
   */
  static getPreviousStation(stations, currentIdx) {
    return stations.find(s => s.idx === currentIdx - 1);
  }

  /**
   * Get stations between two indices
   */
  static getStationsBetween(stations, fromIdx, toIdx) {
    return stations.filter(s => s.idx >= fromIdx && s.idx <= toIdx);
  }

  /**
   * Calculate distance between stations
   */
  static calculateDistance(fromIdx, toIdx) {
    return Math.abs(toIdx - fromIdx);
  }

  /**
   * Check if journey is valid (destination after origin)
   */
  static isValidJourney(fromIdx, toIdx) {
    return toIdx > fromIdx;
  }

  /**
   * Format station name with code
   */
  static formatStationName(station) {
    return `${station.name} (${station.code})`;
  }

  /**
   * Get all station codes
   */
  static getAllStationCodes(stations) {
    return stations.map(s => s.code);
  }

  /**
   * Get journey description
   */
  static getJourneyDescription(stations, fromIdx, toIdx) {
    const fromStation = this.getStationByIndex(stations, fromIdx);
    const toStation = this.getStationByIndex(stations, toIdx);

    if (!fromStation || !toStation) {
      return 'Invalid journey';
    }

    const distance = this.calculateDistance(fromIdx, toIdx);
    return `${fromStation.code} → ${toStation.code} (${distance} segments)`;
  }
}

module.exports = StationOrder;