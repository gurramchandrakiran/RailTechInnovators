// backend/models/UpgradeNotification.ts
import mongoose, { Schema, Document } from 'mongoose';

// Upgrade Notification interface
export interface IUpgradeNotification extends Document {
    pnr: string;
    irctcId: string;
    passengerName: string;
    currentBerth: string;
    proposedCoach: string;
    proposedBerth: string;
    proposedBerthFull: string;
    proposedBerthType: string;
    stationCode: string;
    stationName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    tteApproved: boolean;
    passengerApproved: boolean;
    expiresAt: Date;
}

// Mongoose Schema
const UpgradeNotificationSchema = new Schema<IUpgradeNotification>({
    pnr: { type: String, required: true, index: true },
    irctcId: { type: String, required: true, index: true },
    passengerName: { type: String, required: true },
    currentBerth: { type: String, required: true },
    proposedCoach: { type: String, required: true },
    proposedBerth: { type: String, required: true },
    proposedBerthFull: { type: String, required: true },
    proposedBerthType: { type: String, required: true },
    stationCode: { type: String, required: true },
    stationName: { type: String, required: true },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'],
        default: 'PENDING',
        index: true
    },
    tteApproved: { type: Boolean, default: false },
    passengerApproved: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true }
}, {
    timestamps: true,
    collection: 'upgrade_notifications'
});

// TTL index - auto-delete expired notifications after 24 hours
UpgradeNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IUpgradeNotification>('UpgradeNotification', UpgradeNotificationSchema);
