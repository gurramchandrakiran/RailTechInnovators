// backend/validation/schemas.ts
// Zod validation schemas for API request validation

import { z } from 'zod';

// =============================================
// Train Routes Validation
// =============================================

export const initializeTrainSchema = z.object({
    trainNo: z.string().min(1, 'Train number is required'),
    journeyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    trainName: z.string().optional()
});

// =============================================
// Auth Routes Validation
// =============================================

export const loginSchema = z.object({
    employeeId: z.string().min(1, 'Employee ID is required'),
    password: z.string().min(1, 'Password is required')
});

export const passengerLoginSchema = z.object({
    irctcId: z.string().min(1, 'IRCTC ID is required'),
    pnr: z.string().min(1, 'PNR is required')
});

// =============================================
// TTE Routes Validation
// =============================================

export const markNoShowSchema = z.object({
    pnr: z.string().min(1, 'PNR is required')
});

export const revertNoShowSchema = z.object({
    pnr: z.string().min(1, 'PNR is required')
});

export const markBoardedSchema = z.object({
    pnr: z.string().min(1, 'PNR is required')
});

export const confirmUpgradeSchema = z.object({
    pnr: z.string().min(1, 'PNR is required'),
    notificationId: z.string().optional()
});

export const approveReallocationSchema = z.object({
    reallocationId: z.string().min(1, 'Reallocation ID is required')
});

// =============================================
// Passenger Routes Validation
// =============================================

export const changeBoardingStationSchema = z.object({
    pnr: z.string().min(1, 'PNR is required'),
    irctcId: z.string().min(1, 'IRCTC ID is required'),
    newStationCode: z.string().min(1, 'New station code is required')
});

export const selfCancelSchema = z.object({
    pnr: z.string().min(1, 'PNR is required'),
    irctcId: z.string().min(1, 'IRCTC ID is required')
});

export const approveUpgradeSchema = z.object({
    upgradeId: z.string().min(1, 'Upgrade ID is required'),
    irctcId: z.string().min(1, 'IRCTC ID is required')
});

// =============================================
// OTP Routes Validation
// =============================================

export const sendOtpSchema = z.object({
    irctcId: z.string().min(1, 'IRCTC ID is required'),
    pnr: z.string().min(1, 'PNR is required'),
    purpose: z.string().optional()
});

export const verifyOtpSchema = z.object({
    irctcId: z.string().min(1, 'IRCTC ID is required'),
    pnr: z.string().min(1, 'PNR is required'),
    otp: z.string().length(6, 'OTP must be 6 digits')
});

// =============================================
// Get Params Validation
// =============================================

export const pnrParamSchema = z.object({
    pnr: z.string().min(1, 'PNR is required')
});

export const irctcIdParamSchema = z.object({
    irctcId: z.string().min(1, 'IRCTC ID is required')
});

// Export types inferred from schemas
export type InitializeTrainInput = z.infer<typeof initializeTrainSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PassengerLoginInput = z.infer<typeof passengerLoginSchema>;
export type MarkNoShowInput = z.infer<typeof markNoShowSchema>;
export type ConfirmUpgradeInput = z.infer<typeof confirmUpgradeSchema>;
export type ChangeBoardingStationInput = z.infer<typeof changeBoardingStationSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
