// backend/services/NotificationQueueService.js
// Background notification queue - processes push + email without blocking API

class NotificationQueueService {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.concurrency = 5; // process 5 notifications at a time
        this.stats = { enqueued: 0, processed: 0, failed: 0 };
    }

    /**
     * Enqueue upgrade offer notifications — returns immediately
     */
    enqueueUpgradeOffers(pendingReallocations) {
        for (const pending of pendingReallocations) {
            this.queue.push({
                type: 'UPGRADE_OFFER',
                payload: {
                    irctcId: pending.passengerIrctcId,
                    name: pending.passengerName,
                    pnr: pending.passengerPNR,
                    currentRAC: pending.currentRAC,
                    proposedBerthFull: pending.proposedBerthFull,
                    proposedBerthType: pending.proposedBerthType,
                    proposedCoach: pending.proposedCoach,
                    stationName: pending.stationName
                },
                createdAt: Date.now()
            });
        }
        this.stats.enqueued += pendingReallocations.length;
        console.log(`📬 [Queue] Enqueued ${pendingReallocations.length} notifications (queue size: ${this.queue.length})`);

        // Start processing if not already running (fire-and-forget)
        if (!this.processing) {
            this._processQueue().catch(err => {
                console.error('❌ [Queue] Processing error:', err.message);
                this.processing = false;
            });
        }
    }

    /**
     * Process the queue in batches
     */
    async _processQueue() {
        this.processing = true;

        while (this.queue.length > 0) {
            // Take a batch of `concurrency` items
            const batch = this.queue.splice(0, this.concurrency);

            const results = await Promise.allSettled(
                batch.map(job => this._processJob(job))
            );

            // Count successes and failures
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    this.stats.processed++;
                } else {
                    this.stats.failed++;
                }
            }
        }

        this.processing = false;
        console.log(`📬 [Queue] Batch complete (processed: ${this.stats.processed}, failed: ${this.stats.failed})`);
    }

    /**
     * Process a single notification job
     */
    async _processJob(job) {
        const WebPushService = require('./WebPushService');
        const NotificationService = require('./NotificationService');
        const db = require('../config/db');

        if (job.type === 'UPGRADE_OFFER') {
            const { irctcId, name, pnr, currentRAC,
                proposedBerthFull, proposedBerthType, proposedCoach, stationName } = job.payload;

            // 1. Push notification
            try {
                await WebPushService.sendUpgradeOfferToPassenger(irctcId, {
                    pnr,
                    currentBerth: currentRAC,
                    offeredBerth: proposedBerthFull,
                    offeredBerthType: proposedBerthType,
                    offeredCoach: proposedCoach
                });
            } catch (pushErr) {
                // Push failures are common (no subscription), don't throw
                console.log(`   ℹ️  [Queue] Push skipped for ${irctcId}: ${pushErr.message}`);
            }

            // 2. Email notification
            try {
                const passengersCollection = db.getPassengersCollection();
                const dbPassenger = await passengersCollection.findOne({ IRCTC_ID: irctcId });

                if (dbPassenger?.Email) {
                    await NotificationService.sendApprovalRequestNotification(
                        { name, email: dbPassenger.Email, pnr },
                        { currentRAC, proposedBerthFull, proposedBerthType, stationName }
                    );
                    console.log(`   📧 [Queue] Email sent to ${name} (${irctcId})`);
                }
            } catch (emailErr) {
                console.error(`   ⚠️ [Queue] Email failed for ${pnr}:`, emailErr.message);
            }
        }
    }

    /**
     * Get queue stats
     */
    getStats() {
        return {
            pending: this.queue.length,
            processing: this.processing,
            ...this.stats
        };
    }
}

module.exports = new NotificationQueueService();
