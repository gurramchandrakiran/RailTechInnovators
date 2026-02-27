/**
 * Script to clean up duplicate pending reallocations
 * Run with: node scripts/cleanupDuplicateReallocations.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();
const { COLLECTIONS, DBS } = require('../config/collections');

async function cleanupDuplicates() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db(DBS.STATIONS);
        const collection = db.collection(COLLECTIONS.STATION_REALLOCATIONS);

        // Find duplicates (same PNR with pending status)
        const duplicates = await collection.aggregate([
            { $match: { status: 'pending' } },
            {
                $group: {
                    _id: '$passengerPNR',
                    count: { $sum: 1 },
                    ids: { $push: '$_id' },
                    firstId: { $first: '$_id' }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        console.log(`Found ${duplicates.length} PNRs with duplicate entries`);

        if (duplicates.length === 0) {
            console.log('✅ No duplicates found!');
            return;
        }

        // For each duplicate, keep the first one and delete the rest
        let totalDeleted = 0;
        for (const dup of duplicates) {
            const idsToDelete = dup.ids.filter(id => !id.equals(dup.firstId));
            const result = await collection.deleteMany({ _id: { $in: idsToDelete } });
            totalDeleted += result.deletedCount;
            console.log(`   Deleted ${result.deletedCount} duplicates for PNR ${dup._id}`);
        }

        console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} duplicate entries.`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.close();
    }
}

cleanupDuplicates();
