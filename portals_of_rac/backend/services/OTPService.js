// backend/services/OTPService.js
// UPDATED: Now uses MongoDB for OTP storage (survives server restarts)

const crypto = require('crypto');
const NotificationService = require('./NotificationService');
const db = require('../config/db');
const { COLLECTIONS } = require('../config/collections');

class OTPService {
    constructor() {
        this.OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
        this.collectionName = process.env.OTP_STORE_COLLECTION || 'otp_store';
        this.initialized = false;

        console.log('🔐 OTPService initialized (MongoDB-backed)');
    }

    /**
     * Initialize MongoDB collection with TTL index
     */
    async initializeCollection() {
        if (this.initialized) return;

        try {
            const racDb = await db.getDb();
            const collection = racDb.collection(this.collectionName);

            // Create TTL index for automatic expiry (expires after 5 minutes)
            // Wrap in try-catch to handle case where index exists with different name
            try {
                await collection.createIndex(
                    { createdAt: 1 },
                    { expireAfterSeconds: 300 } // 5 minutes
                );
            } catch (indexError) {
                // Ignore IndexOptionsConflict (code 85) - index already exists
                if (indexError.code !== 85) {
                    throw indexError;
                }
            }

            this.initialized = true;
            console.log('✅ OTP collection initialized with TTL index');
        } catch (error) {
            console.error('❌ Failed to initialize OTP collection:', error.message);
        }
    }

    /**
     * Get OTP collection
     */
    async getCollection() {
        await this.initializeCollection();
        const racDb = await db.getDb();
        return racDb.collection(this.collectionName);
    }

    /**
     * Generate a 6-digit OTP
     */
    generateOTP() {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Generate and send OTP via email
     */
    async sendOTP(irctcId, pnr, email, purpose = 'verification') {
        try {
            const collection = await this.getCollection();

            // Generate OTP
            const otp = this.generateOTP();
            const key = `${irctcId}_${pnr}`;

            // Store OTP in MongoDB (replaces existing if any)
            await collection.updateOne(
                { key },
                {
                    $set: {
                        key,
                        otp,
                        irctcId,
                        pnr,
                        attempts: 0,
                        maxAttempts: 3,
                        createdAt: new Date() // TTL index uses this
                    }
                },
                { upsert: true }
            );

            // Send OTP email
            await NotificationService.emailTransporter.sendMail({
                from: `"Indian Railways OTP" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: '🔐 Your OTP for Indian Railways',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; }
                            .header { background: #2c3e50; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .otp-box { background: #ffffff; border: 3px dashed #3498db; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
                            .otp-code { font-size: 36px; font-weight: bold; color: #2c3e50; letter-spacing: 8px; }
                            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 15px 0; font-size: 14px; }
                            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 style="margin: 0;">🔐 OTP Verification</h1>
                                <p style="margin: 10px 0 0 0;">Indian Railways - RAC System</p>
                            </div>
                            <div class="content">
                                <p>Your One-Time Password (OTP) for ${purpose} is:</p>
                                
                                <div class="otp-box">
                                    <div class="otp-code">${otp}</div>
                                </div>
                                
                                <div class="warning">
                                    <strong>⚠️ Important:</strong>
                                    <ul style="margin: 5px 0; padding-left: 20px;">
                                        <li>This OTP is valid for <strong>5 minutes</strong></li>
                                        <li>Do not share this OTP with anyone</li>
                                        <li>Indian Railways will never ask for your OTP via phone or SMS</li>
                                    </ul>
                                </div>
                                
                                <p style="margin-top: 20px; font-size: 14px; color: #666;">
                                    <strong>PNR:</strong> ${pnr}<br>
                                    <strong>IRCTC ID:</strong> ${irctcId}
                                </p>
                                
                                <p style="font-size: 13px; color: #999; margin-top: 15px;">
                                    If you didn't request this OTP, please ignore this email.
                                </p>
                            </div>
                            <div class="footer">
                                <p>This is an automated email from Indian Railways</p>
                                <p>Please do not reply to this email</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            });

            console.log(`📧 OTP sent to ${email} for ${irctcId}/${pnr} (stored in MongoDB)`);

            return {
                success: true,
                message: 'OTP sent successfully',
                expiresIn: this.OTP_EXPIRY_MS / 1000 // in seconds
            };

        } catch (error) {
            console.error('❌ Error sending OTP:', error);
            throw new Error('Failed to send OTP: ' + error.message);
        }
    }

    /**
     * Verify OTP
     */
    async verifyOTP(irctcId, pnr, otpInput) {
        try {
            const collection = await this.getCollection();
            const key = `${irctcId}_${pnr}`;

            // Find OTP record
            const otpRecord = await collection.findOne({ key });

            // Check if OTP exists
            if (!otpRecord) {
                return {
                    success: false,
                    message: 'No OTP found. Please request a new OTP.'
                };
            }

            // Check max attempts
            if (otpRecord.attempts >= otpRecord.maxAttempts) {
                await collection.deleteOne({ key });
                return {
                    success: false,
                    message: 'Maximum attempts exceeded. Please request a new OTP.'
                };
            }

            // Increment attempts
            await collection.updateOne(
                { key },
                { $inc: { attempts: 1 } }
            );

            // Verify OTP
            if (otpRecord.otp === otpInput.toString()) {
                // OTP is correct - delete it
                await collection.deleteOne({ key });
                console.log(`✅ OTP verified successfully for ${irctcId}/${pnr}`);
                return {
                    success: true,
                    message: 'OTP verified successfully'
                };
            } else {
                // OTP is incorrect
                const attemptsLeft = otpRecord.maxAttempts - otpRecord.attempts - 1;
                return {
                    success: false,
                    message: `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`
                };
            }

        } catch (error) {
            console.error('❌ Error verifying OTP:', error);
            return {
                success: false,
                message: 'Error verifying OTP. Please try again.'
            };
        }
    }

    /**
     * Clear OTP (for cleanup)
     */
    async clearOTP(irctcId, pnr) {
        try {
            const collection = await this.getCollection();
            const key = `${irctcId}_${pnr}`;
            await collection.deleteOne({ key });
        } catch (error) {
            console.error('Error clearing OTP:', error.message);
        }
    }

    /**
     * Get OTP status (for debugging)
     */
    async getOTPStatus(irctcId, pnr) {
        try {
            const collection = await this.getCollection();
            const key = `${irctcId}_${pnr}`;
            const otpRecord = await collection.findOne({ key });

            if (!otpRecord) {
                return { exists: false };
            }

            return {
                exists: true,
                createdAt: otpRecord.createdAt,
                attempts: otpRecord.attempts,
                maxAttempts: otpRecord.maxAttempts
            };
        } catch (error) {
            console.error('Error getting OTP status:', error.message);
            return { exists: false, error: error.message };
        }
    }
}

module.exports = new OTPService();

