// backend/scripts/createTestAccounts.js
// Run this script ONCE to create test accounts in MongoDB

require('dotenv').config();
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
const { COLLECTIONS, DBS } = require('../config/collections');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function createTestAccounts() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DBS.STATIONS);

        // Hash passwords
        const adminPasswordHash = await bcrypt.hash('Prasanth@123', 12);
        const ttePasswordHash = await bcrypt.hash('Prasanth@123', 12);
        const passengerPasswordHash = await bcrypt.hash('Prasanth@123', 12);

        // 1. Create tte_users collection and insert Admin + TTE accounts
        const tteUsersCollection = db.collection(COLLECTIONS.TTE_USERS);

        // Check if already exists
        const existingAdmin = await tteUsersCollection.findOne({ employeeId: 'ADMIN_01' });
        if (existingAdmin) {
            console.log('⚠️  ADMIN_01 already exists, skipping...');
        } else {
            await tteUsersCollection.insertOne({
                employeeId: 'ADMIN_01',
                passwordHash: adminPasswordHash,
                email: 'prasanth@gmail.com',
                name: 'Prasanth Gannavarapu',
                role: 'ADMIN',
                active: true,
                trainAssigned: null,
                phone: '9392629863',
                permissions: ['ALL'],
                createdAt: new Date(),
                lastLogin: null
            });
            console.log('✅ Created ADMIN_01 account');
        }

        const existingTTE = await tteUsersCollection.findOne({ employeeId: 'TTE_01' });
        if (existingTTE) {
            console.log('⚠️  TTE_01 already exists, skipping...');
        } else {
            await tteUsersCollection.insertOne({
                employeeId: 'TTE_01',
                passwordHash: ttePasswordHash,
                email: 'tte@railway.com',
                name: 'TTE Staff',
                role: 'TTE',
                active: true,
                trainAssigned: 17225,
                phone: '9876543210',
                permissions: ['MARK_BOARDING', 'MARK_NO_SHOW', 'VIEW_PASSENGERS', 'OFFLINE_UPGRADE'],
                createdAt: new Date(),
                lastLogin: null
            });
            console.log('✅ Created TTE_01 account');
        }

        // 2. Create passenger_accounts collection and insert test passenger
        const passengerAccountsCollection = db.collection(COLLECTIONS.PASSENGER_ACCOUNTS);

        const existingPassenger = await passengerAccountsCollection.findOne({ IRCTC_ID: 'IR_0001' });
        if (existingPassenger) {
            console.log('⚠️  IR_0001 already exists, skipping...');
        } else {
            await passengerAccountsCollection.insertOne({
                IRCTC_ID: 'IR_0001',
                email: 'prasanthgannavarapu12@gmail.com',
                passwordHash: passengerPasswordHash,
                name: 'Prasanth Gannavarapu',
                phone: '9515796516',
                active: true,
                emailVerified: true,
                phoneVerified: false,
                createdAt: new Date(),
                lastLogin: null
            });
            console.log('✅ Created IR_0001 passenger account');
        }

        console.log('\n🎉 All test accounts created successfully!');
        console.log('\n📋 Test Credentials:');
        console.log('   Admin: ADMIN_01 / Prasanth@123');
        console.log('   TTE: TTE_01 / Prasanth@123');
        console.log('   Passenger: IR_0001 / Prasanth@123');
        console.log('   Passenger Email: prasanthgannavarapu12@gmail.com / Prasanth@123');

    } catch (error) {
        console.error('❌ Error creating test accounts:', error);
    } finally {
        await client.close();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run the script
createTestAccounts();
