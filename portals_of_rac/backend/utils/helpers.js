// backend/utils/helpers.js

class Helpers {
  /**
   * Format date to readable string
   */
  static formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /**
   * Format time string
   */
  static formatTime(timeString) {
    if (!timeString || timeString === "-" || timeString === "First") {
      return timeString;
    }
    return timeString;
  }

  /**
   * Format berth notation
   */
  static formatBerth(coachNo, seatNo, berthType) {
    const abbr = this.getBerthTypeAbbr(berthType);
    return `${coachNo}-${seatNo} (${abbr})`;
  }

  /**
   * Get berth type abbreviation
   */
  static getBerthTypeAbbr(berthType) {
    const abbr = {
      "Lower Berth": "LB",
      "Middle Berth": "MB",
      "Upper Berth": "UB",
      "Side Lower": "SL",
      "Side Upper": "SU",
    };
    return abbr[berthType] || berthType;
  }

  /**
   * Format name (capitalize first letter of each word)
   */
  static formatName(name) {
    return name
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Format PNR with spaces
   */
  static formatPNR(pnr) {
    const pnrStr = String(pnr);
    return pnrStr.replace(/(\d{3})(?=\d)/g, "$1 ");
  }

  /**
   * Generate random PNR
   */
  static generatePNR() {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
  }

  /**
   * Sanitize input string
   */
  static sanitizeInput(str) {
    if (!str) return "";
    return String(str).trim().replace(/[<>]/g, "");
  }

  /**
   * Validate PNR format
   */
  static isValidPNRFormat(pnr) {
    const pnrStr = String(pnr).trim();
    return /^\d{10}$/.test(pnrStr);
  }

  /**
   * Get gender display name (handles both old and new formats)
   */
  static getGenderDisplay(gender) {
    if (!gender) return "Unknown";
    // Handle old format (M, F, O)
    if (gender === "M") return "Male";
    if (gender === "F") return "Female";
    if (gender === "O") return "Other";
    // Handle new format (already full words)
    return gender;
  }

  /**
   * Format class name (handles both old and new formats)
   */
  static formatClassName(classCode) {
    if (!classCode) return "Unknown";
    const classNames = {
      SL: "Sleeper",
      "AC_3_Tier": "AC 3-Tier",
      "3-TierAC": "AC 3-Tier",
      "2A": "AC 2-Tier",
      "2-TierAC": "AC 2-Tier",
      "1A": "AC 1-Tier",
      "1-TierAC": "AC 1-Tier",
      CC: "Chair Car",
      "2S": "Second Sitting",
    };
    return classNames[classCode] || classCode;
  }

  /**
   * Get current timestamp
   */
  static getCurrentTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Deep clone object
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Check if object is empty
   */
  static isEmpty(obj) {
    return Object.keys(obj).length === 0;
  }

  /**
   * Convert array to object by key
   */
  static arrayToObject(array, key) {
    return array.reduce((obj, item) => {
      obj[item[key]] = item;
      return obj;
    }, {});
  }

  /**
   * Sleep/delay function
   */
  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get random element from array
   */
  static getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Chunk array into smaller arrays
   */
  static chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Calculate percentage
   */
  static calculatePercentage(value, total) {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(2);
  }

  /**
   * Format number with commas
   */
  static formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /**
   * Truncate string
   */
  static truncate(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "...";
  }

  /**
   * Remove duplicates from array
   */
  static removeDuplicates(array) {
    return [...new Set(array)];
  }

  /**
   * Sort array of objects by property
   */
  static sortByProperty(array, property, ascending = true) {
    return array.sort((a, b) => {
      if (ascending) {
        return a[property] > b[property] ? 1 : -1;
      } else {
        return a[property] < b[property] ? 1 : -1;
      }
    });
  }

  /**
   * Group array by property
   */
  static groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property];
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
  }
}

module.exports = Helpers;
