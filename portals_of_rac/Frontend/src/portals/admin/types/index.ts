// admin-portal/src/types/index.ts
// Shared TypeScript type definitions for all frontend portals

// =============================================
// Station Types
// =============================================
export interface Station {
    code: string;
    name: string;
    arrivalTime?: string;
    departureTime?: string;
    distance?: number;
    day?: number;
}

// =============================================
// Passenger Types
// =============================================
export interface Passenger {
    pnr: string;
    name: string;
    age: number;
    gender: string;
    pnrStatus: 'CNF' | 'RAC' | 'WL';
    racStatus?: string;
    coach: string;
    seatNo: string;
    berthType: string;
    bookingClass: string;
    from: string;
    to: string;
    fromIdx: number;
    toIdx: number;
    passengerStatus: 'Online' | 'Offline';
    irctcId: string;
    email?: string;
    boarded: boolean;
    noShow: boolean;
    deboarded: boolean;
    upgradedFrom?: string;
}

// =============================================
// Train Types
// =============================================
export interface TrainState {
    trainNo: string;
    trainName: string;
    journeyDate: string;
    stations: Station[];
    currentStationIdx: number;
    journeyStarted: boolean;
    stats: TrainStats;
}

export interface TrainStats {
    totalPassengers: number;
    cnfPassengers: number;
    racPassengers: number;
    currentOnboard: number;
    totalBoarded: number;
    totalDeboarded: number;
    totalNoShows: number;
    totalRACUpgraded: number;
}

// =============================================
// API Response Types
// =============================================
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

export interface PassengersResponse {
    passengers: Passenger[];
    total: number;
}

// =============================================
// Upgrade Notification Types
// =============================================
export interface UpgradeNotification {
    id: string;
    pnr: string;
    irctcId: string;
    passengerName: string;
    currentBerth: string;
    proposedCoach: string;
    proposedBerth: string;
    proposedBerthType: string;
    stationCode: string;
    stationName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    createdAt: Date;
    expiresAt: Date;
}

// =============================================
// Reallocation Types
// =============================================
export interface PendingReallocation {
    id: string;
    stationCode: string;
    stationName: string;
    racPassenger: Passenger;
    vacantBerth: {
        coach: string;
        berthNo: string;
        berthType: string;
    };
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Date;
}

// =============================================
// User/Auth Types
// =============================================
export interface User {
    userId: string;
    role: 'ADMIN' | 'TTE' | 'PASSENGER';
    name?: string;
    employeeId?: string;
    irctcId?: string;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    token: string | null;
}
