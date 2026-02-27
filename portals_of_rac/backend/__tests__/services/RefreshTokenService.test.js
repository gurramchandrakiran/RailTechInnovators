/**
 * RefreshTokenService Tests - Comprehensive Coverage
 * Tests for MongoDB-backed refresh token management
 */

const RefreshTokenService = require('../../services/RefreshTokenService');
const db = require('../../config/db');

jest.mock('../../config/db');

describe('RefreshTokenService - Comprehensive Tests', () => {
    let mockCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCollection = {
            insertOne: jest.fn().mockResolvedValue({ insertedId: 'token-id' }),
            findOne: jest.fn(),
            updateOne: jest.fn(),
            updateMany: jest.fn()
        };

        db.getDb.mockResolvedValue({
            collection: jest.fn().mockReturnValue(mockCollection)
        });
    });

    describe('createRefreshToken', () => {
        it('should create refresh token successfully', async () => {
            const token = await RefreshTokenService.createRefreshToken('user123', 'PASSENGER');

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.length).toBeGreaterThan(0);
            expect(mockCollection.insertOne).toHaveBeenCalled();
        });

        it('should store token with correct structure', async () => {
            await RefreshTokenService.createRefreshToken('user123', 'ADMIN');

            const insertCall = mockCollection.insertOne.mock.calls[0][0];
            expect(insertCall).toHaveProperty('token');
            expect(insertCall).toHaveProperty('userId', 'user123');
            expect(insertCall).toHaveProperty('role', 'ADMIN');
            expect(insertCall).toHaveProperty('createdAt');
            expect(insertCall).toHaveProperty('expiresAt');
            expect(insertCall).toHaveProperty('isRevoked', false);
        });

        it('should include additional claims', async () => {
            await RefreshTokenService.createRefreshToken('user123', 'TTE', { trainNo: '17225' });

            const insertCall = mockCollection.insertOne.mock.calls[0][0];
            expect(insertCall.trainNo).toBe('17225');
        });

        it('should set expiry date 7 days in future', async () => {
            await RefreshTokenService.createRefreshToken('user123', 'PASSENGER');

            const insertCall = mockCollection.insertOne.mock.calls[0][0];
            const expiryTime = insertCall.expiresAt.getTime() - insertCall.createdAt.getTime();
            const expectedTime = 7 * 24 * 60 * 60 * 1000;
            expect(Math.abs(expiryTime - expectedTime)).toBeLessThan(1000);
        });

        it('should handle database errors', async () => {
            mockCollection.insertOne.mockRejectedValue(new Error('DB error'));

            await expect(
                RefreshTokenService.createRefreshToken('user123', 'PASSENGER')
            ).rejects.toThrow('DB error');
        });

        it('should generate unique tokens', async () => {
            const token1 = await RefreshTokenService.createRefreshToken('user1', 'PASSENGER');
            const token2 = await RefreshTokenService.createRefreshToken('user2', 'PASSENGER');

            expect(token1).not.toBe(token2);
        });
    });

    describe('validateRefreshToken', () => {
        it('should validate valid token', async () => {
            const mockToken = {
                token: 'valid-token',
                userId: 'user123',
                role: 'PASSENGER',
                expiresAt: new Date(Date.now() + 1000000),
                isRevoked: false
            };
            mockCollection.findOne.mockResolvedValue(mockToken);

            const result = await RefreshTokenService.validateRefreshToken('valid-token');

            expect(result).toEqual(mockToken);
        });

        it('should return null for expired token', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const result = await RefreshTokenService.validateRefreshToken('expired-token');

            expect(result).toBeNull();
        });

        it('should return null for revoked token', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const result = await RefreshTokenService.validateRefreshToken('revoked-token');

            expect(result).toBeNull();
        });

        it('should query with correct filters', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            await RefreshTokenService.validateRefreshToken('test-token');

            expect(mockCollection.findOne).toHaveBeenCalledWith({
                token: 'test-token',
                expiresAt: { $gt: expect.any(Date) },
                isRevoked: { $ne: true }
            });
        });

        it('should handle database errors gracefully', async () => {
            mockCollection.findOne.mockRejectedValue(new Error('DB error'));

            const result = await RefreshTokenService.validateRefreshToken('test-token');

            expect(result).toBeNull();
        });
    });

    describe('revokeRefreshToken', () => {
        it('should revoke token successfully', async () => {
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

            const result = await RefreshTokenService.revokeRefreshToken('token-to-revoke');

            expect(result).toBe(true);
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { token: 'token-to-revoke' },
                { $set: { isRevoked: true, revokedAt: expect.any(Date) } }
            );
        });

        it('should return false if token not found', async () => {
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 0 });

            const result = await RefreshTokenService.revokeRefreshToken('non-existent');

            expect(result).toBe(false);
        });

        it('should handle database errors', async () => {
            mockCollection.updateOne.mockRejectedValue(new Error('DB error'));

            const result = await RefreshTokenService.revokeRefreshToken('test-token');

            expect(result).toBe(false);
        });
    });

    describe('revokeAllUserTokens', () => {
        it('should revoke all tokens for user', async () => {
            mockCollection.updateMany.mockResolvedValue({ modifiedCount: 3 });

            const result = await RefreshTokenService.revokeAllUserTokens('user123');

            expect(result).toBe(3);
            expect(mockCollection.updateMany).toHaveBeenCalledWith(
                { userId: 'user123', isRevoked: { $ne: true } },
                { $set: { isRevoked: true, revokedAt: expect.any(Date) } }
            );
        });

        it('should return 0 if no tokens found', async () => {
            mockCollection.updateMany.mockResolvedValue({ modifiedCount: 0 });

            const result = await RefreshTokenService.revokeAllUserTokens('user123');

            expect(result).toBe(0);
        });

        it('should handle database errors', async () => {
            mockCollection.updateMany.mockRejectedValue(new Error('DB error'));

            const result = await RefreshTokenService.revokeAllUserTokens('user123');

            expect(result).toBe(0);
        });
    });

    describe('rotateRefreshToken', () => {
        it('should rotate token successfully', async () => {
            const oldToken = 'old-token-12345678';
            const mockStoredToken = {
                token: oldToken,
                userId: 'user123',
                role: 'PASSENGER',
                expiresAt: new Date(Date.now() + 1000000),
                isRevoked: false
            };

            mockCollection.findOne.mockResolvedValue(mockStoredToken);
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
            mockCollection.insertOne.mockResolvedValue({ insertedId: 'new-id' });

            const result = await RefreshTokenService.rotateRefreshToken(oldToken);

            expect(result).toBeDefined();
            expect(result.token).toBeDefined();
            expect(result.userId).toBe('user123');
            expect(result.role).toBe('PASSENGER');
        });

        it('should revoke old token during rotation', async () => {
            const oldToken = 'old-token-12345678';
            mockCollection.findOne.mockResolvedValue({
                token: oldToken,
                userId: 'user123',
                role: 'PASSENGER',
                expiresAt: new Date(Date.now() + 1000000),
                isRevoked: false
            });
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

            await RefreshTokenService.rotateRefreshToken(oldToken);

            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { token: oldToken },
                { $set: { isRevoked: true, revokedAt: expect.any(Date) } }
            );
        });

        it('should return null for invalid old token', async () => {
            mockCollection.findOne.mockResolvedValue(null);

            const result = await RefreshTokenService.rotateRefreshToken('invalid-token');

            expect(result).toBeNull();
        });

        it('should include rotation metadata in new token', async () => {
            const oldToken = 'old-token-12345678';
            mockCollection.findOne.mockResolvedValue({
                token: oldToken,
                userId: 'user123',
                role: 'PASSENGER',
                expiresAt: new Date(Date.now() + 1000000),
                isRevoked: false
            });
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

            await RefreshTokenService.rotateRefreshToken(oldToken);

            const insertCall = mockCollection.insertOne.mock.calls[0][0];
            expect(insertCall.rotatedFrom).toBe('old-toke');
        });
    });
});
