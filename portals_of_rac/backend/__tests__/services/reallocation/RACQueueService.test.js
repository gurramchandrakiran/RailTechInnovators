/**
 * RACQueueService Tests
 * Tests for RAC queue management
 * 
 * Actual methods (singleton):
 * - getRACQueue(trainState) - returns array of RAC passengers
 * - getBoardedOnlineRAC(trainState) - boarded + online RAC
 * - getOfflineRAC(trainState) - offline RAC
 * - searchPassenger(trainState, pnr) - returns {found, passenger/message}
 * - getRACStats(trainState) - returns stats object
 * - getRACByPriority(trainState) - grouped by RAC number
 * - addToRACQueue(trainState, passenger)
 * - removeFromRACQueue(trainState, pnr)
 */

const RACQueueService = require('../../../services/reallocation/RACQueueService');

describe('RACQueueService', () => {
    const createMockTrainState = () => ({
        currentStationIdx: 2,
        racQueue: [
            {
                pnr: '1111111111',
                name: 'RAC Passenger 1',
                pnrStatus: 'RAC',
                racStatus: 'RAC-1',
                fromIdx: 0,
                toIdx: 4,
                from: 'A',
                to: 'E',
                boarded: true,
                passengerStatus: 'online',
                noShow: false,
                class: 'SL',
                coach: 'S1',
                seat: 1
            },
            {
                pnr: '2222222222',
                name: 'RAC Passenger 2',
                pnrStatus: 'RAC',
                racStatus: 'RAC-2',
                fromIdx: 1,
                toIdx: 3,
                from: 'B',
                to: 'D',
                boarded: true,
                passengerStatus: 'offline',
                noShow: false,
                class: 'SL',
                coach: 'S1',
                seat: 1
            },
            {
                pnr: '3333333333',
                name: 'RAC Passenger 3',
                pnrStatus: 'RAC',
                racStatus: 'RAC-3',
                fromIdx: 0,
                toIdx: 4,
                from: 'A',
                to: 'E',
                boarded: false,
                passengerStatus: 'online',
                noShow: false,
                class: 'SL',
                coach: 'S1',
                seat: 2
            }
        ],
        getAllPassengers: jest.fn().mockReturnValue([]),
        findPassenger: jest.fn().mockReturnValue(null)
    });

    describe('getRACQueue', () => {
        it('should return all RAC passengers', () => {
            const trainState = createMockTrainState();
            const result = RACQueueService.getRACQueue(trainState);

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(3);
        });

        it('should include passenger details in result', () => {
            const trainState = createMockTrainState();
            const result = RACQueueService.getRACQueue(trainState);

            expect(result[0]).toHaveProperty('pnr');
            expect(result[0]).toHaveProperty('name');
            expect(result[0]).toHaveProperty('racStatus');
            expect(result[0]).toHaveProperty('boarded');
        });

        it('should return empty array for empty queue', () => {
            const trainState = { racQueue: [] };
            const result = RACQueueService.getRACQueue(trainState);

            expect(result).toHaveLength(0);
        });

        it('should handle errors gracefully', () => {
            const trainState = { racQueue: null };
            const result = RACQueueService.getRACQueue(trainState);

            expect(result).toEqual([]);
        });
    });

    describe('getRACStats', () => {
        it('should return correct RAC statistics', () => {
            const trainState = createMockTrainState();
            const result = RACQueueService.getRACStats(trainState);

            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('boarded');
            expect(result.total).toBe(3);
        });

        it('should count boarded passengers correctly', () => {
            const trainState = createMockTrainState();
            const result = RACQueueService.getRACStats(trainState);

            expect(result.boarded).toBe(2);
        });
    });

    describe('searchPassenger', () => {
        it('should find passenger in RAC queue', () => {
            const trainState = createMockTrainState();
            trainState.findPassenger = jest.fn().mockReturnValue({
                passenger: { pnr: '1111111111', name: 'RAC Passenger 1', pnrStatus: 'RAC' },
                berth: { fullBerthNo: 'S1-1' },
                coachNo: 'S1'
            });

            const result = RACQueueService.searchPassenger(trainState, '1111111111');

            expect(result.found).toBe(true);
            expect(result.passenger.pnr).toBe('1111111111');
        });

        it('should return not found for non-existent PNR', () => {
            const trainState = createMockTrainState();
            trainState.findPassenger = jest.fn().mockReturnValue(null);

            const result = RACQueueService.searchPassenger(trainState, '0000000000');

            expect(result.found).toBe(false);
            expect(result.message).toContain('not found');
        });
    });

    describe('addToRACQueue', () => {
        it('should add new passenger to RAC queue', () => {
            const trainState = createMockTrainState();
            const newPassenger = {
                pnr: '4444444444',
                name: 'New RAC Passenger',
                pnrStatus: 'RAC'
            };

            const result = RACQueueService.addToRACQueue(trainState, newPassenger);

            expect(result.success).toBe(true);
            expect(trainState.racQueue.length).toBe(4);
        });

        it('should not add duplicate passenger', () => {
            const trainState = createMockTrainState();
            const existingPassenger = { pnr: '1111111111', name: 'Duplicate' };

            const result = RACQueueService.addToRACQueue(trainState, existingPassenger);

            expect(result.success).toBe(false);
            expect(trainState.racQueue.length).toBe(3);
        });
    });

    describe('removeFromRACQueue', () => {
        it('should remove passenger from RAC queue', () => {
            const trainState = createMockTrainState();

            const result = RACQueueService.removeFromRACQueue(trainState, '1111111111');

            expect(result.success).toBe(true);
            expect(trainState.racQueue.length).toBe(2);
        });

        it('should return error if passenger not found', () => {
            const trainState = createMockTrainState();
            const result = RACQueueService.removeFromRACQueue(trainState, 'NONEXISTENT');

            expect(result.success).toBe(false);
        });

        it('should return removed passenger details', () => {
            const trainState = createMockTrainState();
            const result = RACQueueService.removeFromRACQueue(trainState, '1111111111');

            expect(result.passenger).toBeDefined();
            expect(result.passenger.pnr).toBe('1111111111');
        });

        it('should handle errors gracefully', () => {
            const trainState = { racQueue: null };
            const result = RACQueueService.removeFromRACQueue(trainState, 'P001');

            expect(result.success).toBe(false);
            expect(result.message).toBeDefined();
        });
    });

    describe('getRACByPriority', () => {
        it('should group RAC passengers by RAC number', () => {
            const trainState = createMockTrainState();
            const result = RACQueueService.getRACByPriority(trainState);

            expect(typeof result).toBe('object');
            expect(Object.keys(result).length).toBeGreaterThan(0);
        });

        it('should handle errors gracefully', () => {
            const trainState = { racQueue: null };
            const result = RACQueueService.getRACByPriority(trainState);

            expect(result).toEqual({});
        });
    });

    describe('getBoardedOnlineRAC', () => {
        it('should return only boarded and online RAC passengers', () => {
            const trainState = createMockTrainState();
            trainState.getAllPassengers = jest.fn().mockReturnValue([
                { pnr: 'P001', pnrStatus: 'RAC', boarded: true, passengerStatus: 'online', noShow: false },
                { pnr: 'P002', pnrStatus: 'RAC', boarded: false, passengerStatus: 'online', noShow: false },
                { pnr: 'P003', pnrStatus: 'RAC', boarded: true, passengerStatus: 'offline', noShow: false }
            ]);

            const result = RACQueueService.getBoardedOnlineRAC(trainState);

            expect(result).toHaveLength(1);
            expect(result[0].pnr).toBe('P001');
        });
    });

    describe('getOfflineRAC', () => {
        it('should return offline RAC passengers', () => {
            const trainState = createMockTrainState();
            trainState.getAllPassengers = jest.fn().mockReturnValue([
                { pnr: 'P001', pnrStatus: 'RAC', passengerStatus: 'offline', noShow: false },
                { pnr: 'P002', pnrStatus: 'RAC', passengerStatus: 'online', noShow: false }
            ]);

            const result = RACQueueService.getOfflineRAC(trainState);

            expect(result).toHaveLength(1);
            expect(result[0].pnr).toBe('P001');
        });
    });
});
