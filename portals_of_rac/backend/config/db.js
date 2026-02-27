// backend/config/db.js - DYNAMIC DATABASE VERSION

const { MongoClient } = require("mongodb");
require("dotenv").config();

let stationsClient = null;
let passengersClient = null;

class Database {
  constructor() {
    this.stationsDb = null;
    this.passengersDb = null;
    this.trainDetailsDb = null;
    this.stationsCollection = null;
    this.passengersCollection = null;
    this.trainDetailsCollection = null;
    this.currentTrainNo = null;
    this.config = null;
    this.mongoUri = null;
    this.stationsDbName = null;
    this.passengersDbName = null;
    this.trainDetailsDbName = null;
    this.stationsCollectionName = null;
    this.passengersCollectionName = null;
    this.trainDetailsCollectionName = null;

    // Connection-ready gate: blocks queries while reconnecting
    this._isReady = false;
    this._readyResolve = null;
    this._readyPromise = Promise.resolve(); // starts resolved (no gate)
  }

  /**
   * Connect to MongoDB using dynamic configuration
   */
  async connect(config = null) {
    try {
      // ── Gate: block queries while reconnecting ──
      this._isReady = false;
      this._readyPromise = new Promise(resolve => { this._readyResolve = resolve; });

      // Use provided config or global config only. No env/default fallbacks.
      const finalConfig = config || global.RAC_CONFIG || {};

      // Validate required config
      if (
        !finalConfig.mongoUri ||
        !finalConfig.stationsDb ||
        !finalConfig.passengersDb ||
        !finalConfig.stationsCollection ||
        !finalConfig.passengersCollection
      ) {
        console.warn(
          "⚠️ Partial config. Initializing with env defaults for bootstrapping...",
        );

        // Default to localhost/rac/Trains_Details if not provided
        this.mongoUri = finalConfig.mongoUri || "mongodb://localhost:27017";
        this.trainDetailsDbName =
          finalConfig.trainDetailsDb || DBS.TRAIN_DETAILS;
        this.trainDetailsCollectionName =
          finalConfig.trainDetailsCollection || COLLECTIONS.TRAINS_DETAILS;

        // Also connect stationsDb and passengersDb from env defaults
        this.stationsDbName = finalConfig.stationsDb || process.env.STATIONS_DB || 'rac';
        this.passengersDbName = finalConfig.passengersDb || process.env.PASSENGERS_DB || 'PassengersDB';

        // Close existing clients if any
        if (stationsClient) { try { await stationsClient.close(); } catch (e) { } }
        if (passengersClient) { try { await passengersClient.close(); } catch (e) { } }

        stationsClient = new MongoClient(this.mongoUri);
        await stationsClient.connect();

        this.trainDetailsDb = stationsClient.db(this.trainDetailsDbName);
        this.trainDetailsCollection = this.trainDetailsDb.collection(
          this.trainDetailsCollectionName,
        );

        // Connect stationsDb (same client, possibly same DB as trainDetails)
        this.stationsDb = stationsClient.db(this.stationsDbName);

        // Connect passengersDb via separate client
        passengersClient = new MongoClient(this.mongoUri);
        await passengersClient.connect();
        this.passengersDb = passengersClient.db(this.passengersDbName);

        console.log("✅ Connected in Bootstrap Mode:");
        console.log(`   📦 Trains_Details: ${this.trainDetailsDbName}`);
        console.log(`   📦 Stations: ${this.stationsDbName}`);
        console.log(`   📦 Passengers: ${this.passengersDbName}`);
        // ── Gate: connection ready (bootstrap path) ──
        this._isReady = true;
        if (this._readyResolve) this._readyResolve();
        return this;
      }

      this.config = finalConfig;
      this.mongoUri = finalConfig.mongoUri;
      this.stationsDbName = finalConfig.stationsDb;
      this.passengersDbName = finalConfig.passengersDb;
      this.trainDetailsDbName =
        finalConfig.trainDetailsDb || finalConfig.stationsDb;
      this.stationsCollectionName = finalConfig.stationsCollection;
      this.passengersCollectionName = finalConfig.passengersCollection;
      this.trainDetailsCollectionName =
        finalConfig.trainDetailsCollection || COLLECTIONS.TRAINS_DETAILS;
      this.currentTrainNo = finalConfig.trainNo;

      // Connection pooling configuration for performance
      const poolOptions = {
        minPoolSize: 10, // Minimum connections to keep open
        maxPoolSize: 50, // Maximum connections allowed
        maxIdleTimeMS: 45000, // Close idle connections after 45 seconds
        connectTimeoutMS: 10000, // Connection timeout: 10 seconds
        socketTimeoutMS: 30000, // Socket timeout: 30 seconds
        serverSelectionTimeoutMS: 5000,
        retryWrites: true,
        retryReads: true,
      };

      // Create MongoDB clients with connection pooling
      stationsClient = new MongoClient(this.mongoUri, poolOptions);
      passengersClient = new MongoClient(this.mongoUri, poolOptions);

      console.log("🔗 MongoDB connection pooling enabled (min: 10, max: 50)");

      // Connect to stations database
      await stationsClient.connect();
      this.stationsDb = stationsClient.db(this.stationsDbName);
      this.stationsCollection = this.stationsDb.collection(
        this.stationsCollectionName,
      );

      console.log("");
      console.log("╔════════════════════════════════════════════╗");
      console.log("║     ✅ MongoDB Connected (Stations)       ║");
      console.log("╚════════════════════════════════════════════╝");
      console.log(`📦 Database: ${this.stationsDbName}`);
      console.log(`📁 Collection: ${this.stationsCollectionName}`);
      console.log("");

      // Connect to passengers database
      await passengersClient.connect();
      this.passengersDb = passengersClient.db(this.passengersDbName);
      this.passengersCollection = this.passengersDb.collection(
        this.passengersCollectionName,
      );

      console.log("╔════════════════════════════════════════════╗");
      console.log("║   ✅ MongoDB Connected (Passengers)       ║");
      console.log("╚════════════════════════════════════════════╝");
      console.log(`📦 Database: ${this.passengersDbName}`);
      console.log(`📁 Collection: ${this.passengersCollectionName}`);
      console.log("");

      // Initialize Train Details collection (can be in same or different DB)
      this.trainDetailsDb = stationsClient.db(this.trainDetailsDbName);
      this.trainDetailsCollection = this.trainDetailsDb.collection(
        this.trainDetailsCollectionName,
      );
      console.log("╔════════════════════════════════════════════╗");
      console.log("║   ✅ MongoDB Connected (Train Details)     ║");
      console.log("╚════════════════════════════════════════════╝");
      console.log(`📦 Database: ${this.trainDetailsDbName}`);
      console.log(`📁 Collection: ${this.trainDetailsCollectionName}`);
      console.log("");

      // ── Gate: connection ready ──
      this._isReady = true;
      if (this._readyResolve) this._readyResolve();

      return this;
    } catch (err) {
      // Unblock waiters even on failure so they get an error instead of hanging
      this._isReady = true;
      if (this._readyResolve) this._readyResolve();
      console.error("❌ MongoDB connection error:", err);
      throw err;
    }
  }

