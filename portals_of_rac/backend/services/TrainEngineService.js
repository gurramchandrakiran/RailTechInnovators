// backend/services/TrainEngineService.js
// Server-side train engine that runs independent timers for each train.
// When "Start Journey" is pressed, a 2-minute interval is started on the server.
// The train keeps moving even if the browser is closed.

const RuntimeStateService = require('./RuntimeStateService');

const DEFAULT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

class TrainEngineService {
    constructor() {
        // Map<trainNo, { timer, intervalMs, startedAt, nextTickAt, trainNo }>
        this.engines = new Map();
    }

    /**
     * Start a background engine for a train.
     * Called when admin clicks "Start Journey".
     * @param {string} trainNo 
     * @param {Object} options - { intervalMs }
     * @returns {{ started: boolean, reason?: string }}
     */
    startEngine(trainNo, options = {}) {
        const key = String(trainNo);
        const intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;

        if (this.engines.has(key)) {
            console.log(`🚂 Engine for train ${trainNo} already running`);
            return { started: false, reason: 'Engine already running' };
        }

        console.log(`🚂 Starting engine for train ${trainNo} (interval: ${intervalMs / 1000}s)`);

        const timer = setInterval(async () => {
            await this._tick(key);
        }, intervalMs);

        // Prevent timer from keeping the process alive
        if (timer.unref) timer.unref();

        this.engines.set(key, {
            timer,
            intervalMs,
            startedAt: new Date(),
            nextTickAt: new Date(Date.now() + intervalMs),
            trainNo: key
        });

        return { started: true };
    }

    /**
     * One "tick" = one automatic station move + all processing.
     * This runs every 2 minutes per train on the server.
     * @param {string} trainNo
     */
    async _tick(trainNo) {
        console.log(`\n🔔 ENGINE TICK FIRED for train ${trainNo} at ${new Date().toLocaleTimeString()}`);
        // Lazy-require to avoid circular dependency
        const trainController = require('../controllers/trainController');
        const StationEventService = require('./StationEventService');
        let wsManager;
        try { wsManager = require('../config/websocket'); } catch (e) { wsManager = null; }

        const trainState = trainController.getGlobalTrainState(trainNo);

        if (!trainState) {
            console.log(`⚠️ Engine tick: train ${trainNo} not found in memory, stopping engine`);
            this.stopEngine(trainNo);
            return;
        }

        // Check if journey is complete
        if (trainState.isJourneyComplete()) {
            console.log(`🏁 Train ${trainNo} already at final station, stopping engine`);
            this.stopEngine(trainNo);
            return;
        }

        try {
            console.log(`\n⏰ Engine tick: Train ${trainNo} — processing next station`);

            // ─── STEP 1: Process station arrival (deboarding, no-shows, RAC upgrades) ───
            const result = await StationEventService.processStationArrival(trainState);

            // ─── STEP 2: Move to next station ───
            trainState.currentStationIdx++;

            // ─── STEP 3: Unlock station upgrade lock ───
            if (typeof trainState.unlockStationForUpgrades === 'function') {
                trainState.unlockStationForUpgrades();
            }

            console.log(`   🚉 Train ${trainNo} → Station ${trainState.currentStationIdx}: ${trainState.getCurrentStation()?.name}`);

            // ─── STEP 4: Update stats ───
            if (typeof trainState.updateStats === 'function') {
                trainState.updateStats();
            }

            // ─── STEP 5: Persist state to MongoDB ───
            await RuntimeStateService.saveState({
                trainNo: trainState.trainNo,
                journeyDate: trainState.journeyDate,
                journeyStarted: trainState.journeyStarted,
                currentStationIdx: trainState.currentStationIdx,
                engineRunning: true,
                lastTickAt: new Date()
            });

            // ─── STEP 6: Update train status in Trains_Details ───
            const { updateTrainStatus } = require('../controllers/trainController');
            const currentStationName = trainState.getCurrentStation()?.name || null;

            if (trainState.isJourneyComplete()) {
                await updateTrainStatus(trainNo, 'COMPLETE', {
                    currentStation: currentStationName,
                    currentStationIdx: trainState.currentStationIdx,
                    totalStations: trainState.stations?.length || null
                });
            } else {
                await updateTrainStatus(trainNo, 'RUNNING', {
                    currentStation: currentStationName,
                    currentStationIdx: trainState.currentStationIdx,
                    totalStations: trainState.stations?.length || null
                });
            }

            // ─── STEP 7: WebSocket broadcasts ───
            if (wsManager) {
                // Broadcast station arrival
                wsManager.broadcastStationArrival({
                    trainNo,
                    station: result.station,
                    stationCode: result.stationCode,
                    stationIdx: result.stationIdx,
                    deboarded: result.deboarded,
                    noShows: result.noShows,
                    racAllocated: result.racAllocated,
                    boarded: result.boarded,
                    vacancies: result.vacancies,
                    stats: result.stats,
                    nextStation: trainState.getCurrentStation()?.name,
                    upgrades: result.upgrades || []
                });

                // Broadcast updated statistics
                wsManager.broadcastStatsUpdate({ ...trainState.stats, trainNo });
            }

            // ─── STEP 8: If journey complete, stop engine ───
            if (trainState.isJourneyComplete()) {
                console.log(`🏁 Train ${trainNo} reached final station, stopping engine`);

                if (wsManager) {
                    wsManager.broadcastTrainUpdate('JOURNEY_COMPLETE', {
                        trainNo,
                        finalStation: trainState.stations[trainState.stations.length - 1].name,
                        totalPassengers: trainState.stats?.totalPassengers,
                        totalDeboarded: trainState.stats?.totalDeboarded,
                        totalNoShows: trainState.stats?.totalNoShows,
                        totalRACUpgraded: trainState.stats?.totalRACUpgraded
                    });
                }

                this.stopEngine(trainNo);

                // Persist that engine is no longer running
                await RuntimeStateService.saveState({
                    trainNo: trainState.trainNo,
                    journeyDate: trainState.journeyDate,
                    journeyStarted: trainState.journeyStarted,
                    currentStationIdx: trainState.currentStationIdx,
                    engineRunning: false,
                    lastTickAt: new Date()
                });
                return;
            }

            // Update next tick time
            const engine = this.engines.get(trainNo);
            if (engine) {
                engine.nextTickAt = new Date(Date.now() + engine.intervalMs);
            }

        } catch (error) {
            console.error(`❌ Engine tick error for train ${trainNo}:`, error.message);
            // Don't stop on error — retry on next tick
        }
    }

