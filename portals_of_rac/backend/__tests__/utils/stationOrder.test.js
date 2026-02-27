/**
 * StationOrder Utility Tests
 */

const StationOrder = require('../../utils/stationOrder');

describe('StationOrder', () => {
    let mockStations;

    beforeEach(() => {
        mockStations = [
            { idx: 0, code: 'BZA', name: 'Vijayawada' },
            { idx: 1, code: 'RJY', name: 'Rajahmundry' },
            { idx: 2, code: 'VZM', name: 'Vizianagaram' },
            { idx: 3, code: 'VSKP', name: 'Visakhapatnam' }
        ];
    });

    describe('getStationByIndex', () => {
        it('should find station by index', () => {
            const station = StationOrder.getStationByIndex(mockStations, 1);
            expect(station.code).toBe('RJY');
        });

        it('should return undefined for invalid index', () => {
            const station = StationOrder.getStationByIndex(mockStations, 99);
            expect(station).toBeUndefined();
        });
    });

    describe('getStationByCode', () => {
        it('should find station by code', () => {
            const station = StationOrder.getStationByCode(mockStations, 'VZM');
            expect(station.name).toBe('Vizianagaram');
        });

        it('should return undefined for invalid code', () => {
            const station = StationOrder.getStationByCode(mockStations, 'INVALID');
            expect(station).toBeUndefined();
        });
    });

    describe('getStationByName', () => {
        it('should find station by name', () => {
            const station = StationOrder.getStationByName(mockStations, 'Vijayawada');
            expect(station.code).toBe('BZA');
        });

        it('should return undefined for invalid name', () => {
            const station = StationOrder.getStationByName(mockStations, 'Unknown');
            expect(station).toBeUndefined();
        });
    });

    describe('findStation', () => {
        it('should find by exact code match', () => {
            const station = StationOrder.findStation(mockStations, 'RJY');
            expect(station.name).toBe('Rajahmundry');
        });

        it('should find by exact name match', () => {
            const station = StationOrder.findStation(mockStations, 'Vizianagaram');
            expect(station.code).toBe('VZM');
        });

        it('should handle invalid inputs', () => {
            expect(StationOrder.findStation(null, 'BZA')).toBeNull();
            expect(StationOrder.findStation([], 'BZA')).toBeNull();
            expect(StationOrder.findStation(mockStations, null)).toBeNull();
            expect(StationOrder.findStation(mockStations, '')).toBeNull();
        });

        it('should normalize station names', () => {
            const stations = [
                { idx: 0, code: 'BZA', name: 'Vijayawada Junction' }
            ];
            const station = StationOrder.findStation(stations, 'Vijayawada');
            expect(station).toBeTruthy();
        });
    });

    describe('getIndexByCode', () => {
        it('should return index for valid code', () => {
            const idx = StationOrder.getIndexByCode(mockStations, 'VZM');
            expect(idx).toBe(2);
        });

        it('should return -1 for invalid code', () => {
            const idx = StationOrder.getIndexByCode(mockStations, 'INVALID');
            expect(idx).toBe(-1);
        });
    });

    describe('getNextStation', () => {
        it('should return next station', () => {
            const next = StationOrder.getNextStation(mockStations, 1);
            expect(next.code).toBe('VZM');
        });

        it('should return undefined at last station', () => {
            const next = StationOrder.getNextStation(mockStations, 3);
            expect(next).toBeUndefined();
        });
    });

    describe('getPreviousStation', () => {
        it('should return previous station', () => {
            const prev = StationOrder.getPreviousStation(mockStations, 2);
            expect(prev.code).toBe('RJY');
        });

        it('should return undefined at first station', () => {
            const prev = StationOrder.getPreviousStation(mockStations, 0);
            expect(prev).toBeUndefined();
        });
    });

    describe('getStationsBetween', () => {
        it('should return stations in range', () => {
            const stations = StationOrder.getStationsBetween(mockStations, 1, 3);
            expect(stations.length).toBe(3);
            expect(stations[0].code).toBe('RJY');
            expect(stations[2].code).toBe('VSKP');
        });

        it('should include endpoints', () => {
            const stations = StationOrder.getStationsBetween(mockStations, 0, 0);
            expect(stations.length).toBe(1);
            expect(stations[0].code).toBe('BZA');
        });
    });

    describe('calculateDistance', () => {
        it('should calculate forward distance', () => {
            expect(StationOrder.calculateDistance(0, 3)).toBe(3);
        });

        it('should calculate backward distance', () => {
            expect(StationOrder.calculateDistance(3, 0)).toBe(3);
        });

        it('should return 0 for same station', () => {
            expect(StationOrder.calculateDistance(1, 1)).toBe(0);
        });
    });

    describe('isValidJourney', () => {
        it('should validate forward journey', () => {
            expect(StationOrder.isValidJourney(0, 3)).toBe(true);
        });

        it('should reject backward journey', () => {
            expect(StationOrder.isValidJourney(3, 0)).toBe(false);
        });

        it('should reject same station', () => {
            expect(StationOrder.isValidJourney(1, 1)).toBe(false);
        });
    });

    describe('formatStationName', () => {
        it('should format station name with code', () => {
            const formatted = StationOrder.formatStationName(mockStations[0]);
            expect(formatted).toBe('Vijayawada (BZA)');
        });
    });

    describe('getAllStationCodes', () => {
        it('should return all codes', () => {
            const codes = StationOrder.getAllStationCodes(mockStations);
            expect(codes).toEqual(['BZA', 'RJY', 'VZM', 'VSKP']);
        });

        it('should return empty array for empty stations', () => {
            const codes = StationOrder.getAllStationCodes([]);
            expect(codes).toEqual([]);
        });
    });

    describe('getJourneyDescription', () => {
        it('should create journey description', () => {
            const desc = StationOrder.getJourneyDescription(mockStations, 0, 3);
            expect(desc).toBe('BZA → VSKP (3 segments)');
        });

        it('should handle invalid journey', () => {
            const desc = StationOrder.getJourneyDescription(mockStations, 0, 99);
            expect(desc).toBe('Invalid journey');
        });

        it('should handle invalid from station', () => {
            const desc = StationOrder.getJourneyDescription(mockStations, 99, 3);
            expect(desc).toBe('Invalid journey');
        });
    });
});

// 31 tests for stationOrder
