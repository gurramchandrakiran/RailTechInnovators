// backend/services/RefreshTokenService.js
// MongoDB-backed refresh token storage with automatic TTL expiry

const crypto = require('crypto');
const db = require('../config/db');
const { COLLECTIONS } = require('../config/collections');

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

class RefreshTokenService {
    /**
     * Create a new refresh token for a user
     * @param {string} userId - User/Employee/IRCTC ID
     * @param {string} role - User role (ADMIN, TTE, PASSENGER)
     * @param {object} additionalClaims - Any additional claims to store (optional)
     * @returns {string} The generated refresh token
     */
    async createRefreshToken(userId, role, additionalClaims = {}) {
        try {
            const token = crypto.randomBytes(64).toString('hex');
            const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

            const racDb = await db.getDb();
            const collection = racDb.collection(COLLECTIONS.REFRESH_TOKENS);
            // Note: TTL index is created by scripts/createIndexes.js

            // Store the refresh token
            await collection.insertOne({
                token,
                userId,
                role,
                ...additionalClaims,
                createdAt: new Date(),
                expiresAt,
                isRevoked: false
            });

            console.log(`[RefreshToken] Created token for ${userId} (${role}), expires: ${expiresAt.toISOString()}`);
            return token;
        } catch (error) {
            console.error('[RefreshToken] Error creating token:', error);
            throw error;
        }
    }

    /**
     * Validate a refresh token and return stored claims
     * @param {string} token - The refresh token to validate
     * @returns {object|null} The stored token data or null if invalid
     */
    async validateRefreshToken(token) {
        try {
            const racDb = await db.getDb();
            const collection = racDb.collection(COLLECTIONS.REFRESH_TOKENS);

            const storedToken = await collection.findOne({
                token,
                expiresAt: { $gt: new Date() },
                isRevoked: { $ne: true }
            });

            if (!storedToken) {
                console.log('[RefreshToken] Token not found or expired');
                return null;
            }

            return storedToken;
        } catch (error) {
            console.error('[RefreshToken] Error validating token:', error);
            return null;
        }
    }

    /**
     * Revoke a specific refresh token
     * @param {string} token - The refresh token to revoke
     */
    async revokeRefreshToken(token) {
        try {
            const racDb = await db.getDb();
            const collection = racDb.collection(COLLECTIONS.REFRESH_TOKENS);

            const result = await collection.updateOne(
                { token },
                { $set: { isRevoked: true, revokedAt: new Date() } }
            );

            console.log(`[RefreshToken] Revoked token: ${result.modifiedCount > 0 ? 'success' : 'not found'}`);
            return result.modifiedCount > 0;
        } catch (error) {
            console.error('[RefreshToken] Error revoking token:', error);
            return false;
        }
    }

    /**
     * Revoke all refresh tokens for a user (logout from all devices)
     * @param {string} userId - User ID to revoke all tokens for
     */
    async revokeAllUserTokens(userId) {
        try {
            const racDb = await db.getDb();
            const collection = racDb.collection(COLLECTIONS.REFRESH_TOKENS);

            const result = await collection.updateMany(
                { userId, isRevoked: { $ne: true } },
                { $set: { isRevoked: true, revokedAt: new Date() } }
            );

            console.log(`[RefreshToken] Revoked ${result.modifiedCount} tokens for user ${userId}`);
            return result.modifiedCount;
        } catch (error) {
            console.error('[RefreshToken] Error revoking user tokens:', error);
            return 0;
        }
    }

    /**
     * Rotate refresh token - revoke old one and issue new one
     * Used for refresh token rotation security pattern
     * @param {string} oldToken - The current refresh token
     * @returns {object} New token and claims
     */
    async rotateRefreshToken(oldToken) {
        const storedToken = await this.validateRefreshToken(oldToken);

        if (!storedToken) {
            return null;
        }

        // Revoke old token
        await this.revokeRefreshToken(oldToken);

        // Create new token with same claims
        const newToken = await this.createRefreshToken(
            storedToken.userId,
            storedToken.role,
            { rotatedFrom: oldToken.substring(0, 8) }
        );

        return {
            token: newToken,
            userId: storedToken.userId,
            role: storedToken.role
        };
    }
}

module.exports = new RefreshTokenService();
