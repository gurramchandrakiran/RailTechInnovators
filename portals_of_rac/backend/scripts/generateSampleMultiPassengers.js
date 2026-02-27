// backend/scripts/generateSampleMultiPassengers.js
// Generate sample multi-passenger bookings for testing
// Run with: node scripts/generateSampleMultiPassengers.js

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.PASSENGERS_DB || process.env.DB_NAME || 'rac_db';
const COLLECTION_NAME = process.env.PASSENGERS_COLLECTION || 'passengers';

// Sample family groups for testing
const sampleBookings = [
    {
        pnr: 'TEST0001234567',
        irctcId: 'family_group_1',
        trainNumber: '17225',
        trainName: 'Amaravathi Express',
        journeyDate: '02-02-2026',
        boardingStation: 'NRT',
        deboardingStation: 'BZA',
        bookingClass: 'Sleeper',
        passengers: [
            { name: 'Rajesh Kumar', age: 45, gender: 'Male', seatPreference: 'Lower Berth' },
            { name: 'Priya Kumar', age: 42, gender: 'Female', seatPreference: 'Lower Berth' },
            { name: 'Arun Kumar', age: 12, gender: 'Male', seatPreference: 'Upper Berth' }
        ]
    },
    {
        pnr: 'TEST0002345678',
        irctcId: 'senior_couple',
        trainNumber: '17225',
        trainName: 'Amaravathi Express',
        journeyDate: '02-02-2026',
        boardingStation: 'GNT',
        deboardingStation: 'MAS',
        bookingClass: 'Sleeper',
        passengers: [
            { name: 'Venkata Rao', age: 68, gender: 'Male', seatPreference: 'Lower Berth' },
            { name: 'Lakshmi Devi', age: 65, gender: 'Female', seatPreference: 'Lower Berth' }
        ]
    },
    {
        pnr: 'TEST0003456789',
        irctcId: 'friends_trip',
        trainNumber: '17225',
        trainName: 'Amaravathi Express',
        journeyDate: '02-02-2026',
        boardingStation: 'NRT',
        deboardingStation: 'GNT',
        bookingClass: 'Sleeper',
        passengers: [
            { name: 'Srinivas', age: 28, gender: 'Male', seatPreference: 'No Preference' },
            { name: 'Krishna', age: 30, gender: 'Male', seatPreference: 'Lower Berth' },
            { name: 'Ravi', age: 27, gender: 'Male', seatPreference: 'Upper Berth' },
            { name: 'Prasad', age: 29, gender: 'Male', seatPreference: 'No Preference' }
        ]
    },
    {
        pnr: 'TEST0004567890',
        irctcId: 'solo_traveler',
        trainNumber: '17225',
        trainName: 'Amaravathi Express',
        journeyDate: '02-02-2026',
        boardingStation: 'TEL',
        deboardingStation: 'BZA',
        bookingClass: 'Sleeper',
        passengers: [
            { name: 'Anitha Sharma', age: 35, gender: 'Female', seatPreference: 'Side Lower' }
        ]
    }
];

// Calculate preference priority
function calculatePriority(age, gender) {
    if (age >= 60) return 3;       // Senior citizens
    if (gender === 'Female') return 2;  // Women
    if (age >= 18) return 1;       // Adults
    return 0;                      // Children
}

async function generateSampleData() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('🔄 Connected to MongoDB');

        const db = client.db(DB_NAME);
        const passengers = db.collection(COLLECTION_NAME);

        console.log(`📦 Using Database: ${DB_NAME}`);
        console.log(`📁 Using Collection: ${COLLECTION_NAME}`);
        console.log('\n📊 Generating sample multi-passenger bookings...\n');

        let totalCreated = 0;

        for (const booking of sampleBookings) {
            // Check if PNR already exists
            const existing = await passengers.findOne({ PNR_Number: booking.pnr });
            if (existing) {
                console.log(`   ⚠️ Skipping ${booking.pnr} - already exists`);
                continue;
            }

            // Create passenger documents
            const passengerDocs = booking.passengers.map((p, index) => ({
                PNR_Number: booking.pnr,
                Passenger_Index: index + 1,
                IRCTC_ID: booking.irctcId,
                Name: p.name,
                Age: p.age,
                Gender: p.gender,
                Seat_Preference: p.seatPreference || 'No Preference',
                Preference_Priority: calculatePriority(p.age, p.gender),
                Is_Group_Leader: index === 0,
                Train_Number: booking.trainNumber,
                Train_Name: booking.trainName,
                Journey_Date: booking.journeyDate,
                Boarding_Station: booking.boardingStation,
                Deboarding_Station: booking.deboardingStation,
                PNR_Status: 'CNF',
                Rac_status: '-',
                Booking_Class: booking.bookingClass,
                Class: booking.bookingClass,
                Assigned_Coach: `S${Math.floor(Math.random() * 5) + 1}`,
                Assigned_Berth: `${Math.floor(Math.random() * 72) + 1}`,
                Berth_Type: ['LB', 'MB', 'UB', 'SL', 'SU'][Math.floor(Math.random() * 5)],
                Passenger_Status: 'Offline',
                Boarded: false,
                NO_show: false,
                Deboarded: false,
                Preference_Matched: false,
                Booking_Date: new Date().toISOString()
            }));

            await passengers.insertMany(passengerDocs);
            console.log(`   ✅ Created ${booking.pnr}: ${booking.passengers.length} passengers (${booking.passengers.map(p => p.name).join(', ')})`);
            totalCreated += passengerDocs.length;
        }

        console.log(`\n🎉 Created ${totalCreated} sample passengers across ${sampleBookings.length} bookings`);

        // Show summary
        console.log('\n📋 Sample Booking Summary:');
        console.log('─'.repeat(80));
        console.log('| PNR            | Passengers | Group Type      | Route       |');
        console.log('─'.repeat(80));
        for (const b of sampleBookings) {
            const pnr = b.pnr.padEnd(14);
            const count = String(b.passengers.length).padEnd(10);
            const type = b.irctcId.replace('_', ' ').padEnd(15);
            const route = `${b.boardingStation} → ${b.deboardingStation}`.padEnd(11);
            console.log(`| ${pnr} | ${count} | ${type} | ${route} |`);
        }
        console.log('─'.repeat(80));

        console.log('\n💡 You can now test these bookings via API:');
        console.log('   GET /api/passenger/pnr/TEST0001234567');
        console.log('   GET /api/passenger/booking/TEST0002345678');

    } catch (error) {
        console.error('\n❌ Error:', error);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

generateSampleData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
