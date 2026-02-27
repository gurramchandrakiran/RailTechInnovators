// backend/models/TTEUser.ts
import mongoose, { Schema, Document } from 'mongoose';

// TTE User interface
export interface ITTEUser extends Document {
    employeeId: string;
    password: string;
    name: string;
    role: 'Admin' | 'TTE';
    email?: string;
    lastLogin?: Date;
    isActive: boolean;
}

// Mongoose Schema
const TTEUserSchema = new Schema<ITTEUser>({
    employeeId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Admin', 'TTE'],
        default: 'TTE'
    },
    email: {
        type: String
    },
    lastLogin: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'tte_users'
});

export default mongoose.model<ITTEUser>('TTEUser', TTEUserSchema);
