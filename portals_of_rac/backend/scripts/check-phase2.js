// Quick script to check collection size
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkCollectionSize() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db('PassengersDB');
        const collection = db.collection('Phase_2');

        const count = await collection.countDocuments();
        const sampleDoc = await collection.findOne();

        console.log(`\n📊 Phase_2 Collection Stats:`);
        console.log(`   Total documents: ${count}`);
        console.log(`   Sample document keys: ${Object.keys(sampleDoc || {}).length} fields`);

        // Check if indexes exist
        const indexes = await collection.indexes();
        console.log(`\n🔍 Current Indexes: ${indexes.length}`);
        indexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.close();
    }
}

checkCollectionSize();
