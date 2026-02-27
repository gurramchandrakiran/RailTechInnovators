/**
 * create-indexes.js
 * Database index creation for performance optimization
 * Improves query performance on frequently searched fields
 */

const db = require('../config/db');

/**
 * Create all necessary indexes
 */
async function createAllIndexes() {
  try {
    console.log('\n🔍 Starting database index creation...\n');

    const passengersCollection = db.getPassengersCollection();
    const berthsCollection = db.getBeerthsCollection();
    const trainCollection = db.getTrainCollection();

    if (!passengersCollection || !berthsCollection || !trainCollection) {
      console.warn('⚠️ Collections not initialized. Skipping index creation.');
      return;
    }

    // ============= PASSENGERS COLLECTION INDEXES =============
    
    console.log('📋 Creating Passengers collection indexes...');

    // Index on PNR (frequently searched)
    await passengersCollection.createIndex({ PNR_Number: 1 }, {
      name: 'idx_pnr_number',
      unique: true
    });
    console.log('   ✅ PNR_Number index created');

    // Index on PNR_Status (filtering by status)
    await passengersCollection.createIndex({ PNR_Status: 1 }, {
      name: 'idx_pnr_status'
    });
    console.log('   ✅ PNR_Status index created');

    // Index on Online_Status (real-time filtering)
    await passengersCollection.createIndex({ Online_Status: 1 }, {
      name: 'idx_online_status'
    });
    console.log('   ✅ Online_Status index created');

    // Compound index for common queries
    await passengersCollection.createIndex(
      { PNR_Status: 1, Online_Status: 1, Boarded: 1 },
      { name: 'idx_reallocation_filter' }
    );
    console.log('   ✅ Reallocation filter compound index created');

    // Index on Train_Number
    await passengersCollection.createIndex({ Train_Number: 1 }, {
      name: 'idx_train_number'
    });
    console.log('   ✅ Train_Number index created');

    // Index on Coach_Number (filtering by coach)
    await passengersCollection.createIndex({ Coach_Number: 1 }, {
      name: 'idx_coach_number'
    });
    console.log('   ✅ Coach_Number index created');

    // Index on From and To stations (journey search)
    await passengersCollection.createIndex(
      { From_Station: 1, To_Station: 1 },
      { name: 'idx_journey' }
    );
    console.log('   ✅ Journey (From-To) compound index created');

    // Index on Boarded status (track boarding)
    await passengersCollection.createIndex({ Boarded: 1 }, {
      name: 'idx_boarded'
    });
    console.log('   ✅ Boarded status index created');

    // Index on NO_show (identify no-shows quickly)
    await passengersCollection.createIndex({ NO_show: 1 }, {
      name: 'idx_no_show'
    });
    console.log('   ✅ NO_show index created');

    // TTL index on session data (auto-cleanup old records after 24 hours)
    await passengersCollection.createIndex(
      { createdAt: 1 },
      { name: 'idx_created_at', expireAfterSeconds: 86400 }
    );
    console.log('   ✅ TTL (createdAt) index created');

    // ============= BERTHS COLLECTION INDEXES =============

    console.log('\n🔍 Creating Berths collection indexes...');

    // Index on Coach and Berth Number
    await berthsCollection.createIndex(
      { coach: 1, berthNo: 1 },
      { name: 'idx_coach_berth', unique: true }
    );
    console.log('   ✅ Coach-Berth compound index created');

    // Index on Berth Type
    await berthsCollection.createIndex({ type: 1 }, {
      name: 'idx_berth_type'
    });
    console.log('   ✅ Berth Type index created');

    // Index on Class
    await berthsCollection.createIndex({ class: 1 }, {
      name: 'idx_berth_class'
    });
    console.log('   ✅ Class index created');

    // Index on Occupancy Status
    await berthsCollection.createIndex({ status: 1 }, {
      name: 'idx_berth_status'
    });
    console.log('   ✅ Status index created');

    // ============= TRAIN COLLECTION INDEXES =============

    console.log('\n🔍 Creating Train collection indexes...');

    // Index on Train Number
    await trainCollection.createIndex({ trainNo: 1 }, {
      name: 'idx_train_train_no',
      unique: true
    });
    console.log('   ✅ Train Number index created');

    // Index on Current Station
    await trainCollection.createIndex({ currentStationIdx: 1 }, {
      name: 'idx_current_station'
    });
    console.log('   ✅ Current Station index created');

    // Index on Journey Status
    await trainCollection.createIndex({ journeyStarted: 1 }, {
      name: 'idx_journey_started'
    });
    console.log('   ✅ Journey Status index created');

    console.log('\n✅ All indexes created successfully!\n');
    console.log('📊 Index Summary:');
    console.log('   Passengers Collection: 10 indexes');
    console.log('   Berths Collection: 4 indexes');
    console.log('   Train Collection: 3 indexes');
    console.log('   Total: 17 indexes\n');

    return true;
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
    return false;
  }
}

/**
 * Drop all indexes (utility for development)
 */
async function dropAllIndexes() {
  try {
    console.log('\n⚠️  Dropping all indexes...\n');

    const passengersCollection = db.getPassengersCollection();
    const berthsCollection = db.getBeerthsCollection();
    const trainCollection = db.getTrainCollection();

    if (passengersCollection) {
      await passengersCollection.dropAllIndexes();
      console.log('   ✅ Passengers collection indexes dropped');
    }

    if (berthsCollection) {
      await berthsCollection.dropAllIndexes();
      console.log('   ✅ Berths collection indexes dropped');
    }

    if (trainCollection) {
      await trainCollection.dropAllIndexes();
      console.log('   ✅ Train collection indexes dropped');
    }

    console.log('\n✅ All indexes dropped\n');
    return true;
  } catch (error) {
    console.error('❌ Error dropping indexes:', error.message);
    return false;
  }
}

/**
 * Rebuild all indexes
 */
async function rebuildIndexes() {
  try {
    console.log('\n🔄 Rebuilding indexes...\n');
    await dropAllIndexes();
    await createAllIndexes();
    console.log('✅ Indexes rebuilt successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Error rebuilding indexes:', error.message);
    return false;
  }
}

/**
 * Get index statistics
 */
async function getIndexStats() {
  try {
    const passengersCollection = db.getPassengersCollection();
    
    const stats = await passengersCollection.aggregate([
      { $indexStats: {} }
    ]).toArray();

    return stats;
  } catch (error) {
    console.error('Error getting index stats:', error.message);
    return null;
  }
}

module.exports = {
  createAllIndexes,
  dropAllIndexes,
  rebuildIndexes,
  getIndexStats
};