    /**
     * Stop a train's engine.
     * Called when: journey completes, admin resets train, or server shuts down.
     * @param {string} trainNo
     * @returns {boolean}
     */
    stopEngine(trainNo) {
        const key = String(trainNo);
        const engine = this.engines.get(key);
        if (engine) {
            clearInterval(engine.timer);
            this.engines.delete(key);
            console.log(`🛑 Engine stopped for train ${trainNo}`);
            return true;
        }
        return false;
    }

    /**
     * Get all running engines (for admin dashboard / landing page)
     * @returns {Array<Object>}
     */
    getRunningEngines() {
        return Array.from(this.engines.values()).map(e => ({
            trainNo: e.trainNo,
            intervalMs: e.intervalMs,
            startedAt: e.startedAt,
            nextTickAt: e.nextTickAt,
            timeUntilNextTick: Math.max(0, e.nextTickAt.getTime() - Date.now())
        }));
    }

    /**
     * Check if a specific train engine is running
     * @param {string} trainNo
     * @returns {boolean}
     */
    isRunning(trainNo) {
        return this.engines.has(String(trainNo));
    }

    /**
     * Get time remaining until next tick (ms)
     * @param {string} trainNo
     * @returns {number|null}
     */
    getTimeUntilNextTick(trainNo) {
        const engine = this.engines.get(String(trainNo));
        if (!engine) return null;
        return Math.max(0, engine.nextTickAt.getTime() - Date.now());
    }

    /**
     * Stop ALL engines (for graceful server shutdown)
     */
    stopAll() {
        for (const [trainNo] of this.engines) {
            this.stopEngine(trainNo);
        }
        console.log('🛑 All train engines stopped');
    }
}

module.exports = new TrainEngineService();
