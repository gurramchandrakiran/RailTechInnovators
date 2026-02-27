/**
 * Constants Tests
 */

const constants = require('../../utils/constants');

describe('Constants', () => {
    beforeEach(() => {
        global.RAC_CONFIG = null;
    });

    describe('Train Configuration', () => {
        it('should return train number from config', () => {
            global.RAC_CONFIG = { trainNo: '17225' };
            expect(constants.getTRAIN_NO()).toBe('17225');
        });

        it('should return null if no config', () => {
            expect(constants.getTRAIN_NO()).toBeNull();
        });

        it('should return train name from config', () => {
            global.RAC_CONFIG = { trainName: 'Test Express' };
            expect(constants.getTRAIN_NAME()).toBe('Test Express');
        });

        it('should have correct coach configuration', () => {
            expect(constants.TOTAL_COACHES).toBe(9);
            expect(constants.BERTHS_PER_COACH).toBe(72);
            expect(constants.BERTHS_PER_COACH_3A).toBe(64);
        });
    });

    describe('BERTH_TYPES', () => {
        it('should have all berth types', () => {
            expect(constants.BERTH_TYPES.LOWER).toBe('Lower Berth');
            expect(constants.BERTH_TYPES.MIDDLE).toBe('Middle Berth');
            expect(constants.BERTH_TYPES.UPPER).toBe('Upper Berth');
            expect(constants.BERTH_TYPES.SIDE_LOWER).toBe('Side Lower');
            expect(constants.BERTH_TYPES.SIDE_UPPER).toBe('Side Upper');
        });
    });

    describe('BERTH_STATUS', () => {
        it('should have all berth statuses', () => {
            expect(constants.BERTH_STATUS.VACANT).toBe('VACANT');
            expect(constants.BERTH_STATUS.OCCUPIED).toBe('OCCUPIED');
            expect(constants.BERTH_STATUS.SHARED).toBe('SHARED');
        });
    });

    describe('PNR_STATUS', () => {
        it('should have all PNR statuses', () => {
            expect(constants.PNR_STATUS.CONFIRMED).toBe('CNF');
            expect(constants.PNR_STATUS.RAC).toBe('RAC');
            expect(constants.PNR_STATUS.WAITING).toBe('WL');
        });
    });

    describe('CLASS_TYPES', () => {
        it('should have all class types', () => {
            expect(constants.CLASS_TYPES.SLEEPER).toBe('SL');
            expect(constants.CLASS_TYPES.AC_3_TIER).toBe('AC_3_Tier');
            expect(constants.CLASS_TYPES.AC_2_TIER).toBe('2A');
            expect(constants.CLASS_TYPES.AC_1_TIER).toBe('1A');
            expect(constants.CLASS_TYPES.CHAIR_CAR).toBe('CC');
            expect(constants.CLASS_TYPES.SECOND_SITTING).toBe('2S');
        });
    });
});

// 13 tests
