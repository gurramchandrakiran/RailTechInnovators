// backend/models/Passenger.ts
// Updated: Support for multiple passengers per PNR with seat preferences
import mongoose, { Schema, Document } from 'mongoose';

// Seat preference options
export type SeatPreference =
    | 'Lower Berth'
    | 'Middle Berth'
    | 'Upper Berth'
    | 'Side Lower'
    | 'Side Upper'
    | 'Window'
    | 'Aisle'
    | 'No Preference';

// Passenger interface extending Mongoose Document
export interface IPassenger extends Document {
    PNR_Number: string;
    Passenger_Index: number;           // NEW: Position within booking (1, 2, 3...)
    Name: string;
    Age: number;
    Gender: 'Male' | 'Female' | 'Other';
    Seat_Preference: SeatPreference;   // NEW: Individual seat preference
    Preference_Priority: number;        // NEW: Auto-calculated priority (3=senior, 2=women, 1=adult, 0=child)
    Is_Group_Leader: boolean;           // NEW: Primary contact for booking
    PNR_Status: 'CNF' | 'RAC' | 'WL';
    Rac_status?: string;
    Assigned_Coach: string;
    Assigned_Berth: string;
    Berth_Type: string;
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
    Preference_Matched?: boolean;       // NEW: Was seat preference fulfilled
}

// Mongoose Schema
const PassengerSchema = new Schema<IPassenger>({
    // PNR_Number is no longer unique by itself - compound index with Passenger_Index
    PNR_Number: { type: String, required: true, index: true },

    // NEW: Passenger index within the booking group (1, 2, 3...)
    Passenger_Index: { type: Number, required: true, default: 1 },

    Name: { type: String, required: true },
    Age: { type: Number, required: true },
    Gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },

    // NEW: Seat preference fields
    Seat_Preference: {
        type: String,
        enum: ['Lower Berth', 'Middle Berth', 'Upper Berth', 'Side Lower', 'Side Upper', 'Window', 'Aisle', 'No Preference'],
        default: 'No Preference'
    },
    Preference_Priority: { type: Number, default: 0 },
    Is_Group_Leader: { type: Boolean, default: false },
    Preference_Matched: { type: Boolean, default: false },

    // Existing fields
    PNR_Status: { type: String, enum: ['CNF', 'RAC', 'WL'], required: true },
    Rac_status: { type: String, default: '-' },
    Assigned_Coach: { type: String, required: true },
    Assigned_Berth: { type: String, required: true },
    Berth_Type: { type: String, required: true },
    Booking_Class: { type: String, enum: ['Sleeper', '3AC'], required: true },
    Boarding_Station: { type: String, required: true },
    Deboarding_Station: { type: String, required: true },
    Passenger_Status: { type: String, enum: ['Online', 'Offline'], default: 'Offline' },
    IRCTC_ID: { type: String, required: true, index: true },
    Email: { type: String },
    Mobile: { type: String },
    Train_Number: { type: String },
    Train_Name: { type: String },
    Journey_Date: { type: String },
    Boarded: { type: Boolean, default: false },
    NO_show: { type: Boolean, default: false },
    Deboarded: { type: Boolean, default: false },
    Upgraded_From: { type: String }
}, {
    timestamps: true,
    collection: 'passengers' // Will be overridden when using dynamic collections
});

// NEW: Compound unique index - allows multiple passengers per PNR
PassengerSchema.index({ PNR_Number: 1, Passenger_Index: 1 }, { unique: true });

// Existing indexes for common queries
PassengerSchema.index({ IRCTC_ID: 1 });
PassengerSchema.index({ Boarding_Station: 1 });
PassengerSchema.index({ PNR_Status: 1 });

// NEW: Index for finding all passengers in a booking group
PassengerSchema.index({ PNR_Number: 1 });

// Pre-save hook to calculate preference priority
PassengerSchema.pre('save', function () {
    // Auto-calculate preference priority based on age and gender
    if (this.Age >= 60) {
        this.Preference_Priority = 3;  // Senior citizens - highest priority
    } else if (this.Gender === 'Female') {
        this.Preference_Priority = 2;  // Women - second priority
    } else if (this.Age >= 18) {
        this.Preference_Priority = 1;  // Adults
    } else {
        this.Preference_Priority = 0;  // Children
    }
});

// Static method to get all passengers for a PNR
PassengerSchema.statics.findByPNR = function (pnrNumber: string) {
    return this.find({ PNR_Number: pnrNumber }).sort({ Passenger_Index: 1 });
};

// Static method to get booking group summary
PassengerSchema.statics.getBookingGroup = async function (pnrNumber: string) {
    const passengers = await this.find({ PNR_Number: pnrNumber }).sort({ Passenger_Index: 1 });
    if (passengers.length === 0) return null;

    const leader = passengers.find((p: IPassenger) => p.Is_Group_Leader) || passengers[0];

    return {
        pnr: pnrNumber,
        totalPassengers: passengers.length,
        irctcId: leader.IRCTC_ID,
        trainNumber: leader.Train_Number,
        journeyDate: leader.Journey_Date,
        boardingStation: leader.Boarding_Station,
        deboardingStation: leader.Deboarding_Station,
        passengers: passengers
    };
};

// Export the model factory function for dynamic collection names
export const getPassengerModel = (collectionName: string) => {
    const modelName = `Passenger_${collectionName}`;

    // Return existing model if already compiled
    if (mongoose.models[modelName]) {
        return mongoose.models[modelName];
    }

    // Create new model with dynamic collection name
    return mongoose.model<IPassenger>(modelName, PassengerSchema, collectionName);
};

// Default export for static collection usage
export default mongoose.model<IPassenger>('Passenger', PassengerSchema);
