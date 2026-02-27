/**
 * InAppNotificationService Tests - Comprehensive Coverage
 * Tests for MongoDB-backed in-app notification service
 */

const InAppNotificationService = require('../../services/InAppNotificationService');

jest.mock('../../config/db');
const db = require('../../config/db');

describe('InAppNotificationService - Comprehensive Tests', () => {
    let mockCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCollection = {
            insertOne: jest.fn().mockResolvedValue({ insertedId: 'test-id' }),
            find: jest.fn().mockReturnThis(),
            findOne: jest.fn(),
            updateOne: jest.fn(),
            updateMany: jest.fn(),
            deleteOne: jest.fn(),
            deleteMany: jest.fn(),
            countDocuments: jest.fn(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            toArray: jest.fn().mockResolvedValue([])
        };

        db.getDb.mockResolvedValue({
            collection: jest.fn().mockReturnValue(mockCollection)
        });
    });

    describe('createNotification', () => {
        it('should create notification successfully', async () => {
            const result = await InAppNotificationService.createNotification(
                'IR123',
                'NO_SHOW_MARKED',
                { pnr: 'P001', berth: 'S1-15' }
            );

            expect(result).toBeDefined();
            expect(result.irctcId).toBe('IR123');
            expect(result.type).toBe('NO_SHOW_MARKED');
            expect(result.read).toBe(false);
            expect(mockCollection.insertOne).toHaveBeenCalled();
        });

        it('should return null when irctcId not provided', async () => {
            const result = await InAppNotificationService.createNotification(
                null,
                'UPGRADE_OFFER',
                { data: 'test' }
            );

            expect(result).toBeNull();
            expect(mockCollection.insertOne).not.toHaveBeenCalled();
        });

        it('should create notification with correct structure', async () => {
            await InAppNotificationService.createNotification(
                'IR123',
                'UPGRADE_OFFER',
                { berth: 'S1-20' }
            );

            const callArgs = mockCollection.insertOne.mock.calls[0][0];
            expect(callArgs).toMatchObject({
                irctcId: 'IR123',
                type: 'UPGRADE_OFFER',
                data: { berth: 'S1-20' },
                read: false
            });
            expect(callArgs.id).toBeDefined();
            expect(callArgs.createdAt).toBeInstanceOf(Date);
        });

        it('should handle different notification types', async () => {
            const types = ['NO_SHOW_MARKED', 'UPGRADE_OFFER', 'NO_SHOW_REVERTED'];

            for (const type of types) {
                await InAppNotificationService.createNotification('IR123', type, {});
                const callArgs = mockCollection.insertOne.mock.calls[mockCollection.insertOne.mock.calls.length - 1][0];
                expect(callArgs.type).toBe(type);
            }
        });
    });

    describe('getNotifications', () => {
        it('should get notifications without limit', async () => {
            const mockNotifications = [
                { id: 'N1', irctcId: 'IR123', type: 'UPGRADE_OFFER', read: false },
                { id: 'N2', irctcId: 'IR123', type: 'NO_SHOW_MARKED', read: true }
            ];
            mockCollection.toArray.mockResolvedValue(mockNotifications);

            const result = await InAppNotificationService.getNotifications('IR123');

            expect(result).toEqual(mockNotifications);
            expect(mockCollection.find).toHaveBeenCalledWith({ irctcId: 'IR123' });
            expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: -1 });
        });

        it('should get notifications with limit', async () => {
            mockCollection.toArray.mockResolvedValue([]);

            await InAppNotificationService.getNotifications('IR123', 5);

            expect(mockCollection.limit).toHaveBeenCalledWith(5);
        });

        it('should return empty array when no notifications', async () => {
            mockCollection.toArray.mockResolvedValue([]);

            const result = await InAppNotificationService.getNotifications('IR123');

            expect(result).toEqual([]);
        });
    });

    describe('getUnreadNotifications', () => {
        it('should get only unread notifications', async () => {
            const mockUnread = [
                { id: 'N1', irctcId: 'IR123', read: false }
            ];
            mockCollection.toArray.mockResolvedValue(mockUnread);

            const result = await InAppNotificationService.getUnreadNotifications('IR123');

            expect(result).toEqual(mockUnread);
            expect(mockCollection.find).toHaveBeenCalledWith({ irctcId: 'IR123', read: false });
        });
    });

    describe('getUnreadCount', () => {
        it('should return unread count', async () => {
            mockCollection.countDocuments.mockResolvedValue(3);

            const count = await InAppNotificationService.getUnreadCount('IR123');

            expect(count).toBe(3);
            expect(mockCollection.countDocuments).toHaveBeenCalledWith({ irctcId: 'IR123', read: false });
        });

        it('should return 0 when no unread notifications', async () => {
            mockCollection.countDocuments.mockResolvedValue(0);

            const count = await InAppNotificationService.getUnreadCount('IR123');

            expect(count).toBe(0);
        });
    });

    describe('markAsRead', () => {
        it('should mark notification as read', async () => {
            const mockNotification = {
                id: 'N001',
                irctcId: 'IR123',
                type: 'UPGRADE_OFFER',
                read: false
            };
            mockCollection.findOne.mockResolvedValue(mockNotification);
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

            const result = await InAppNotificationService.markAsRead('IR123', 'N001');

            expect(result.read).toBe(true);
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { id: 'N001' },
                { $set: { read: true, readAt: expect.any(Date) } }
            );
        });

        it('should throw error when notification not found', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            await expect(
                InAppNotificationService.markAsRead('IR123', 'INVALID')
            ).rejects.toThrow('Notification not found');
        });
    });

    describe('markAllAsRead', () => {
        it('should mark all notifications as read', async () => {
            mockCollection.updateMany.mockResolvedValue({ modifiedCount: 5 });

            const count = await InAppNotificationService.markAllAsRead('IR123');

            expect(count).toBe(5);
            expect(mockCollection.updateMany).toHaveBeenCalledWith(
                { irctcId: 'IR123', read: false },
                { $set: { read: true, readAt: expect.any(Date) } }
            );
        });

        it('should return 0 when no unread notifications', async () => {
            mockCollection.updateMany.mockResolvedValue({ modifiedCount: 0 });

            const count = await InAppNotificationService.markAllAsRead('IR123');

            expect(count).toBe(0);
        });
    });

    describe('deleteNotification', () => {
        it('should delete notification successfully', async () => {
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

            const result = await InAppNotificationService.deleteNotification('IR123', 'N001');

            expect(result).toBe(true);
            expect(mockCollection.deleteOne).toHaveBeenCalledWith({ irctcId: 'IR123', id: 'N001' });
        });

        it('should throw error when notification not found', async () => {
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

            await expect(
                InAppNotificationService.deleteNotification('IR123', 'INVALID')
            ).rejects.toThrow('Notification not found');
        });
    });

    describe('clearAllNotifications', () => {
        it('should clear all notifications for user', async () => {
            mockCollection.deleteMany.mockResolvedValue({ deletedCount: 10 });

            const result = await InAppNotificationService.clearAllNotifications('IR123');

            expect(result).toBe(true);
            expect(mockCollection.deleteMany).toHaveBeenCalledWith({ irctcId: 'IR123' });
        });
    });

    describe('getStats', () => {
        it('should return notification statistics', async () => {
            mockCollection.countDocuments
                .mockResolvedValueOnce(10)
                .mockResolvedValueOnce(3)
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(5)
                .mockResolvedValueOnce(3);

            const stats = await InAppNotificationService.getStats('IR123');

            expect(stats).toEqual({
                total: 10,
                unread: 3,
                read: 7,
                byType: {
                    NO_SHOW_MARKED: 2,
                    UPGRADE_OFFER: 5,
                    NO_SHOW_REVERTED: 3
                }
            });
        });

        it('should handle zero notifications', async () => {
            mockCollection.countDocuments.mockResolvedValue(0);

            const stats = await InAppNotificationService.getStats('IR123');

            expect(stats.total).toBe(0);
            expect(stats.unread).toBe(0);
            expect(stats.read).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty irctcId string', async () => {
            const result = await InAppNotificationService.createNotification('', 'TEST', {});

            expect(result).toBeNull();
        });

        it('should handle database errors gracefully', async () => {
            mockCollection.insertOne.mockRejectedValue(new Error('DB error'));

            await expect(
                InAppNotificationService.createNotification('IR123', 'TEST', {})
            ).rejects.toThrow('DB error');
        });

        it('should handle multiple simultaneous reads', async () => {
            mockCollection.findOne.mockResolvedValue({ id: 'N1', irctcId: 'IR123', read: false });
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

            const promises = [
                InAppNotificationService.markAsRead('IR123', 'N1'),
                InAppNotificationService.markAsRead('IR123', 'N1')
            ];

            const results = await Promise.all(promises);
            expect(results).toHaveLength(2);
        });
    });
});
