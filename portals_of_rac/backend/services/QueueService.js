// File path: backend/services/QueueService.js
const { RAC_PAIRINGS } = require('../utils/constants');

class QueueService {
  constructor() {
    this.queue = [];
  }

  addToQueue(passengers) {
    const racPassengers = passengers.filter(p => p.pnr_status.startsWith('RAC'));
    this.queue.push(...racPassengers.map(p => ({
      pnr: p.pnr,
      racNumber: this.extractRACNumber(p.pnr_status),
      fromIdx: p.fromIdx,
      toIdx: p.toIdx,
      name: p.name
    })));
    this.sortQueue();
  }

  extractRACNumber(pnrStatus) {
    const match = pnrStatus.match(/RAC\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 999;
  }

  dequeueAtDestination(stationName) {
    this.queue = this.queue.filter(item => item.to !== stationName);
  }

  removeFromQueue(pnr) {
    const index = this.queue.findIndex(item => item.pnr === pnr);
    if (index > -1) this.queue.splice(index, 1);
  }

  sortQueue() {
    this.queue.sort((a, b) => a.racNumber - b.racNumber);
  }

  getFront() {
    return this.queue[0] || null;
  }

  pop() {
    return this.queue.shift();
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  getSize() {
    return this.queue.length;
  }

  getAll() {
    return [...this.queue];
  }
}

module.exports = new QueueService();