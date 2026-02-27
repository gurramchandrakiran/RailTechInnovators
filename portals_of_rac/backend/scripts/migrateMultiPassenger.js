// backend/scripts/migrateMultiPassenger.js
// Migration script to add new fields for multi-passenger support
// Run with: node scripts/migrateMultiPassenger.js

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.PASSENGERS_DB || process.env.DB_NAME || 'rac_db';
const COLLECTION_NAME = process.env.PASSENGERS_COLLECTION || 'passengers';

async function migrateToMultiPassenger() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('🔄 Connected to MongoDB');
        console.log(`📦 Database: ${DB_NAME}`);
        console.log(`📁 Collection: ${COLLECTION_NAME}`);

        const db = client.db(DB_NAME);
        const passengers = db.collection(COLLECTION_NAME);

        console.log('\n📊 Starting multi-passenger migration...\n');

        // Step 1: Count existing records
        const totalCount = await passengers.countDocuments({});
        console.log(`   Total passengers in collection: ${totalCount}`);

        // Step 2: Add new fields to all existing records that don't have them
        console.log('\n🔧 Step 1: Adding new fields to existing records...');

        const result = await passengers.updateMany(
            { Passenger_Index: { $exists: false } },  // Only unmigrated records
            {
                $set: {
                    Passenger_Index: 1,                    // First (and only) passenger
                    Seat_Preference: 'No Preference',
                    Preference_Priority: 0,
                    Is_Group_Leader: true,
                    Preference_Matched: false
                }
            }
        );

        console.log(`   ✅ Updated ${result.modifiedCount} records with new fields`);

        // Step 3: Calculate preference priority based on age/gender
        console.log('\n🔧 Step 2: Calculating preference priorities...');

        const allPassengers = await passengers.find({}).toArray();
        let priorityUpdates = 0;

        for (const p of allPassengers) {
            let priority = 0;
            if (p.Age >= 60) {
                priority = 3;  // Senior citizens - highest priority for lower berths
            } else if (p.Gender === 'Female') {
                priority = 2;  // Women - second priority
            } else if (p.Age >= 18) {
                priority = 1;  // Adults
            } else {
                priority = 0;  // Children
            }

            if (p.Preference_Priority !== priority) {
                await passengers.updateOne(
                    { _id: p._id },
                    { $set: { Preference_Priority: priority } }
                );
                priorityUpdates++;
            }
        }

        console.log(`   ✅ Updated ${priorityUpdates} preference priorities`);

        // Step 4: Create new compound unique index
        console.log('\n🔧 Step 3: Creating new indexes...');

        try {
            await passengers.createIndex(
                { PNR_Number: 1, Passenger_Index: 1 },
                { unique: true, name: 'pnr_passenger_idx_unique' }
            );
            console.log('   ✅ Created compound unique index: {PNR_Number, Passenger_Index}');
        } catch (e) {
            if (e.code === 85 || e.code === 86) {
                console.log('   ⚠️ Compound index already exists (skipping)');
            } else {
                throw e;
            }
        }

        // Step 5: Drop old unique index on PNR_Number (if exists)
        console.log('\n🔧 Step 4: Removing old unique constraint on PNR_Number...');

        try {
            await passengers.dropIndex('PNR_Number_1');
            console.log('   ✅ Dropped old PNR_Number unique index');
        } catch (e) {
            console.log('   ⚠️ Old unique index not found or already dropped (OK)');
        }

        // Step 6: Verify migration
        console.log('\n📊 Step 5: Verifying migration...');

        const verifyCount = await passengers.countDocuments({ Passenger_Index: { $exists: true } });
        const withPreference = await passengers.countDocuments({ Seat_Preference: { $exists: true } });
        const withPriority = await passengers.countDocuments({ Preference_Priority: { $gte: 0 } });

        console.log(`   Records with Passenger_Index: ${verifyCount}/${totalCount}`);
        console.log(`   Records with Seat_Preference: ${withPreference}/${totalCount}`);
        console.log(`   Records with Preference_Priority: ${withPriority}/${totalCount}`);

        // Get indexes
        const indexes = await passengers.indexes();
        console.log('\n📋 Current indexes:');
        indexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? ' (UNIQUE)' : ''}`);
        });

        console.log('\n🎉 Migration completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Update your data generation scripts to include new fields');
        console.log('   2. Test creating multiple passengers with same PNR');
        console.log('   3. Verify API endpoints work with new structure');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run migration
migrateToMultiPassenger()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