  /**
   * Wait until the database connection is fully established.
   * Used by middleware to hold requests during reconnection.
   */
  async waitUntilReady() {
    if (this._isReady) return;
    await this._readyPromise;
  }

  /**
   * Switch to a different collection (for multi-train support)
   */
  switchTrain(
    trainNo,
    stationsCollectionName = null,
    passengersCollectionName = null,
  ) {
    this.currentTrainNo = trainNo;

    if (!stationsCollectionName || !passengersCollectionName) {
      throw new Error("Collection names are required when switching trains.");
    }

    this.stationsCollectionName = stationsCollectionName;
    this.passengersCollectionName = passengersCollectionName;

    this.stationsCollection = this.stationsDb.collection(
      stationsCollectionName,
    );
    this.passengersCollection = this.passengersDb.collection(
      passengersCollectionName,
    );

    console.log(`\n🔄 Switched to train ${trainNo}`);
    console.log(`📁 Stations: ${stationsCollectionName}`);
    console.log(`📁 Passengers: ${passengersCollectionName}\n`);
  }

  /**
   * Switch databases and collections based on Train_Details metadata
   */
  switchTrainByDetails({
    stationsDb,
    stationsCollection,
    passengersDb,
    passengersCollection,
    trainNo,
  }) {
    this.currentTrainNo = trainNo || this.currentTrainNo;
    if (
      !stationsDb ||
      !stationsCollection ||
      !passengersDb ||
      !passengersCollection
    ) {
      throw new Error(
        "All DB and collection names are required for switchTrainByDetails",
      );
    }

    // Re-point databases using existing clients
    this.stationsDbName = stationsDb;
    this.passengersDbName = passengersDb;
    this.stationsCollectionName = stationsCollection;
    this.passengersCollectionName = passengersCollection;

    this.stationsDb = this.stationsDb.client
      ? this.stationsDb.client.db(stationsDb)
      : stationsClient.db(stationsDb);
    this.passengersDb = this.passengersDb.client
      ? this.passengersDb.client.db(passengersDb)
      : passengersClient.db(passengersDb);

    this.stationsCollection = this.stationsDb.collection(stationsCollection);
    this.passengersCollection =
      this.passengersDb.collection(passengersCollection);

    console.log(`\n🔄 Switched databases for train ${this.currentTrainNo}`);
    console.log(`📦 Stations DB: ${stationsDb} / 📁 ${stationsCollection}`);
    console.log(
      `📦 Passengers DB: ${passengersDb} / 📁 ${passengersCollection}`,
    );
  }

