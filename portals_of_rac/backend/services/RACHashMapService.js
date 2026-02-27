/**
 * RACHashMapService.js
 * Optimized data structure using HashMap for fast RAC passenger lookups
 * Key: PNR Number, Value: Passenger destination and journey details
 */

class RACHashMapService {
    constructor() {
        // HashMap: PNR -> Passenger Details
        this.racPassengerMap = new Map();

        // HashMap: Destination Station -> List of PNRs going there
        this.destinationMap = new Map();

        // HashMap: Current Station Index -> List of PNRs at that station
        this.stationIndexMap = new Map();
    }

    /**
     * Build optimized HashMaps from RAC queue
     * Time Complexity: O(n) where n = number of RAC passengers
     */
    buildHashMaps(racQueue) {
        // Clear existing maps
        this.racPassengerMap.clear();
        this.destinationMap.clear();
        this.stationIndexMap.clear();

        racQueue.forEach(passenger => {
            const pnr = passenger.pnr;

            // 1. PNR -> Passenger Details HashMap
            this.racPassengerMap.set(pnr, {
                pnr: passenger.pnr,
                name: passenger.name,
                from: passenger.from,
                to: passenger.to,
                fromIdx: passenger.fromIdx,
                toIdx: passenger.toIdx,
                racStatus: passenger.racStatus,
                boarded: passenger.boarded,
                passengerStatus: passenger.passengerStatus,
                coach: passenger.coach,
                seat: passenger.seat,
                currentBerth: `${passenger.coach}-${passenger.seat}`
            });

            // 2. Destination -> PNRs HashMap
            const destination = passenger.to;
            if (!this.destinationMap.has(destination)) {
                this.destinationMap.set(destination, []);
            }
            this.destinationMap.get(destination).push(pnr);

            // 3. Station Index -> PNRs HashMap (for range queries)
            for (let i = passenger.fromIdx; i < passenger.toIdx; i++) {
                if (!this.stationIndexMap.has(i)) {
                    this.stationIndexMap.set(i, []);
                }
                this.stationIndexMap.get(i).push(pnr);
            }
        });

        console.log(`\n📊 Built RAC HashMaps:`);
        console.log(`   Total RAC Passengers: ${this.racPassengerMap.size}`);
        console.log(`   Unique Destinations: ${this.destinationMap.size}`);
        console.log(`   Station Indices Covered: ${this.stationIndexMap.size}`);
    }

    /**
     * Fast lookup by PNR - O(1) complexity
     */
    getPassengerByPNR(pnr) {
        return this.racPassengerMap.get(pnr);
    }

    /**
     * Get all passengers going to a specific destination - O(1) lookup
     */
    getPassengersByDestination(destination) {
        const pnrs = this.destinationMap.get(destination) || [];
        return pnrs.map(pnr => this.racPassengerMap.get(pnr));
    }

    /**
     * Get passengers at a specific station index - O(1) lookup
     */
    getPassengersAtStation(stationIdx) {
        const pnrs = this.stationIndexMap.get(stationIdx) || [];
        return pnrs.map(pnr => this.racPassengerMap.get(pnr));
    }

    /**
     * Get PNR to Destination mapping for visualization
     */
    getPNRToDestinationMap() {
        const mapping = {};
        this.racPassengerMap.forEach((passenger, pnr) => {
            mapping[pnr] = {
                destination: passenger.to,
                from: passenger.from,
                racStatus: passenger.racStatus,
                boarded: passenger.boarded,
                name: passenger.name
            };
        });
        return mapping;
    }

    /**
     * Get destination statistics
     */
    getDestinationStatistics() {
        const stats = [];
        this.destinationMap.forEach((pnrs, destination) => {
            const passengers = pnrs.map(pnr => this.racPassengerMap.get(pnr));
            const boardedCount = passengers.filter(p => p.boarded).length;

            stats.push({
                destination,
                totalPassengers: pnrs.length,
                boardedPassengers: boardedCount,
                notBoardedPassengers: pnrs.length - boardedCount,
                pnrs: pnrs,
                racNumbers: passengers.map(p => p.racStatus).join(', ')
            });
        });

        // Sort by passenger count (descending)
        stats.sort((a, b) => b.totalPassengers - a.totalPassengers);
        return stats;
    }

    /**
     * Check if PNR exists - O(1) complexity
     */
    hasPNR(pnr) {
        return this.racPassengerMap.has(pnr);
    }

    /**
     * Get all PNRs as array
     */
    getAllPNRs() {
        return Array.from(this.racPassengerMap.keys());
    }

    /**
     * Get map size
     */
    getSize() {
        return this.racPassengerMap.size;
    }

    /**
     * Clear all maps
     */
    clear() {
        this.racPassengerMap.clear();
        this.destinationMap.clear();
        this.stationIndexMap.clear();
    }
}

module.exports = new RACHashMapService();
