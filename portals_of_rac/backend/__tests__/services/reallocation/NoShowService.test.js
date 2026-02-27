/**
 * NoShowService Tests - Comprehensive Coverage
 * Tests for marking passengers as no-show and berth deallocation
 */

const NoShowService = require('../../../services/reallocation/NoShowService');

jest.mock('../../../config/db');
jest.mock('../../../config/websocket');

const db = require('../../../config/db');
const wsManager = require('../../../config/websocket');

describe('NoShowService - Comprehensive Tests', () => {
    let mockTrainState;
    let mockPassengersCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockPassengersCollection = {
            updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
        };

        db.getPassengersCollection.mockReturnValue(mockPassengersCollection);

        mockTrainState = {
            findPassenger: jest.fn(),
            logEvent: jest.fn(),
            stats: {
                totalNoShow: 0,
                racNoShow: 0
            }
        };
    });

    describe('markNoShow', () => {
        it('should mark passenger as no-show successfully', async () => {
            const mockPassenger = {
                pnr: 'P001',
                name: 'John Doe',
                from: 'Station A',
                to: 'Station C',
                fromIdx: 0,
                toIdx: 3,
                boarded: false,
                noShow: false,
                pnrStatus: 'CNF'
            };

            const mockBerth = {
                fullBerthNo: 'S1-15',
                segmentOccupancy: ['P001', 'P001', 'P001', null],
                updateStatus: jest.fn()
            };

            mockTrainState.findPassenger.mockReturnValue({
                passenger: mockPassenger,
                berth: mockBerth,
                coachNo: 'S1'
            });

            const result = await NoShowService.markNoShow(mockTrainState, 'P001');

            expect(result.success).toBe(true);
            expect(result.passenger.pnr).toBe('P001');
            expect(mockPassenger.noShow).toBe(true);
            expect(mockBerth.updateStatus).toHaveBeenCalled();
            expect(mockPassengersCollection.updateOne).toHaveBeenCalledWith(
                { PNR_Number: 'P001' },
                { $set: { NO_show: true } }
            );
        });

        it('should throw error when passenger not found', async () => {
            mockTrainState.findPassenger.mockReturnValue(null);

            await expect(
                NoShowService.markNoShow(mockTrainState, 'P999')
            ).rejects.toThrow();
        });

        it('should throw error when passenger already boarded', async () => {
            const mockPassenger = {
                pnr: 'P001',
                boarded: true,
                noShow: false
            };

            mockTrainState.findPassenger.mockReturnValue({
                passenger: mockPassenger,
                berth: {},
                coachNo: 'S1'
            });

            await expect(
                NoShowService.markNoShow(mockTrainState, 'P001')
            ).rejects.toThrow();
        });

        it('should throw error when passenger already marked as no-show', async () => {
            const mockPassenger = {
                pnr: 'P001',
                boarded: false,
                noShow: true
            };

            mockTrainState.findPassenger.mockReturnValue({
                passenger: mockPassenger,
                berth: {},
                coachNo: 'S1'
            });

            await expect(
                NoShowService.markNoShow(mockTrainState, 'P001')
            ).rejects.toThrow();
        });

        it('should clear segment occupancy for passenger journey', async () => {
            const mockPassenger = {
                pnr: 'P001',
                name: 'John',
                from: 'A',
                to: 'C',
                fromIdx: 1,
                toIdx: 4,
                boarded: false,
                noShow: false
            };

            const mockBerth = {
                fullBerthNo: 'S1-15',
                segmentOccupancy: ['P002', 'P001', 'P001', 'P001', 'P003'],
                updateStatus: jest.fn()
            };

            mockTrainState.findPassenger.mockReturnValue({
                passenger: mockPassenger,
                berth: mockBerth,
                coachNo: 'S1'
            });

            await NoShowService.markNoShow(mockTrainState, 'P001');

            expect(mockBerth.segmentOccupancy[1]).toBeNull();
            expect(mockBerth.segmentOccupancy[2]).toBeNull();
            expect(mockBerth.segmentOccupancy[3]).toBeNull();
            expect(mockBerth.segmentOccupancy[0]).toBe('P002');
            expect(mockBerth.segmentOccupancy[4]).toBe('P003');
        });

        it('should log no-show event', async () => {
            const mockPassenger = {
                pnr: 'P001',
                name: 'John Doe',
                from: 'Station A',
                to: 'Station C',
                fromIdx: 0,
                toIdx: 3,
                boarded: false,
                noShow: false
            };

            const mockBerth = {
                fullBerthNo: 'S1-15',
                segmentOccupancy: ['P001', 'P001', 'P001'],
                updateStatus: jest.fn()
            };

            mockTrainState.findPassenger.mockReturnValue({
                passenger: mockPassenger,
                berth: mockBerth,
                coachNo: 'S1'
            });

            await NoShowService.markNoShow(mockTrainState, 'P001');

            expect(mockTrainState.logEvent).toHaveBeenCalledWith(
                'NO_SHOW',
                expect.any(String),
                expect.objectContaining({
                    pnr: 'P001',
                    name: 'John Doe'
                })
            );
        });

        it('should handle database update errors gracefully', async () => {
            const mockPassenger = {
                pnr: 'P001',
                name: 'John',
                from: 'A',
                to: 'C',
                fromIdx: 0,
                toIdx: 3,
                boarded: false,
                noShow: false
            };

            const mockBerth = {
                fullBerthNo: 'S1-15',
                segmentOccupancy: ['P001', 'P001', 'P001'],
                updateStatus: jest.fn()
            };

            mockTrainState.findPassenger.mockReturnValue({
                passenger: mockPassenger,
                berth: mockBerth,
                coachNo: 'S1'
            });

            mockPassengersCollection.updateOne.mockRejectedValue(new Error('DB error'));

            await expect(
                NoShowService.markNoShow(mockTrainState, 'P001')
            ).rejects.toThrow('DB error');
        });

        it('should return passenger details in result', async () => {
            const mockPassenger = {
                pnr: 'P001',
                name: 'John Doe',
                from: 'Station A',
                to: 'Station C',
                fromIdx: 0,
                toIdx: 3,
                boarded: false,
                noShow: false
            };

            const mockBerth = {
                fullBerthNo: 'S1-15',
                segmentOccupancy: ['P001', 'P001', 'P001'],
                updateStatus: jest.fn()
            };

            mockTrainState.findPassenger.mockReturnValue({
                passenger: mockPassenger,
                berth: mockBerth,
                coachNo: 'S1'
            });

            const result = await NoShowService.markNoShow(mockTrainState, 'P001');

            expect(result.passenger).toEqual({
                pnr: 'P001',
                name: 'John Doe',
                from: 'Station A',
                to: 'Station C',
                coach: 'S1',
                berth: 'S1-15'
            });
        });

        it('should only clear segments for passenger PNR', async () => {
            const mockPassenger = {
                pnr: 'P001',
                fromIdx: 1,
                toIdx: 3,
                boarded: false,
                noShow: false
            };

            const mockBerth = {
                fullBerthNo: 'S1-15',
                segmentOccupancy: ['P001', 'P001', 'P002', 'P002'],
                updateStatus: jest.fn()
            };

            mockTrainState.findPassenger.mockReturnValue({
                passenger: mockPassenger,
                berth: mockBerth,
                coachNo: 'S1'
            });

            await NoShowService.markNoShow(mockTrainState, 'P001');

            expect(mockBerth.segmentOccupancy[1]).toBeNull();
            expect(mockBerth.segmentOccupancy[2]).toBe('P002');
            expect(mockBerth.segmentOccupancy[3]).toBe('P002');
        });
    });

    describe('Error Handling', () => {
        it('should handle findPassenger throwing error', async () => {
            mockTrainState.findPassenger.mockImplementation(() => {
                throw new Error('TrainState error');
            });

            await expect(
                NoShowService.markNoShow(mockTrainState, 'P001')
            ).rejects.toThrow('TrainState error');
        });

        it('should handle null berth gracefully', async () => {
            const mockPassenger = {
                pnr: 'P001',
                fromIdx: 0,
                toIdx: 3,
                boarded: false,
                noShow: false
            };

            mockTrainState.findPassenger.mockReturnValue({
                passenger: mockPassenger,
                berth: null,
                coachNo: 'S1'
            });

            await expect(
                NoShowService.markNoShow(mockTrainState, 'P001')
            ).rejects.toThrow();
        });
    });
});
