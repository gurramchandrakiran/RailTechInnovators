// backend/server.js (MAIN SERVER WITH WEBSOCKET - CORRECTED)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const db = require('./config/db');
const { COLLECTIONS, DBS } = require('./config/collections');
const wsManager = require('./config/websocket');
const apiRoutes = require('./routes/api');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const { validateEnv } = require('./utils/envValidator');
const cookieParser = require('cookie-parser');
const { csrfProtection, getCsrfToken } = require('./middleware/csrf');

// Validate environment variables on startup
validateEnv();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for production (Render, Heroku, etc.)
// Required for express-rate-limit to work behind reverse proxies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',  // Unified Frontend (Vite)
    'http://localhost:3001',  // Old Admin Portal (Vite)
    'http://localhost:5174',  // Old TTE Portal (Vite)
    'http://localhost:5175',  // Old Passenger Portal (Vite)
    'https://passengerportal.vercel.app',
    'https://rac-tte.vercel.app',
    'https://rac-admin-page.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSRF Protection - applies to state-changing requests
app.use(csrfProtection);

// Rate limiting - applies to all /api routes
app.use('/api', apiLimiter);

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Create HTTP Server
const httpServer = http.createServer(app);

// CSRF Token endpoint - must be before API routes
app.get('/api/csrf-token', getCsrfToken);

// API Routes
app.use('/api', apiRoutes);



// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'RAC Reallocation API Server',
    version: '2.0.0',
    status: 'running',
    features: [
      'Two Database Architecture (rac + PassengerDB)',
      'WebSocket Real-time Updates',
      'Segment-based Vacancy Tracking',
      'Dynamic RAC Allocation',
      'Station Event Processing'
    ],
    endpoints: {
      health: 'GET /api/health',
      train: {
        initialize: 'POST /api/train/initialize',
        startJourney: 'POST /api/train/start-journey',
        state: 'GET /api/train/state',
        nextStation: 'POST /api/train/next-station',
        reset: 'POST /api/train/reset',
        stats: 'GET /api/train/stats'
      },
      reallocation: {
        markNoShow: 'POST /api/passenger/no-show',
        racQueue: 'GET /api/train/rac-queue',
        vacantBerths: 'GET /api/train/vacant-berths',
        searchPassenger: 'GET /api/passenger/search/:pnr',
        eligibility: 'GET /api/reallocation/eligibility',
        apply: 'POST /api/reallocation/apply'
      },
      passengers: {
        all: 'GET /api/passengers/all',
        byStatus: 'GET /api/passengers/status/:status',
        counts: 'GET /api/passengers/counts'
      },
      visualization: {
        segmentMatrix: 'GET /api/visualization/segment-matrix',
        graph: 'GET /api/visualization/graph',
        heatmap: 'GET /api/visualization/heatmap',
        berthTimeline: 'GET /api/visualization/berth-timeline/:coach/:berth',
        vacancyMatrix: 'GET /api/visualization/vacancy-matrix'
      }
    },
    websocket: {
      url: `ws://localhost:${PORT}`,
      connectedClients: wsManager.getClientCount(),
      events: [
        'TRAIN_UPDATE',
        'STATION_ARRIVAL',
        'RAC_REALLOCATION',
        'NO_SHOW',
        'STATS_UPDATE'
      ]
    }
  });
});

