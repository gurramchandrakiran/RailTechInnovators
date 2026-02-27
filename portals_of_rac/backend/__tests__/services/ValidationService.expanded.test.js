/**
 * ValidationService Expanded Tests - Additional Coverage
 * Tests for validation utilities
 */

const ValidationService = require('../../services/ValidationService');

describe('ValidationService - Expanded Tests', () => {
    describe('validateJourneySegment', () => {
        it('should validate available berth segment', () => {
            const mockTrainState = {
                findBerth: jest.fn().mockReturnValue({
                    isAvailableForSegment: jest.fn().mockReturnValue(true)
                })
            };

            const result = ValidationService.validateJourneySegment(mockTrainState, 'S1', 15, 0, 3);

            expect(result.valid).toBe(true);
        });

        it('should return invalid when berth not found', () => {
            const mockTrainState = {
                findBerth: jest.fn().mockReturnValue(null)
            };

            const result = ValidationService.validateJourneySegment(mockTrainState, 'S1', 15, 0, 3);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not found');
        });

        it('should return invalid when segment overlaps', () => {
            const mockTrainState = {
                findBerth: jest.fn().mockReturnValue({
                    isAvailableForSegment: jest.fn().mockReturnValue(false)
                })
            };

            const result = ValidationService.validateJourneySegment(mockTrainState, 'S1', 15, 0, 3);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('overlaps');
        });

        it('should handle errors gracefully', () => {
            const mockTrainState = {
                findBerth: jest.fn().mockImplementation(() => {
                    throw new Error('DB error');
                })
            };

            const result = ValidationService.validateJourneySegment(mockTrainState, 'S1', 15, 0, 3);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('DB error');
        });
    });

    describe('validateRACEligibility', () => {
        it('should validate eligible RAC passenger', () => {
            const mockTrainState = {
                findBerth: jest.fn().mockReturnValue({
                    isAvailableForSegment: jest.fn().mockReturnValue(true)
                })
            };
            const racPassenger = { class: 'SL', fromIdx: 0, toIdx: 3 };
            const vacantBerth = { class: 'SL', coachNo: 'S1', berthNo: 15 };

            const result = ValidationService.validateRACEligibility(mockTrainState, racPassenger, vacantBerth);

            expect(result.eligible).toBe(true);
        });

        it('should return ineligible for class mismatch', () => {
            const racPassenger = { class: 'SL' };
            const vacantBerth = { class: 'AC' };

            const result = ValidationService.validateRACEligibility({}, racPassenger, vacantBerth);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Class mismatch');
        });

        it('should return ineligible when berth not found', () => {
            const mockTrainState = {
                findBerth: jest.fn().mockReturnValue(null)
            };
            const racPassenger = { class: 'SL', fromIdx: 0, toIdx: 3 };
            const vacantBerth = { class: 'SL', coachNo: 'S1', berthNo: 15 };

            const result = ValidationService.validateRACEligibility(mockTrainState, racPassenger, vacantBerth);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('not found');
        });

        it('should return ineligible when segment not available', () => {
            const mockTrainState = {
                findBerth: jest.fn().mockReturnValue({
                    isAvailableForSegment: jest.fn().mockReturnValue(false)
                })
            };
            const racPassenger = { class: 'SL', fromIdx: 0, toIdx: 3 };
            const vacantBerth = { class: 'SL', coachNo: 'S1', berthNo: 15 };

            const result = ValidationService.validateRACEligibility(mockTrainState, racPassenger, vacantBerth);

            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('not available');
        });
    });

    describe('validatePNR', () => {
        it('should validate correct 10-digit PNR', () => {
            const result = ValidationService.validatePNR('1234567890');
            expect(result.valid).toBe(true);
        });

        it('should validate 12-digit PNR', () => {
            const result = ValidationService.validatePNR('123456789012');
            expect(result.valid).toBe(true);
        });

        it('should reject empty PNR', () => {
            const result = ValidationService.validatePNR('');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('required');
        });

        it('should reject null PNR', () => {
            const result = ValidationService.validatePNR(null);
            expect(result.valid).toBe(false);
        });

        it('should reject short PNR', () => {
            const result = ValidationService.validatePNR('12345');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('10-12');
        });

        it('should reject long PNR', () => {
            const result = ValidationService.validatePNR('1234567890123');
            expect(result.valid).toBe(false);
        });

        it('should reject non-numeric PNR', () => {
            const result = ValidationService.validatePNR('ABC1234567');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('digits');
        });

        it('should handle numeric input', () => {
            const result = ValidationService.validatePNR(1234567890);
            expect(result.valid).toBe(true);
        });

        it('should trim whitespace', () => {
            const result = ValidationService.validatePNR('  1234567890  ');
            expect(result.valid).toBe(true);
        });
    });

    describe('validateStationIndex', () => {
        const mockTrainState = { stations: [{}, {}, {}, {}] };

        it('should validate correct station index', () => {
            const result = ValidationService.validateStationIndex(mockTrainState, 2);
            expect(result.valid).toBe(true);
        });

        it('should reject non-number index', () => {
            const result = ValidationService.validateStationIndex(mockTrainState, '2');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('must be a number');
        });

        it('should reject negative index', () => {
            const result = ValidationService.validateStationIndex(mockTrainState, -1);
            expect(result.valid).toBe(false);
        });

        it('should reject index >= stations length', () => {
            const result = ValidationService.validateStationIndex(mockTrainState, 5);
            expect(result.valid).toBe(false);
        });

        it('should accept index 0', () => {
            const result = ValidationService.validateStationIndex(mockTrainState, 0);
            expect(result.valid).toBe(true);
        });

        it('should accept last valid index', () => {
            const result = ValidationService.validateStationIndex(mockTrainState, 3);
            expect(result.valid).toBe(true);
        });
    });

    describe('validateJourney', () => {
        it('should validate correct journey', () => {
            const result = ValidationService.validateJourney(0, 3, 5);
            expect(result.valid).toBe(true);
        });

        it('should reject non-number fromIdx', () => {
            const result = ValidationService.validateJourney('0', 3, 5);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('must be numbers');
        });

        it('should reject non-number toIdx', () => {
            const result = ValidationService.validateJourney(0, '3', 5);
            expect(result.valid).toBe(false);
        });

        it('should reject negative fromIdx', () => {
            const result = ValidationService.validateJourney(-1, 3, 5);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('cannot be negative');
        });

        it('should reject negative toIdx', () => {
            const result = ValidationService.validateJourney(0, -1, 5);
            expect(result.valid).toBe(false);
        });

        it('should reject fromIdx >= totalStations', () => {
            const result = ValidationService.validateJourney(5, 6, 5);
            expect(result.valid).toBe(false);
        });

        it('should reject toIdx >= totalStations', () => {
            const result = ValidationService.validateJourney(0, 5, 5);
            expect(result.valid).toBe(false);
        });

        it('should reject fromIdx >= toIdx', () => {
            const result = ValidationService.validateJourney(3, 3, 5);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('must be after');
        });

        it('should reject fromIdx > toIdx', () => {
            const result = ValidationService.validateJourney(3, 1, 5);
            expect(result.valid).toBe(false);
        });
    });

    describe('validateTrainInitialized', () => {
        it('should validate initialized train', () => {
            const mockTrainState = {
                stations: [{}],
                coaches: [{}]
            };
            const result = ValidationService.validateTrainInitialized(mockTrainState);
            expect(result.valid).toBe(true);
        });

        it('should reject null train state', () => {
            const result = ValidationService.validateTrainInitialized(null);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not initialized');
        });

        it('should reject train without stations', () => {
            const result = ValidationService.validateTrainInitialized({ coaches: [{}] });
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('stations');
        });

        it('should reject train with empty stations', () => {
            const result = ValidationService.validateTrainInitialized({ stations: [], coaches: [{}] });
            expect(result.valid).toBe(false);
        });

        it('should reject train without coaches', () => {
            const result = ValidationService.validateTrainInitialized({ stations: [{}] });
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('coaches');
        });

        it('should reject train with empty coaches', () => {
            const result = ValidationService.validateTrainInitialized({ stations: [{}], coaches: [] });
            expect(result.valid).toBe(false);
        });
    });

    describe('validateJourneyStarted', () => {
        it('should validate when journey started', () => {
            const mockTrainState = { journeyStarted: true };
            const result = ValidationService.validateJourneyStarted(mockTrainState);
            expect(result.valid).toBe(true);
        });

        it('should reject when journey not started', () => {
            const mockTrainState = { journeyStarted: false };
            const result = ValidationService.validateJourneyStarted(mockTrainState);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not started');
        });
    });

    describe('validateJourneyNotComplete', () => {
        it('should validate when journey not complete', () => {
            const mockTrainState = {
                isJourneyComplete: jest.fn().mockReturnValue(false)
            };
            const result = ValidationService.validateJourneyNotComplete(mockTrainState);
            expect(result.valid).toBe(true);
        });

        it('should reject when journey is complete', () => {
            const mockTrainState = {
                isJourneyComplete: jest.fn().mockReturnValue(true)
            };
            const result = ValidationService.validateJourneyNotComplete(mockTrainState);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('complete');
        });
    });
});
