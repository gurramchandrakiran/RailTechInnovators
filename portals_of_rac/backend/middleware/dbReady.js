// backend/middleware/dbReady.js
// Middleware that holds requests until MongoDB reconnection completes.
// Prevents "Invalid Topology is closed" errors during train switching.

const db = require('../config/db');

async function dbReady(req, res, next) {
    try {
        await db.waitUntilReady();
        next();
    } catch (err) {
        res.status(503).json({
            success: false,
            message: 'Database is reconnecting. Please retry shortly.',
        });
    }
}

module.exports = dbReady;