// Health check with cache metrics
const CacheService = require('./services/CacheService');

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    websocket: {
      connectedClients: wsManager.getClientCount()
    },
    cache: CacheService.getMetrics()
  });
});

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // ═══════════════════════════════════════════════════════════
    // MULTI-TRAIN BOOTSTRAP MODE
    // Connect to MongoDB for auth & Trains_Details only.
    // Per-train config (stations, passengers) is loaded dynamically
    // when a train is selected from the Landing Page.
    // ═══════════════════════════════════════════════════════════
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    // Connect in bootstrap mode (auth + Trains_Details only)
    try {
      if (mongoUri) {
        const bootstrapConfig = {
          mongoUri: mongoUri,
          trainDetailsDb: DBS.TRAIN_DETAILS,
          trainDetailsCollection: COLLECTIONS.TRAINS_DETAILS,
        };
        await db.connect(bootstrapConfig);
      } else {
        console.warn('⚠️ No MONGODB_URI in .env — waiting for runtime configuration via /api/config/setup');
      }

      // ═══════════════════════════════════════════════════════════
      // CLEANUP OLD SESSION DATA ON SERVER START
      // This ensures no duplicate reallocations from previous sessions
      // ═══════════════════════════════════════════════════════════
      try {
        // Use rac DB (available in bootstrap mode) to clean session data
        const racDb = await db.getDb();
        if (racDb) {
          const stationReallocations = racDb.collection(COLLECTIONS.STATION_REALLOCATIONS);
          const reallocResult = await stationReallocations.deleteMany({});
          if (reallocResult.deletedCount > 0) {
            console.log(`🗑️ Server start: Cleared ${reallocResult.deletedCount} old reallocations`);
          }

          const upgradeNotifications = racDb.collection(COLLECTIONS.UPGRADE_NOTIFICATIONS);
          const notifResult = await upgradeNotifications.deleteMany({});
          if (notifResult.deletedCount > 0) {
            console.log(`🗑️ Server start: Cleared ${notifResult.deletedCount} old notifications`);
          }
          console.log('✅ Old session data cleared - fresh start');
        }
      } catch (cleanupErr) {
        console.warn('⚠️ Could not clear old data on startup:', cleanupErr.message);
      }

    } catch (error) {
      console.warn('⚠️ DB not connected at startup:', error.message);
      console.warn('You can POST /api/config/setup to configure runtime.');
    }

    // Initialize WebSocket (independent of DB) and start server
    wsManager.initialize(httpServer);

    httpServer.listen(PORT, () => {

      console.log('');
      console.log('╔════════════════════════════════════════════════╗');
      console.log('║   🚂 RAC REALLOCATION API SERVER V3.0        ║');
      console.log('║      Multi-Train Architecture                 ║');
      console.log('╚════════════════════════════════════════════════╝');
      console.log(`✅ HTTP Server:    http://localhost:${PORT}`);
      console.log(`✅ WebSocket:      ws://localhost:${PORT}`);
      console.log(`✅ Environment:    ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ Node Version:   ${process.version}`);
      console.log('');
      console.log('📊 Configuration:');
      console.log(`   Auth DB:         ${DBS.STATIONS}`);
      console.log(`   Passengers DB:   ${DBS.PASSENGERS}`);
      console.log(`   Trains Registry: ${COLLECTIONS.TRAINS_DETAILS}`);
      console.log(`   Mode:            Multi-Train (per-train config from Trains_Details)`);
      console.log('');
      console.log(`📡 WebSocket Server: Ready (${wsManager.getClientCount()} clients)`);
      console.log('');

      // Start group upgrade timeout processor
      const GroupUpgradeService = require('./services/GroupUpgradeService');
      GroupUpgradeService.startTimeoutProcessor();
      console.log('');

      console.log('🎯 Ready to accept requests!');
      console.log('');
      console.log('Try:');
      console.log(`  curl http://localhost:${PORT}/`);
      console.log(`  curl http://localhost:${PORT}/api/health`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Unexpected error in startServer:', error.message);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');

  // Stop group upgrade timeout processor
  const GroupUpgradeService = require('./services/GroupUpgradeService');
  GroupUpgradeService.stopTimeoutProcessor();

  // Close WebSocket connections
  wsManager.closeAll();

  // Close MongoDB connections
  await db.close();

  // Close HTTP server
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received. Shutting down...');
  wsManager.closeAll();
  await db.close();
  process.exit(0);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();