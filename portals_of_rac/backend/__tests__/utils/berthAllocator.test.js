/**
 * BerthAllocator Utility Tests
 */

const BerthAllocator = require('../../utils/berthAllocator');

describe('BerthAllocator', () => {
    describe('getSideLowerBerths', () => {
        it('should return SL side lower berths', () => {
            const berths = BerthAllocator.getSideLowerBerths('SL');
            expect(berths).toEqual([7, 15, 23, 31, 39, 47, 55, 63, 71]);
        });

        it('should return AC 3-tier side lower berths', () => {
            const berths = BerthAllocator.getSideLowerBerths('AC_3_Tier');
            expect(berths).toEqual([7, 15, 23, 31, 39, 47, 55, 63]);
        });

        it('should default to SL class', () => {
            const berths = BerthAllocator.getSideLowerBerths();
            expect(berths.length).toBe(9);
        });
    });

    describe('isSideLowerBerth', () => {
        it('should identify SL side lower berth', () => {
            expect(BerthAllocator.isSideLowerBerth(7, 'SL')).toBe(true);
            expect(BerthAllocator.isSideLowerBerth(71, 'SL')).toBe(true);
        });

        it('should reject non-side-lower berth', () => {
            expect(BerthAllocator.isSideLowerBerth(1, 'SL')).toBe(false);
            expect(BerthAllocator.isSideLowerBerth(10, 'SL')).toBe(false);
        });

        it('should identify AC 3-tier side lower', () => {
            expect(BerthAllocator.isSideLowerBerth(7, 'AC_3_Tier')).toBe(true);
            expect(BerthAllocator.isSideLowerBerth(63, 'AC_3_Tier')).toBe(true);
        });
    });

    describe('getBerthPriority', () => {
        it('should return correct priorities', () => {
            expect(BerthAllocator.getBerthPriority('Lower Berth')).toBe(1);
            expect(BerthAllocator.getBerthPriority('Side Lower')).toBe(2);
            expect(BerthAllocator.getBerthPriority('Middle Berth')).toBe(3);
            expect(BerthAllocator.getBerthPriority('Upper Berth')).toBe(4);
            expect(BerthAllocator.getBerthPriority('Side Upper')).toBe(5);
        });

        it('should return 99 for unknown type', () => {
            expect(BerthAllocator.getBerthPriority('Unknown')).toBe(99);
        });
    });

    describe('sortBerthsByPriority', () => {
        it('should sort berths by priority', () => {
            const berths = [
                { type: 'Upper Berth' },
                { type: 'Lower Berth' },
                { type: 'Middle Berth' }
            ];

            const sorted = BerthAllocator.sortBerthsByPriority(berths);
            expect(sorted[0].type).toBe('Lower Berth');
            expect(sorted[2].type).toBe('Upper Berth');
        });
    });

    describe('parseBerthNotation', () => {
        it('should parse berth notation', () => {
            const result = BerthAllocator.parseBerthNotation('S1-15');
            expect(result).toEqual({ coach: 'S1', seat: '15' });
        });

        it('should parse AC coach notation', () => {
            const result = BerthAllocator.parseBerthNotation('A1-7');
            expect(result).toEqual({ coach: 'A1', seat: '7' });
        });
    });

    describe('calculateTotalBerths', () => {
        it('should calculate SL total berths', () => {
            expect(BerthAllocator.calculateTotalBerths(10, 72)).toBe(720);
        });

        it('should calculate AC total berths', () => {
            expect(BerthAllocator.calculateTotalBerths(5, 64)).toBe(320);
        });
    });

    describe('getBerthTypeFromSeatNo', () => {
        it('should identify SL lower berth', () => {
            expect(BerthAllocator.getBerthTypeFromSeatNo(1, 'SL')).toBe('Lower Berth');
            expect(BerthAllocator.getBerthTypeFromSeatNo(4, 'SL')).toBe('Lower Berth');
        });

        it('should identify SL middle berth', () => {
            expect(BerthAllocator.getBerthTypeFromSeatNo(2, 'SL')).toBe('Middle Berth');
        });

        it('should identify SL upper berth', () => {
            expect(BerthAllocator.getBerthTypeFromSeatNo(3, 'SL')).toBe('Upper Berth');
        });

        it('should identify SL side lower', () => {
            expect(BerthAllocator.getBerthTypeFromSeatNo(7, 'SL')).toBe('Side Lower');
        });

        it('should identify SL side upper', () => {
            expect(BerthAllocator.getBerthTypeFromSeatNo(8, 'SL')).toBe('Side Upper');
        });

        it('should identify AC 3-tier berths', () => {
            expect(BerthAllocator.getBerthTypeFromSeatNo(1, 'AC_3_Tier')).toBe('Lower Berth');
            expect(BerthAllocator.getBerthTypeFromSeatNo(7, 'AC_3_Tier')).toBe('Side Lower');
        });

        it('should default to lower berth for unknown', () => {
            expect(BerthAllocator.getBerthTypeFromSeatNo(999, 'SL')).toBe('Lower Berth');
        });
    });

    describe('canAccommodateRAC', () => {
        it('should allow RAC on side lower with space', () => {
            const berth = { berthNo: 7, passengers: [] };
            expect(BerthAllocator.canAccommodateRAC(berth, 'SL')).toBe(true);
        });

        it('should reject RAC when full', () => {
            const berth = { berthNo: 7, passengers: ['P1', 'P2'] };
            expect(BerthAllocator.canAccommodateRAC(berth, 'SL')).toBe(false);
        });

        it('should reject RAC on non-side-lower', () => {
            const berth = { berthNo: 1, passengers: [] };
            expect(BerthAllocator.canAccommodateRAC(berth, 'SL')).toBe(false);
        });
    });

    describe('getCompartmentNumber', () => {
        it('should calculate compartment number', () => {
            expect(BerthAllocator.getCompartmentNumber(1)).toBe(1);
            expect(BerthAllocator.getCompartmentNumber(8)).toBe(1);
            expect(BerthAllocator.getCompartmentNumber(9)).toBe(2);
            expect(BerthAllocator.getCompartmentNumber(16)).toBe(2);
            expect(BerthAllocator.getCompartmentNumber(17)).toBe(3);
        });
    });

    describe('areBerthsInSameCompartment', () => {
        it('should identify same compartment', () => {
            expect(BerthAllocator.areBerthsInSameCompartment(1, 5)).toBe(true);
            expect(BerthAllocator.areBerthsInSameCompartment(9, 16)).toBe(true);
        });

        it('should identify different compartments', () => {
            expect(BerthAllocator.areBerthsInSameCompartment(1, 9)).toBe(false);
            expect(BerthAllocator.areBerthsInSameCompartment(8, 17)).toBe(false);
        });
    });

    describe('getBerthsInCompartment', () => {
        it('should return all berths in compartment 1', () => {
            const berths = BerthAllocator.getBerthsInCompartment(1);
            expect(berths).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        });

        it('should return all berths in compartment 2', () => {
            const berths = BerthAllocator.getBerthsInCompartment(2);
            expect(berths).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
        });
    });

    describe('validateBerthAllocation', () => {
        it('should validate correct allocation', () => {
            const berth = {
                isAvailableForSegment: jest.fn().mockReturnValue(true)
            };
            const passenger = { class: 'SL', fromIdx: 0, toIdx: 2 };
            const trainState = {
                getCoachClassFromBerth: jest.fn().mockReturnValue('SL')
            };

            const result = BerthAllocator.validateBerthAllocation(berth, passenger, trainState);
            expect(result.valid).toBe(true);
        });

        it('should reject class mismatch', () => {
            const berth = {
                isAvailableForSegment: jest.fn().mockReturnValue(true)
            };
            const passenger = { class: 'AC_3_Tier', fromIdx: 0, toIdx: 2 };
            const trainState = {
                getCoachClassFromBerth: jest.fn().mockReturnValue('SL')
            };

            const result = BerthAllocator.validateBerthAllocation(berth, passenger, trainState);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('mismatch');
        });

        it('should reject unavailable segment', () => {
            const berth = {
                isAvailableForSegment: jest.fn().mockReturnValue(false)
            };
            const passenger = { class: 'SL', fromIdx: 0, toIdx: 2 };
            const trainState = {
                getCoachClassFromBerth: jest.fn().mockReturnValue('SL')
            };

            const result = BerthAllocator.validateBerthAllocation(berth, passenger, trainState);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not available');
        });
    });

    describe('findOptimalBerth', () => {
        it('should find optimal berth', () => {
            const berths = [
                { type: 'Upper Berth' },
                { type: 'Lower Berth' },
                { type: 'Middle Berth' }
            ];

            const optimal = BerthAllocator.findOptimalBerth(berths, {});
            expect(optimal.type).toBe('Lower Berth');
        });

        it('should filter by preferred type', () => {
            const berths = [
                { type: 'Upper Berth' },
                { type: 'Lower Berth' },
                { type: 'Middle Berth' }
            ];

            const optimal = BerthAllocator.findOptimalBerth(berths, {}, 'Middle Berth');
            expect(optimal.type).toBe('Middle Berth');
        });

        it('should return null if no berths available', () => {
            const optimal = BerthAllocator.findOptimalBerth([], {});
            expect(optimal).toBeNull();
        });
    });

    describe('getAvailableRACBerths', () => {
        it('should filter RAC berths', () => {
            const coach = {
                class: 'SL',
                berths: [
                    { berthNo: 7, status: 'VACANT' },
                    { berthNo: 15, status: 'OCCUPIED' },
                    { berthNo: 1, status: 'VACANT' }
                ]
            };

            const racBerths = BerthAllocator.getAvailableRACBerths(coach);
            expect(racBerths.length).toBe(2);
            expect(racBerths[0].berthNo).toBe(7);
        });
    });
});

// 35 tests for berthAllocator
