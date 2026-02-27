/**
 * UpgradeNotificationService Tests - Comprehensive Coverage
 * Tests for MongoDB-backed upgrade notification service
 */

const UpgradeNotificationService = require('../../services/UpgradeNotificationService');

jest.mock('../../config/db');
const db = require('../../config/db');

describe('UpgradeNotificationService - Comprehensive Tests', () => {
    let mockCollection;
    let mockDenialCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCollection = {
            insertOne: jest.fn().mockResolvedValue({ insertedId: 'test-id' }),
            findOne: jest.fn(),
            find: jest.fn().mockReturnThis(),
            updateOne: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn(),
            sort: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([])
        };

        mockDenialCollection = {
            insertOne: jest.fn().mockResolvedValue({ insertedId: 'denial-id' }),
            find: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([])
        };

        db.getDb.mockResolvedValue({
            collection: jest.fn((name) => {
                if (name === 'upgrade_denial_log') return mockDenialCollection;
                return mockCollection;
            })
        });
    });

    describe('createUpgradeNotification', () => {
        it('should create upgrade notification successfully', async () => {
            mockCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });

            const racPassenger = {
                pnr: 'P001',
                name: 'John Doe',
                coach: 'RAC',
                seatNo: '15'
            };
            const vacantBerth = {
                fullBerthNo: 'S1-20',
                coachNo: 'S1',
                berthNo: '20',
                type: 'Lower',
                vacantSegment: { fromIdx: 0, toIdx: 5 }
            };
            const currentStation = { name: 'Station B', code: 'STB' };

            const result = await UpgradeNotificationService.createUpgradeNotification(
                racPassenger,
                vacantBerth,
                currentStation
            );

            expect(result).toBeDefined();
            expect(result.pnr).toBe('P001');
            expect(result.status).toBe('PENDING');
            expect(mockCollection.insertOne).toHaveBeenCalled();
        });

        it('should clear old pending notifications before creating new ones', async () => {
            mockCollection.deleteMany.mockResolvedValue({ deletedCount: 3 });

            const racPassenger = { pnr: 'P001', name: 'John', coach: 'RAC', seatNo: '15' };
            const vacantBerth = { fullBerthNo: 'S1-20', coachNo: 'S1', berthNo: '20', type: 'Lower', vacantSegment: {} };
            const currentStation = { name: 'Station B', code: 'STB' };

            await UpgradeNotificationService.createUpgradeNotification(racPassenger, vacantBerth, currentStation);

            expect(mockCollection.deleteMany).toHaveBeenCalledWith({
                stationCode: 'STB',
                status: 'PENDING'
            });
        });

        it('should skip clearing when clearOldFirst is false', async () => {
            const racPassenger = { pnr: 'P001', name: 'John', coach: 'RAC', seatNo: '15' };
            const vacantBerth = { fullBerthNo: 'S1-20', coachNo: 'S1', berthNo: '20', type: 'Lower', vacantSegment: {} };
            const currentStation = { name: 'Station B', code: 'STB' };

            await UpgradeNotificationService.createUpgradeNotification(racPassenger, vacantBerth, currentStation, false);

            expect(mockCollection.deleteMany).not.toHaveBeenCalled();
        });

        it('should create notification with correct structure', async () => {
            mockCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });

            const racPassenger = { pnr: 'P001', name: 'John', coach: 'RAC', seatNo: '15' };
            const vacantBerth = { fullBerthNo: 'S1-20', coachNo: 'S1', berthNo: '20', type: 'Lower', vacantSegment: {} };
            const currentStation = { name: 'Station B', code: 'STB' };

            await UpgradeNotificationService.createUpgradeNotification(racPassenger, vacantBerth, currentStation);

            const callArgs = mockCollection.insertOne.mock.calls[0][0];
            expect(callArgs.pnr).toBe('P001');
            expect(callArgs.name).toBe('John');
            expect(callArgs.offeredBerth).toBe('S1-20');
            expect(callArgs.status).toBe('PENDING');
            expect(callArgs.stationCode).toBe('STB');
        });
    });

    describe('clearPendingNotificationsForStation', () => {
        it('should clear pending notifications for station', async () => {
            mockCollection.deleteMany.mockResolvedValue({ deletedCount: 5 });

            const count = await UpgradeNotificationService.clearPendingNotificationsForStation('STB');

            expect(count).toBe(5);
            expect(mockCollection.deleteMany).toHaveBeenCalledWith({
                stationCode: 'STB',
                status: 'PENDING'
            });
        });

        it('should return 0 when no notifications to clear', async () => {
            mockCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });

            const count = await UpgradeNotificationService.clearPendingNotificationsForStation('STB');

            expect(count).toBe(0);
        });
    });

    describe('acceptUpgrade', () => {
        it('should accept upgrade successfully', async () => {
            const mockNotification = {
                id: 'N001',
                pnr: 'P001',
                name: 'John',
                status: 'PENDING'
            };
            mockCollection.findOne.mockResolvedValue(mockNotification);
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

            const result = await UpgradeNotificationService.acceptUpgrade('P001', 'N001');

            expect(result.status).toBe('ACCEPTED');
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { id: 'N001' },
                { $set: { status: 'ACCEPTED', acceptedAt: expect.any(String) } }
            );
        });

        it('should throw error when notification not found', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            await expect(
                UpgradeNotificationService.acceptUpgrade('P001', 'INVALID')
            ).rejects.toThrow('Notification INVALID not found for PNR P001');
        });

        it('should throw error when notification already processed', async () => {
            const mockNotification = {
                id: 'N001',
                pnr: 'P001',
                status: 'ACCEPTED'
            };
            mockCollection.findOne.mockResolvedValue(mockNotification);

            await expect(
                UpgradeNotificationService.acceptUpgrade('P001', 'N001')
            ).rejects.toThrow('Notification already ACCEPTED');
        });
    });

    describe('denyUpgrade', () => {
        it('should deny upgrade successfully', async () => {
            const mockNotification = {
                id: 'N001',
                pnr: 'P001',
                name: 'John',
                offeredBerth: 'S1-20',
                station: 'Station B',
                status: 'PENDING'
            };
            mockCollection.findOne.mockResolvedValue(mockNotification);
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
            mockDenialCollection.insertOne.mockResolvedValue({ insertedId: 'denial-id' });

            const result = await UpgradeNotificationService.denyUpgrade('P001', 'N001', 'Not suitable');

            expect(result.status).toBe('DENIED');
            expect(result.denialReason).toBe('Not suitable');
            expect(mockDenialCollection.insertOne).toHaveBeenCalled();
        });

        it('should throw error when notification not found', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            await expect(
                UpgradeNotificationService.denyUpgrade('P001', 'INVALID')
            ).rejects.toThrow('Notification INVALID not found for PNR P001');
        });

        it('should throw error when notification already processed', async () => {
            const mockNotification = {
                id: 'N001',
                pnr: 'P001',
                status: 'DENIED'
            };
            mockCollection.findOne.mockResolvedValue(mockNotification);

            await expect(
                UpgradeNotificationService.denyUpgrade('P001', 'N001')
            ).rejects.toThrow('Notification already DENIED');
        });

        it('should log denial with correct details', async () => {
            const mockNotification = {
                id: 'N001',
                pnr: 'P001',
                name: 'John Doe',
                offeredBerth: 'S1-20',
                station: 'Station B',
                status: 'PENDING'
            };
            mockCollection.findOne.mockResolvedValue(mockNotification);
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

            await UpgradeNotificationService.denyUpgrade('P001', 'N001', 'Test reason');

            const denialCallArgs = mockDenialCollection.insertOne.mock.calls[0][0];
            expect(denialCallArgs.pnr).toBe('P001');
            expect(denialCallArgs.name).toBe('John Doe');
            expect(denialCallArgs.offeredBerth).toBe('S1-20');
            expect(denialCallArgs.reason).toBe('Test reason');
        });
    });

    describe('getPendingNotifications', () => {
        it('should get pending notifications for passenger', async () => {
            const mockNotifications = [
                { id: 'N1', pnr: 'P001', status: 'PENDING' },
                { id: 'N2', pnr: 'P001', status: 'PENDING' }
            ];
            mockCollection.toArray.mockResolvedValue(mockNotifications);

            const result = await UpgradeNotificationService.getPendingNotifications('P001');

            expect(result).toEqual(mockNotifications);
            expect(mockCollection.find).toHaveBeenCalledWith({ pnr: 'P001', status: 'PENDING' });
        });
    });

    describe('getAllNotifications', () => {
        it('should get all notifications for passenger sorted by date', async () => {
            const mockNotifications = [
                { id: 'N1', pnr: 'P001', createdAt: new Date() },
                { id: 'N2', pnr: 'P001', createdAt: new Date() }
            ];
            mockCollection.toArray.mockResolvedValue(mockNotifications);

            const result = await UpgradeNotificationService.getAllNotifications('P001');

            expect(result).toEqual(mockNotifications);
            expect(mockCollection.find).toHaveBeenCalledWith({ pnr: 'P001' });
            expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: -1 });
        });
    });

    describe('clearNotifications', () => {
        it('should clear all notifications for passenger', async () => {
            mockCollection.deleteMany.mockResolvedValue({ deletedCount: 3 });

            await UpgradeNotificationService.clearNotifications('P001');

            expect(mockCollection.deleteMany).toHaveBeenCalledWith({ pnr: 'P001' });
        });
    });

    describe('getDenialLog', () => {
        it('should get denial log sorted by date', async () => {
            const mockDenials = [
                { pnr: 'P001', reason: 'Not suitable', createdAt: new Date() }
            ];
            mockDenialCollection.toArray.mockResolvedValue(mockDenials);

            const result = await UpgradeNotificationService.getDenialLog();

            expect(result).toEqual(mockDenials);
            expect(mockDenialCollection.sort).toHaveBeenCalledWith({ createdAt: -1 });
        });
    });

    describe('hasDeniedBerth', () => {
        it('should return true when berth was denied', async () => {
            mockCollection.findOne.mockResolvedValue({
                pnr: 'P001',
                offeredBerth: 'S1-20',
                status: 'DENIED'
            });

            const result = await UpgradeNotificationService.hasDeniedBerth('P001', 'S1-20');

            expect(result).toBe(true);
        });

        it('should return false when berth was not denied', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const result = await UpgradeNotificationService.hasDeniedBerth('P001', 'S1-20');

            expect(result).toBe(false);
        });
    });

    describe('getAllSentNotifications', () => {
        it('should get all sent notifications with mapped structure', async () => {
            const mockNotifications = [
                {
                    pnr: 'P001',
                    name: 'John Doe',
                    offeredBerth: 'S1-20',
                    offeredCoach: 'S1',
                    offeredSeatNo: '20',
                    offeredBerthType: 'Lower',
                    timestamp: '2024-01-01T10:00:00Z',
                    status: 'PENDING',
                    id: 'N001'
                }
            ];
            mockCollection.toArray.mockResolvedValue(mockNotifications);

            const result = await UpgradeNotificationService.getAllSentNotifications();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                pnr: 'P001',
                passengerName: 'John Doe',
                offeredBerth: 'S1-20',
                status: 'pending',
                offerId: 'N001'
            });
        });

        it('should include responded timestamp when accepted', async () => {
            const mockNotifications = [
                {
                    pnr: 'P001',
                    name: 'John',
                    offeredBerth: 'S1-20',
                    offeredCoach: 'S1',
                    offeredSeatNo: '20',
                    offeredBerthType: 'Lower',
                    timestamp: '2024-01-01T10:00:00Z',
                    status: 'ACCEPTED',
                    acceptedAt: '2024-01-01T10:05:00Z',
                    id: 'N001'
                }
            ];
            mockCollection.toArray.mockResolvedValue(mockNotifications);

            const result = await UpgradeNotificationService.getAllSentNotifications();

            expect(result[0].respondedAt).toBe('2024-01-01T10:05:00Z');
        });

        it('should include responded timestamp when denied', async () => {
            const mockNotifications = [
                {
                    pnr: 'P001',
                    name: 'John',
                    offeredBerth: 'S1-20',
                    offeredCoach: 'S1',
                    offeredSeatNo: '20',
                    offeredBerthType: 'Lower',
                    timestamp: '2024-01-01T10:00:00Z',
                    status: 'DENIED',
                    deniedAt: '2024-01-01T10:05:00Z',
                    id: 'N001'
                }
            ];
            mockCollection.toArray.mockResolvedValue(mockNotifications);

            const result = await UpgradeNotificationService.getAllSentNotifications();

            expect(result[0].respondedAt).toBe('2024-01-01T10:05:00Z');
        });
    });

    describe('Edge Cases', () => {
        it('should handle database errors in createUpgradeNotification', async () => {
            mockCollection.deleteMany.mockRejectedValue(new Error('DB error'));

            const racPassenger = { pnr: 'P001', name: 'John', coach: 'RAC', seatNo: '15' };
            const vacantBerth = { fullBerthNo: 'S1-20', coachNo: 'S1', berthNo: '20', type: 'Lower', vacantSegment: {} };
            const currentStation = { name: 'Station B', code: 'STB' };

            await expect(
                UpgradeNotificationService.createUpgradeNotification(racPassenger, vacantBerth, currentStation)
            ).rejects.toThrow('DB error');
        });

        it('should handle empty denial log', async () => {
            mockDenialCollection.toArray.mockResolvedValue([]);

            const result = await UpgradeNotificationService.getDenialLog();

            expect(result).toEqual([]);
        });
    });
});
