// backend/scripts/check-passengers.js
// Quick diagnostic script to check MongoDB passenger data

const mongoose = require('mongoose');

async function checkPassengers() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/RAC_System');
        console.log('✅ Connected to MongoDB');

        // Get database and collection
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('\n📂 Available collections:');
        collections.forEach(col => console.log(`   - ${col.name}`));

        // Check passengers collection
        const passengerCollectionName = 'Passengers_17225_26-11-2024';
        console.log(`\n🔍 Checking collection: ${passengerCollectionName}`);

        const passengersCollection = db.collection(passengerCollectionName);
        const count = await passengersCollection.countDocuments();

        console.log(`📊 Total passengers in database: ${count}`);

        if (count > 0) {
            // Sample one passenger
            const sample = await passengersCollection.findOne({});
            console.log('\n👤 Sample passenger:');
            console.log(JSON.stringify(sample, null, 2));
        }

        await mongoose.connection.close();
        console.log('\n✅ Done');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkPassengers();