  getStationsDb() {
    if (!this.stationsDb) {
      throw new Error("Stations database not connected. Call connect() first.");
    }
    return this.stationsDb;
  }

  getPassengersDb() {
    if (!this.passengersDb) {
      throw new Error(
        "Passengers database not connected. Call connect() first.",
      );
    }
    return this.passengersDb;
  }

  getStationsCollection() {
    if (!this.stationsCollection) {
      throw new Error(
        "Stations collection not initialized. Call connect() first.",
      );
    }
    return this.stationsCollection;
  }

  getPassengersCollection() {
    if (!this.passengersCollection) {
      throw new Error(
        "Passengers collection not initialized. Call connect() first.",
      );
    }
    return this.passengersCollection;
  }

  getTrainDetailsCollection() {
    if (!this.trainDetailsCollection) {
      throw new Error(
        "Train details collection not initialized. Call connect() first.",
      );
    }
    return this.trainDetailsCollection;
  }

  // ✅ DUAL-APPROVAL: Get station_reallocations collection for pending upgrades
  getStationReallocationCollection() {
    if (!this.passengersDb) {
      throw new Error(
        "Passengers database not initialized. Call connect() first.",
      );
    }
    return this.passengersDb.collection('station_reallocations');
  }

  async close() {
    try {
      if (stationsClient) await stationsClient.close();
      if (passengersClient) await passengersClient.close();
      console.log("📦 MongoDB connections closed");
    } catch (err) {
      console.error("Error closing MongoDB connections:", err);
    }
  }

  /**
   * Get the main 'rac' database for authentication collections
   * Used by authController to access tte_users and passenger_accounts
   */
  async getDb() {
    // Ensure we have a connection to MongoDB
    if (!stationsClient) {
      const { MongoClient } = require("mongodb");
      stationsClient = new MongoClient(
        this.mongoUri || "mongodb://localhost:27017",
      );
      await stationsClient.connect();
    }

    // Return the 'rac' database which contains auth collections
    return stationsClient.db("rac");
  }

  /**
   * Get any database by name, reusing the existing MongoDB connection.
   * Falls back to a fresh connection if stationsClient is not yet open.
   * Used by authController to query PassengersDB without opening a new client.
   *
   * @param {string} dbName - e.g. 'PassengersDB', 'rac'
   */
  async getDbByName(dbName) {
    if (!dbName) throw new Error("getDbByName: dbName is required");

    // Reuse the existing stationsClient connection if available
    if (stationsClient) {
      return stationsClient.db(dbName);
    }

    // stationsClient not yet open — open one now and cache it
    const { MongoClient } = require("mongodb");
    const uri =
      this.mongoUri ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      "mongodb://localhost:27017";
    stationsClient = new MongoClient(uri);
    await stationsClient.connect();
    return stationsClient.db(dbName);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      mongoUri: this.mongoUri,
      stationsDb: this.stationsDbName,
      passengersDb: this.passengersDbName,
      stationsCollection: this.stationsCollectionName,
      passengersCollection: this.passengersCollectionName,
      trainDetailsDb: this.trainDetailsDbName,
      trainDetailsCollection: this.trainDetailsCollectionName,
      trainNo: this.currentTrainNo,
    };
  }
}

const dbInstance = new Database();
module.exports = dbInstance;
