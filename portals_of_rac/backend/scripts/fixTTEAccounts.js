// backend/scripts/fixTTEAccounts.js
// Migrates legacy TTE accounts (e.g. "TTE_01") to the new format
// expected by the login validator: "<trainNo>_TTE<nnn>"
//
// Also ensures trainAssigned is stored as a String (not Number) so that
// the strict string comparison in staffLogin never has a type mismatch.
//
// Run once from the project root:
//   node backend/scripts/fixTTEAccounts.js
//
// Safe to re-run – every step is idempotent.

require('dotenv').config();
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
const { COLLECTIONS, DBS } = require('../config/collections');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// ─── Configuration ────────────────────────────────────────────────────────────
// Default password assigned to every fixed / newly-created TTE account.
// The TTE should change this after first login.
const DEFAULT_PASSWORD = 'Prasanth@123';

// Legacy TTE documents that need to be re-mapped.
// Add more entries here if you have other old-format accounts.
const LEGACY_MIGRATIONS = [
    {
        oldEmployeeId: 'TTE_01',
        trainNo: '17225',          // must be a STRING – matches req.body.trainNo
        name: 'TTE Staff',
        email: 'tte@railway.com',
        phone: '9876543210',
    },
];
// ──────────────────────────────────────────────────────────────────────────────

async function fixTTEAccounts() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅  Connected to MongoDB');

        const db = client.db(DBS.STATIONS);
        const tteCol = db.collection(COLLECTIONS.TTE_USERS);

        // ── Step 1: Migrate each legacy account ──────────────────────────────
        for (const entry of LEGACY_MIGRATIONS) {
            console.log(`\n🔄  Processing legacy account: ${entry.oldEmployeeId}`);

            // Find the old document
            const oldDoc = await tteCol.findOne({ employeeId: entry.oldEmployeeId });

            if (!oldDoc) {
                console.log(`   ⚠️  "${entry.oldEmployeeId}" not found – skipping.`);
                continue;
            }

            // Determine what the new employeeId should be.
            // Count how many TTE accounts already exist for this train so we
            // don't collide with any that were registered via registerTTE().
            const pattern = new RegExp(`^${entry.trainNo}_TTE`, 'i');
            const existingCount = await tteCol.countDocuments({
                employeeId: { $regex: pattern },
            });

            const tteNumber = String(existingCount + 1).padStart(3, '0');
            const newEmployeeId = `${entry.trainNo}_TTE${tteNumber}`;

            // Check the new ID doesn't already exist (idempotency guard)
            const collision = await tteCol.findOne({ employeeId: newEmployeeId });
            if (collision) {
                console.log(
                    `   ⚠️  Target ID "${newEmployeeId}" already exists – skipping migration of "${entry.oldEmployeeId}".`,
                );
                continue;
            }

            // Re-hash password (keeps the hash fresh, ensures correct rounds)
            const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

            // Build the corrected document, preserving original timestamps
            const newDoc = {
                employeeId: newEmployeeId,
                passwordHash,
                email: entry.email || oldDoc.email || null,
                name: entry.name || oldDoc.name || newEmployeeId,
                role: 'TTE',
                active: true,
                // Store trainAssigned as String to match req.body.trainNo (also a string)
                trainAssigned: String(entry.trainNo),
                phone: entry.phone || oldDoc.phone || null,
                permissions: oldDoc.permissions && oldDoc.permissions.length
                    ? oldDoc.permissions
                    : ['MARK_BOARDING', 'MARK_NO_SHOW', 'VIEW_PASSENGERS', 'OFFLINE_UPGRADE'],
                createdAt: oldDoc.createdAt || new Date(),
                lastLogin: oldDoc.lastLogin || null,
            };

            // Insert new document first, then remove the old one
            await tteCol.insertOne(newDoc);
            await tteCol.deleteOne({ employeeId: entry.oldEmployeeId });

            console.log(`   ✅  Migrated  "${entry.oldEmployeeId}"  →  "${newEmployeeId}"`);
            console.log(`       trainAssigned : "${newDoc.trainAssigned}" (String)`);
            console.log(`       password      : ${DEFAULT_PASSWORD}`);
        }

        // ── Step 2: Fix trainAssigned type on ALL TTE documents ──────────────
        // Any document whose trainAssigned is a Number gets coerced to String.
        console.log('\n🔄  Fixing trainAssigned type on all TTE documents…');

        const allTTEs = await tteCol.find({ role: 'TTE' }).toArray();
        let fixedCount = 0;

        for (const doc of allTTEs) {
            if (typeof doc.trainAssigned === 'number') {
                await tteCol.updateOne(
                    { _id: doc._id },
                    { $set: { trainAssigned: String(doc.trainAssigned) } },
                );
                console.log(
                    `   ✅  ${doc.employeeId}: trainAssigned  ${doc.trainAssigned} (Number) → "${String(doc.trainAssigned)}" (String)`,
                );
                fixedCount++;
            }
        }

        if (fixedCount === 0) {
            console.log('   ✔️  All trainAssigned values are already Strings – nothing to fix.');
        }

        // ── Step 3: Print final state of tte_users collection ────────────────
        console.log('\n📋  Current tte_users collection:\n');
        const allUsers = await tteCol.find({}).toArray();

        for (const u of allUsers) {
            console.log(`   employeeId    : ${u.employeeId}`);
            console.log(`   role          : ${u.role}`);
            console.log(`   trainAssigned : ${u.trainAssigned} (${typeof u.trainAssigned})`);
            console.log(`   active        : ${u.active}`);
            console.log('   ─────────────────────────────────────');
        }

        console.log('\n🎉  Migration complete!\n');
        console.log('📌  Login credentials after migration:');
        console.log('    Admin  →  ADMIN_01        /  Prasanth@123');

        for (const entry of LEGACY_MIGRATIONS) {
            // Re-query to get the actual new ID (handles cases that were already migrated)
            const pattern = new RegExp(`^${entry.trainNo}_TTE`, 'i');
            const docs = await tteCol
                .find({ employeeId: { $regex: pattern } })
                .sort({ employeeId: 1 })
                .toArray();

            for (const d of docs) {
                console.log(
                    `    TTE    →  ${d.employeeId}  /  ${DEFAULT_PASSWORD}  (train ${d.trainAssigned})`,
                );
            }
        }

    } catch (err) {
        console.error('\n❌  Migration failed:', err);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n✅  Disconnected from MongoDB');
    }
}

fixTTEAccounts();
