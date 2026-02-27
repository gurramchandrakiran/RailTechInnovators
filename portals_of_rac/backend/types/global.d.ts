// backend/types/global.d.ts
// Shared global type declarations to avoid conflicts

import { Db, Collection, Document } from 'mongodb';

/**
 * Configuration for RAC system database connections
 */
export interface RACConfig {
    mongoUri: string;
    stationsDb: string;
    passengersDb: string;
    trainDetailsDb?: string;
    stationsCollection: string;
    passengersCollection: string;
    trainDetailsCollection?: string;
    trainNo?: string;
    trainName?: string;
    journeyDate?: string;
}

/**
 * Database configuration subset (used by db.ts)
 */
export interface DatabaseConfig {
    mongoUri: string;
    stationsDb: string;
    passengersDb: string;
    trainDetailsDb?: string;
    stationsCollection: string;
    passengersCollection: string;
    trainDetailsCollection?: string;
    trainNo?: string;
}

/**
 * DB instance type
 */
export interface DatabaseInstance {
    connect(config?: RACConfig | null): Promise<DatabaseInstance>;
    close(): Promise<void>;
    getDb(): Promise<Db>;
    getStationsDb(): Db;
    getPassengersDb(): Db;
    getStationsCollection(): Collection<Document>;
    getPassengersCollection(): Collection<Document>;
    getTrainDetailsCollection(): Collection<Document>;
    getStationReallocationCollection(): Collection<Document>;
    getConfig(): DatabaseConfig & { trainNo: string | null };
    switchTrain(trainNo: string, stationsCollectionName: string | null, passengersCollectionName: string | null): void;
    switchTrainByDetails(details: {
        stationsDb: string;
        stationsCollection: string;
        passengersDb: string;
        passengersCollection: string;
        trainNo?: string;
    }): void;
}

// Extend global namespace
declare global {
    var RAC_CONFIG: RACConfig | undefined;
}

export { };
