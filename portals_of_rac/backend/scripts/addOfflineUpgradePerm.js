// One-time script to add OFFLINE_UPGRADE permission to all existing TTE accounts
const { MongoClient } = require('mongodb');

async function run() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('rac');

    const result = await db.collection('tte_users').updateMany(
        { role: 'TTE' },
        { $addToSet: { permissions: 'OFFLINE_UPGRADE' } }
    );

    console.log(`Updated ${result.modifiedCount} TTE accounts with OFFLINE_UPGRADE permission`);
    await client.close();
}

run().catch(e => console.error(e));
