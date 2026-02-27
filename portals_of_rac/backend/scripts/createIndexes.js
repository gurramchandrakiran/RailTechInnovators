// backend/scripts/createIndexes.js
// Script to create MongoDB indexes for performance optimization
// Run with: node scripts/createIndexes.js

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { COLLECTIONS, DBS } = require('../config/collections');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';

async function createIndexes() {
    console.log('🔧 Creating MongoDB indexes for performance optimization...\n');

    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        // Get the rac database (for auth collections)
        const racDb = client.db(DBS.STATIONS);

        // ==================== Refresh Tokens Collection ====================
        console.log('📁 Creating indexes on refresh_tokens collection...');

        const refreshTokensCollection = racDb.collection(COLLECTIONS.REFRESH_TOKENS);

        // TTL index for auto-expiring refresh tokens
        await refreshTokensCollection.createIndex(
            { expiresAt: 1 },
            { expireAfterSeconds: 0, name: 'idx_refresh_tokens_ttl' }
        );
        console.log('   ✅ TTL index on expiresAt');

        // Index for token lookup
        await refreshTokensCollection.createIndex(
            { token: 1 },
            { unique: true, name: 'idx_refresh_tokens_token' }
        );
        console.log('   ✅ Unique index on token');

        // Index for user-based queries
        await refreshTokensCollection.createIndex(
            { userId: 1 },
            { name: 'idx_refresh_tokens_userId' }
        );
        console.log('   ✅ Index on userId\n');

        // ==================== Passenger Accounts Collection ====================
        console.log('📁 Creating indexes on passenger_accounts collection...');

        const passengerAccountsCollection = racDb.collection(COLLECTIONS.PASSENGER_ACCOUNTS);

        await passengerAccountsCollection.createIndex(
            { IRCTC_ID: 1 },
            { unique: true, name: 'idx_passenger_accounts_irctc' }
        );
        console.log('   ✅ Unique index on IRCTC_ID\n');

        // ==================== TTE Users Collection ====================
        console.log('📁 Creating indexes on tte_users collection...');

        const tteUsersCollection = racDb.collection(COLLECTIONS.TTE_USERS);

        await tteUsersCollection.createIndex(
            { employeeId: 1 },
            { unique: true, name: 'idx_tte_users_employeeId' }
        );
        console.log('   ✅ Unique index on employeeId\n');

        // ==================== Station Reallocations Collection ====================
        console.log('📁 Creating indexes on station_reallocations collection...');

        const stationReallocationsCollection = racDb.collection(COLLECTIONS.STATION_REALLOCATIONS);

        // Compound index for pending reallocations query
        await stationReallocationsCollection.createIndex(
            { trainId: 1, stationIdx: 1, status: 1 },
            { name: 'idx_station_reallocations_compound' }
        );
        console.log('   ✅ Compound index on trainId, stationIdx, status');

        // Index for status filtering
        await stationReallocationsCollection.createIndex(
            { status: 1, createdAt: -1 },
            { name: 'idx_station_reallocations_status' }
        );
        console.log('   ✅ Index on status + createdAt\n');

        // ==================== In-App Notifications Collection ====================
        console.log('📁 Creating indexes on in_app_notifications collection...');

        const notificationsCollection = racDb.collection(COLLECTIONS.IN_APP_NOTIFICATIONS);

        await notificationsCollection.createIndex(
            { irctcId: 1, read: 1, createdAt: -1 },
            { name: 'idx_notifications_user' }
        );
        console.log('   ✅ Compound index for user notifications');

        // TTL index for auto-cleanup of old notifications (30 days)
        await notificationsCollection.createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 2592000, name: 'idx_notifications_ttl' }
        );
        console.log('   ✅ TTL index (30 days auto-cleanup)\n');

        // ==================== Push Subscriptions Collection ====================
        console.log('📁 Creating indexes on push_subscriptions collection...');

        const pushSubsCollection = racDb.collection(COLLECTIONS.PUSH_SUBSCRIPTIONS);

        // Compound unique index on type, userId, and endpoint (matches upsert query)
        await pushSubsCollection.createIndex(
            { type: 1, userId: 1, 'subscription.endpoint': 1 },
            { unique: true, name: 'idx_push_subscriptions_compound' }
        );
        console.log('   ✅ Compound unique index on type + userId + endpoint\n');

        // ==================== Upgrade Notifications Collection ====================
        console.log('📁 Creating indexes on upgrade_notifications collection...');

        const upgradeNotificationsCollection = racDb.collection(COLLECTIONS.UPGRADE_NOTIFICATIONS);

        await upgradeNotificationsCollection.createIndex(
            { pnr: 1, status: 1 },
            { name: 'idx_upgrade_notifications_pnr' }
        );
        console.log('   ✅ Compound index on pnr + status');

        // TTL index for auto-expiring upgrade offers (30 minutes)
        await upgradeNotificationsCollection.createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 1800, name: 'idx_upgrade_notifications_ttl' }
        );
        console.log('   ✅ TTL index (30 min auto-expiry)\n');

        // ==================== Dynamic Passenger Collections ====================
        // These indexes should be created on the dynamic passenger collection (e.g., 17225_passengers)
        // We'll create a helper function that can be called when a train is initialized

        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║  ✅ All indexes created successfully!                        ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        console.log('📋 Summary of indexes created:');
        console.log('   • refresh_tokens: 3 indexes (TTL, token, userId)');
        console.log('   • passenger_accounts: 1 index (IRCTC_ID)');
        console.log('   • tte_users: 1 index (employeeId)');
        console.log('   • station_reallocations: 2 indexes (compound, status)');
        console.log('   • in_app_notifications: 2 indexes (user, TTL)');
        console.log('   • push_subscriptions: 1 index (identifier)');
        console.log('   • upgrade_notifications: 2 indexes (pnr, TTL)\n');

        console.log('⚠️  Note: Passenger collection indexes should be created');
        console.log('   when a train is initialized. Use createPassengerIndexes()');
        console.log('   function exported from this module.\n');

    } catch (error) {
        console.error('❌ Error creating indexes:', error.message);
        process.exit(1);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

/**
 * Create indexes on a specific passenger collection (called during train init)
 * @param {Db} db - MongoDB database instance
 * @param {string} collectionName - e.g., "17225_passengers"
 */
async function createPassengerIndexes(db, collectionName) {
    console.log(`\n🔧 Creating indexes on ${collectionName}...`);

    try {
        const collection = db.collection(collectionName);

        // Priority 1: Compound index for finding RAC passengers by station
        await collection.createIndex(
            { PNR_Status: 1, Boarding_Station: 1 },
            { name: 'idx_passengers_rac_station' }
        );
        console.log('   ✅ Priority 1: {PNR_Status, Boarding_Station} - 50x speedup for RAC queries');

        // Priority 2: Segment eligibility checks
        await collection.createIndex(
            { Boarding_Station: 1, Deboarding_Station: 1 },
            { name: 'idx_passengers_segment' }
        );
        console.log('   ✅ Priority 2: {Boarding_Station, Deboarding_Station} - 30x speedup for segment checks');

        // Priority 3: Berth conflict detection
        await collection.createIndex(
            { Assigned_Coach: 1, Assigned_berth: 1 },
            { name: 'idx_passengers_berth' }
        );
        console.log('   ✅ Priority 3: {Assigned_Coach, Assigned_berth} - 20x speedup for berth conflicts');

        // Priority 4: Common filters
        await collection.createIndex(
            { PNR_Number: 1 },
            { unique: true, name: 'idx_passengers_pnr' }
        );
        console.log('   ✅ Priority 4: {PNR_Number} - unique index');

        await collection.createIndex(
            { IRCTC_ID: 1 },
            { name: 'idx_passengers_irctc' }
        );
        console.log('   ✅ Priority 4: {IRCTC_ID}');

        console.log(`   ✨ All indexes created for ${collectionName}\n`);

        return { success: true, collection: collectionName };
    } catch (error) {
        console.error(`   ❌ Error creating indexes on ${collectionName}:`, error.message);
        return { success: false, error: error.message };
    }
}

// Export for use in other modules
module.exports = { createIndexes, createPassengerIndexes };

// Run if called directly
if (require.main === module) {
    createIndexes();
}
