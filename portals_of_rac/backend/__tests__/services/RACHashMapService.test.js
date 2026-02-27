/**
 * RACHashMapService Tests - Comprehensive Coverage
 * Tests for optimized RAC passenger lookup using HashMaps
 */

const RACHashMapService = require('../../services/RACHashMapService');

describe('RACHashMapService - Comprehensive Tests', () => {
    let mockRACQueue;

    beforeEach(() => {
        RACHashMapService.clear();

        mockRACQueue = [
            {
                pnr: 'P001',
                name: 'John Doe',
                from: 'STA',
                to: 'STC',
                fromIdx: 0,
                toIdx: 3,
                racStatus: 'RAC-1',
                boarded: true,
                passengerStatus: 'online',
                coach: 'S1',
                seat: 1
            },
            {
                pnr: 'P002',
                name: 'Jane Smith',
                from: 'STB',
                to: 'STC',
                fromIdx: 1,
                toIdx: 3,
                racStatus: 'RAC-2',
                boarded: true,
                passengerStatus: 'offline',
                coach: 'S1',
                seat: 2
            },
            {
                pnr: 'P003',
                name: 'Bob Johnson',
                from: 'STA',
                to: 'STD',
                fromIdx: 0,
                toIdx: 4,
                racStatus: 'RAC-3',
                boarded: false,
                passengerStatus: 'online',
                coach: 'S2',
                seat: 1
            }
        ];
    });

    describe('buildHashMaps', () => {
        it('should build all three HashMaps successfully', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);

            expect(RACHashMapService.getSize()).toBe(3);
        });

        it('should clear existing maps before rebuilding', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);
            expect(RACHashMapService.getSize()).toBe(3);

            const newQueue = [{ pnr: 'P004', name: 'New', from: 'STA', to: 'STB', fromIdx: 0, toIdx: 1, racStatus: 'RAC-1', boarded: true, coach: 'S1', seat: 1 }];
            RACHashMapService.buildHashMaps(newQueue);

            expect(RACHashMapService.getSize()).toBe(1);
        });

        it('should handle empty RAC queue', () => {
            RACHashMapService.buildHashMaps([]);

            expect(RACHashMapService.getSize()).toBe(0);
        });

        it('should build passenger details map correctly', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);

            const passenger = RACHashMapService.getPassengerByPNR('P001');
            expect(passenger).toMatchObject({
                pnr: 'P001',
                name: 'John Doe',
                from: 'STA',
                to: 'STC',
                currentBerth: 'S1-1'
            });
        });

        it('should build destination map correctly', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);

            const passengers = RACHashMapService.getPassengersByDestination('STC');
            expect(passengers).toHaveLength(2);
            expect(passengers.map(p => p.pnr)).toContain('P001');
            expect(passengers.map(p => p.pnr)).toContain('P002');
        });

        it('should build station index map correctly', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);

            const passengersAtStation0 = RACHashMapService.getPassengersAtStation(0);
            expect(passengersAtStation0).toHaveLength(2);
        });
    });

    describe('getPassengerByPNR', () => {
        beforeEach(() => {
            RACHashMapService.buildHashMaps(mockRACQueue);
        });

        it('should return passenger details for valid PNR', () => {
            const passenger = RACHashMapService.getPassengerByPNR('P001');

            expect(passenger).toBeDefined();
            expect(passenger.pnr).toBe('P001');
            expect(passenger.name).toBe('John Doe');
        });

        it('should return undefined for non-existent PNR', () => {
            const passenger = RACHashMapService.getPassengerByPNR('P999');

            expect(passenger).toBeUndefined();
        });

        it('should include current berth information', () => {
            const passenger = RACHashMapService.getPassengerByPNR('P001');

            expect(passenger.currentBerth).toBe('S1-1');
        });
    });

    describe('getPassengersByDestination', () => {
        beforeEach(() => {
            RACHashMapService.buildHashMaps(mockRACQueue);
        });

        it('should return all passengers going to specific destination', () => {
            const passengers = RACHashMapService.getPassengersByDestination('STC');

            expect(passengers).toHaveLength(2);
            expect(passengers.every(p => p.to === 'STC')).toBe(true);
        });

        it('should return empty array for destination with no passengers', () => {
            const passengers = RACHashMapService.getPassengersByDestination('UNKNOWN');

            expect(passengers).toEqual([]);
        });

        it('should return passenger details not just PNRs', () => {
            const passengers = RACHashMapService.getPassengersByDestination('STC');

            expect(passengers[0]).toHaveProperty('name');
            expect(passengers[0]).toHaveProperty('boarded');
        });
    });

    describe('getPassengersAtStation', () => {
        beforeEach(() => {
            RACHashMapService.buildHashMaps(mockRACQueue);
        });

        it('should return passengers at specific station index', () => {
            const passengers = RACHashMapService.getPassengersAtStation(0);

            expect(passengers.length).toBeGreaterThan(0);
        });

        it('should return empty array for station with no passengers', () => {
            const passengers = RACHashMapService.getPassengersAtStation(99);

            expect(passengers).toEqual([]);
        });

        it('should return passengers whose journey includes the station', () => {
            const passengersAtStation1 = RACHashMapService.getPassengersAtStation(1);

            passengersAtStation1.forEach(p => {
                expect(p.fromIdx).toBeLessThanOrEqual(1);
                expect(p.toIdx).toBeGreaterThan(1);
            });
        });
    });

    describe('getPNRToDestinationMap', () => {
        beforeEach(() => {
            RACHashMapService.buildHashMaps(mockRACQueue);
        });

        it('should return mapping object', () => {
            const mapping = RACHashMapService.getPNRToDestinationMap();

            expect(typeof mapping).toBe('object');
            expect(Object.keys(mapping)).toHaveLength(3);
        });

        it('should include destination for each PNR', () => {
            const mapping = RACHashMapService.getPNRToDestinationMap();

            expect(mapping['P001']).toHaveProperty('destination');
            expect(mapping['P001'].destination).toBe('STC');
        });

        it('should include passenger details', () => {
            const mapping = RACHashMapService.getPNRToDestinationMap();

            expect(mapping['P001']).toHaveProperty('name');
            expect(mapping['P001']).toHaveProperty('from');
            expect(mapping['P001']).toHaveProperty('racStatus');
            expect(mapping['P001']).toHaveProperty('boarded');
        });
    });

    describe('getDestinationStatistics', () => {
        beforeEach(() => {
            RACHashMapService.buildHashMaps(mockRACQueue);
        });

        it('should return statistics array', () => {
            const stats = RACHashMapService.getDestinationStatistics();

            expect(Array.isArray(stats)).toBe(true);
            expect(stats.length).toBeGreaterThan(0);
        });

        it('should include passenger counts for each destination', () => {
            const stats = RACHashMapService.getDestinationStatistics();

            stats.forEach(stat => {
                expect(stat).toHaveProperty('destination');
                expect(stat).toHaveProperty('totalPassengers');
                expect(stat).toHaveProperty('boardedPassengers');
                expect(stat).toHaveProperty('notBoardedPassengers');
            });
        });

        it('should sort destinations by passenger count descending', () => {
            const stats = RACHashMapService.getDestinationStatistics();

            for (let i = 1; i < stats.length; i++) {
                expect(stats[i - 1].totalPassengers).toBeGreaterThanOrEqual(stats[i].totalPassengers);
            }
        });

        it('should include PNR list and RAC numbers', () => {
            const stats = RACHashMapService.getDestinationStatistics();

            expect(stats[0]).toHaveProperty('pnrs');
            expect(stats[0]).toHaveProperty('racNumbers');
            expect(Array.isArray(stats[0].pnrs)).toBe(true);
            expect(typeof stats[0].racNumbers).toBe('string');
        });

        it('should correctly count boarded vs not boarded', () => {
            const stats = RACHashMapService.getDestinationStatistics();

            stats.forEach(stat => {
                expect(stat.totalPassengers).toBe(stat.boardedPassengers + stat.notBoardedPassengers);
            });
        });
    });

    describe('hasPNR', () => {
        beforeEach(() => {
            RACHashMapService.buildHashMaps(mockRACQueue);
        });

        it('should return true for existing PNR', () => {
            expect(RACHashMapService.hasPNR('P001')).toBe(true);
        });

        it('should return false for non-existent PNR', () => {
            expect(RACHashMapService.hasPNR('P999')).toBe(false);
        });
    });

    describe('getAllPNRs', () => {
        beforeEach(() => {
            RACHashMapService.buildHashMaps(mockRACQueue);
        });

        it('should return array of all PNRs', () => {
            const pnrs = RACHashMapService.getAllPNRs();

            expect(Array.isArray(pnrs)).toBe(true);
            expect(pnrs).toHaveLength(3);
        });

        it('should include all PNRs from queue', () => {
            const pnrs = RACHashMapService.getAllPNRs();

            expect(pnrs).toContain('P001');
            expect(pnrs).toContain('P002');
            expect(pnrs).toContain('P003');
        });
    });

    describe('getSize', () => {
        it('should return 0 for empty map', () => {
            expect(RACHashMapService.getSize()).toBe(0);
        });

        it('should return correct size after building maps', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);

            expect(RACHashMapService.getSize()).toBe(3);
        });
    });

    describe('clear', () => {
        it('should clear all maps', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);
            expect(RACHashMapService.getSize()).toBe(3);

            RACHashMapService.clear();

            expect(RACHashMapService.getSize()).toBe(0);
            expect(RACHashMapService.getAllPNRs()).toEqual([]);
        });

        it('should clear destination map', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);
            RACHashMapService.clear();

            const passengers = RACHashMapService.getPassengersByDestination('STC');
            expect(passengers).toEqual([]);
        });

        it('should clear station index map', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);
            RACHashMapService.clear();

            const passengers = RACHashMapService.getPassengersAtStation(0);
            expect(passengers).toEqual([]);
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle large RAC queue efficiently', () => {
            const largeQueue = Array.from({ length: 1000 }, (_, i) => ({
                pnr: `P${i.toString().padStart(4, '0')}`,
                name: `Passenger ${i}`,
                from: 'STA',
                to: 'STC',
                fromIdx: 0,
                toIdx: 3,
                racStatus: `RAC-${i + 1}`,
                boarded: i % 2 === 0,
                passengerStatus: 'online',
                coach: 'S1',
                seat: i
            }));

            RACHashMapService.buildHashMaps(largeQueue);

            expect(RACHashMapService.getSize()).toBe(1000);
            expect(RACHashMapService.hasPNR('P0500')).toBe(true);
        });

        it('should handle passengers with same destination', () => {
            const sameDestQueue = mockRACQueue.map(p => ({ ...p, to: 'STC', toIdx: 3 }));

            RACHashMapService.buildHashMaps(sameDestQueue);

            const stats = RACHashMapService.getDestinationStatistics();
            expect(stats).toHaveLength(1);
            expect(stats[0].totalPassengers).toBe(3);
        });

        it('should handle passengers with overlapping journeys', () => {
            RACHashMapService.buildHashMaps(mockRACQueue);

            const passengersAt0 = RACHashMapService.getPassengersAtStation(0);
            const passengersAt1 = RACHashMapService.getPassengersAtStation(1);
            const passengersAt2 = RACHashMapService.getPassengersAtStation(2);

            expect(passengersAt0.length).toBeGreaterThan(0);
            expect(passengersAt1.length).toBeGreaterThan(0);
            expect(passengersAt2.length).toBeGreaterThan(0);
        });
    });
});
