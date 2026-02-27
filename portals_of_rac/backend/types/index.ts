// backend/types/index.ts
// Core type definitions for the RAC Reallocation System

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
// Seat Preference Types (NEW)
// =============================================
export type SeatPreference =
    | 'Lower Berth'
    | 'Middle Berth'
    | 'Upper Berth'
    | 'Side Lower'
    | 'Side Upper'
    | 'Window'
    | 'Aisle'
    | 'No Preference';

// IRCTC Standard: Maximum passengers per PNR
export const MAX_PASSENGERS_PER_PNR = 6;

// =============================================
// Passenger Types
// =============================================
export interface Passenger {
    PNR_Number: string;
    Passenger_Index: number;              // NEW: Position within booking (1, 2, 3...)
    Name: string;
    Age: number;
    Gender: 'Male' | 'Female' | 'Other';
    Seat_Preference: SeatPreference;      // NEW: Individual seat preference
    Preference_Priority: number;          // NEW: Auto-calculated priority
    Is_Group_Leader: boolean;             // NEW: Primary contact for booking
    PNR_Status: 'CNF' | 'RAC' | 'WL';
    Rac_status?: string;
    Assigned_Coach: string;
    Assigned_Berth: string;
    Berth_Type: 'SL' | 'SU' | 'LB' | 'MB' | 'UB' | 'Side-LB' | 'Side-UB' | string;
    Booking_Class: 'Sleeper' | '3AC';
    Boarding_Station: string;
    Deboarding_Station: string;
    Passenger_Status: 'Online' | 'Offline';
    IRCTC_ID: string;
    Email?: string;
    Mobile?: string;
    Train_Number?: string;
    Train_Name?: string;
    Journey_Date?: string;
    Boarded?: boolean;
    NO_show?: boolean;
    Deboarded?: boolean;
    Upgraded_From?: string;
    Preference_Matched?: boolean;         // NEW: Was seat preference fulfilled
    fromIdx?: number;
    toIdx?: number;
}

// In-memory passenger format (simplified)
export interface InMemoryPassenger {
    pnr: string;
    passengerIndex: number;               // NEW: Position within booking
    name: string;
    age: number;
    gender: string;
    seatPreference: SeatPreference;       // NEW: Individual seat preference
    preferencePriority: number;           // NEW: Priority score
    isGroupLeader: boolean;               // NEW: Primary contact
    pnrStatus: string;
    racStatus?: string;
    coach: string;
    seatNo: string;
    berthType: string;
    bookingClass: string;
    from: string;
    to: string;
    fromIdx: number;
    toIdx: number;
    passengerStatus: string;
    irctcId: string;
    email?: string;
    mobile?: string;
    boarded: boolean;
    noShow: boolean;
    deboarded: boolean;
    preferenceMatched?: boolean;          // NEW: Was preference fulfilled
}

// NEW: Booking group type for API responses
export interface BookingGroup {
    pnr: string;
    totalPassengers: number;
    irctcId: string;
    trainNumber: string;
    trainName?: string;
    journeyDate: string;
    boardingStation: string;
    deboardingStation: string;
    passengers: Passenger[];
    stats?: {
        boarded: number;
        noShow: number;
        cnf: number;
        rac: number;
    };
}

// =============================================
// Coach & Berth Types
// =============================================
export interface Berth {
    berthNo: number;
    fullBerthNo: string;
    type: string;
    status: 'VACANT' | 'OCCUPIED' | 'RAC';
    passengers: InMemoryPassenger[];
    segmentOccupancy: Map<string, InMemoryPassenger>;
}

export interface Coach {
    coachNo: string;
    class: 'Sleeper' | '3AC';
    capacity: number;
    berths: Berth[];
}

// =============================================
// Train Types
// =============================================
export interface TrainState {
    trainNo: string;
    trainName: string;
    journeyDate: string;
    stations: Station[];
    coaches: Coach[];
    racQueue: InMemoryPassenger[];
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
// API Request/Response Types
// =============================================
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

export interface InitializeTrainRequest {
    trainNo: string;
    journeyDate: string;
    trainName?: string;
}

export interface LoginRequest {
    employeeId: string;
    password: string;
}

export interface MarkNoShowRequest {
    pnr: string;
}

export interface UpgradeRequest {
    pnr: string;
    newCoach: string;
    newBerth: string;
}

// =============================================
// TTE User Types
// =============================================
export interface TTEUser {
    employeeId: string;
    password: string;
    name: string;
    role: 'Admin' | 'TTE';
    email?: string;
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
    tteApproved?: boolean;
    passengerApproved?: boolean;
}

// =============================================
// Station Reallocation Types
// =============================================
export interface StationReallocation {
    id: string;
    stationCode: string;
    stationName: string;
    racPassenger: InMemoryPassenger;
    vacantBerth: {
        coach: string;
        berthNo: string;
        berthType: string;
    };
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Date;
}
