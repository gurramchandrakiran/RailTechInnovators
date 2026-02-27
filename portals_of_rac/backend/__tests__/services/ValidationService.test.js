/**
 * ValidationService Tests
 * Tests for PNR validation, journey validation, and train state validation
 * 
 * Actual methods in ValidationService:
 * - validatePNR(pnr)
 * - validateJourneySegment(trainState, coachNo, seatNo, fromIdx, toIdx)
 * - validateRACEligibility(trainState, racPassenger, vacantBerth)
 * - validateStationIndex(trainState, stationIdx)
 * - validateJourney(fromIdx, toIdx, totalStations)
 * - validateTrainInitialized(trainState)
 * - validateJourneyStarted(trainState)
 * - validateJourneyNotComplete(trainState)
 */

const ValidationService = require('../../services/ValidationService');

describe('ValidationService', () => {
    describe('validatePNR', () => {
        it('should validate correct 10-digit PNR', () => {
            const result = ValidationService.validatePNR('1234567890');
            expect(result.valid).toBe(true);
        });

        it('should validate correct 12-digit PNR', () => {
            const result = ValidationService.validatePNR('123456789012');
            expect(result.valid).toBe(true);
        });

        it('should reject PNR with less than 10 digits', () => {
            const result = ValidationService.validatePNR('123456789');
            expect(result.valid).toBe(false);
            expect(result.reason).toBeDefined();
        });

        it('should reject PNR with more than 12 digits', () => {
            const result = ValidationService.validatePNR('1234567890123');
            expect(result.valid).toBe(false);
        });

        it('should reject PNR with non-numeric characters', () => {
            const result = ValidationService.validatePNR('123456789a');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('digits');
        });

        it('should reject null PNR', () => {
            const result = ValidationService.validatePNR(null);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('required');
        });

        it('should reject undefined PNR', () => {
            const result = ValidationService.validatePNR(undefined);
            expect(result.valid).toBe(false);
        });

        it('should reject empty string PNR', () => {
            const result = ValidationService.validatePNR('');
            expect(result.valid).toBe(false);
        });

        it('should handle PNR with spaces (after trimming)', () => {
            const result = ValidationService.validatePNR(' 1234567890 ');
            expect(result.valid).toBe(true);
        });
    });

    describe('validateJourney', () => {
        it('should validate correct journey (from < to)', () => {
            const result = ValidationService.validateJourney(0, 3, 5);
            expect(result.valid).toBe(true);
        });

        it('should reject journey where from >= to', () => {
            const result = ValidationService.validateJourney(3, 3, 5);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('after');
        });

        it('should reject journey where from > to', () => {
            const result = ValidationService.validateJourney(4, 2, 5);
            expect(result.valid).toBe(false);
        });

        it('should reject negative station indices', () => {
            const result = ValidationService.validateJourney(-1, 3, 5);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('negative');
        });

        it('should reject station index >= total stations', () => {
            const result = ValidationService.validateJourney(0, 5, 5);
            expect(result.valid).toBe(false);
        });

        it('should reject non-numeric indices', () => {
            const result = ValidationService.validateJourney('a', 3, 5);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('numbers');
        });
    });

    describe('validateTrainInitialized', () => {
        it('should validate initialized train state', () => {
            const trainState = {
                stations: [{ code: 'A' }, { code: 'B' }],
                coaches: [{ coachNo: 'S1' }]
            };
            const result = ValidationService.validateTrainInitialized(trainState);
            expect(result.valid).toBe(true);
        });

        it('should reject null train state', () => {
            const result = ValidationService.validateTrainInitialized(null);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not initialized');
        });

        it('should reject train state without stations', () => {
            const trainState = { stations: [], coaches: [{ coachNo: 'S1' }] };
            const result = ValidationService.validateTrainInitialized(trainState);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('stations');
        });

        it('should reject train state without coaches', () => {
            const trainState = { stations: [{ code: 'A' }], coaches: [] };
            const result = ValidationService.validateTrainInitialized(trainState);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('coaches');
        });
    });

    describe('validateStationIndex', () => {
        const trainState = {
            stations: [
                { code: 'A', name: 'Station A' },
                { code: 'B', name: 'Station B' },
                { code: 'C', name: 'Station C' }
            ]
        };

        it('should validate correct station index', () => {
            const result = ValidationService.validateStationIndex(trainState, 1);
            expect(result.valid).toBe(true);
        });

        it('should reject negative station index', () => {
            const result = ValidationService.validateStationIndex(trainState, -1);
            expect(result.valid).toBe(false);
        });

        it('should reject station index >= total stations', () => {
            const result = ValidationService.validateStationIndex(trainState, 3);
            expect(result.valid).toBe(false);
        });

        it('should reject non-numeric station index', () => {
            const result = ValidationService.validateStationIndex(trainState, 'abc');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('number');
        });
    });

    describe('validateJourneyStarted', () => {
        it('should validate when journey has started', () => {
            const trainState = { journeyStarted: true };
            const result = ValidationService.validateJourneyStarted(trainState);
            expect(result.valid).toBe(true);
        });

        it('should reject when journey has not started', () => {
            const trainState = { journeyStarted: false };
            const result = ValidationService.validateJourneyStarted(trainState);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not started');
        });
    });
});
