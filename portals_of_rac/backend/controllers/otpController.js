// backend/controllers/otpController.js
const OTPService = require('../services/OTPService');
const db = require('../config/db');

class OTPController {
    /**
     * Send OTP to passenger email
     */
    async sendOTP(req, res) {
        try {
            const { irctcId, pnr, purpose } = req.body;

            if (!irctcId || !pnr) {
                return res.status(400).json({
                    success: false,
                    message: 'IRCTC ID and PNR are required'
                });
            }

            // Find passenger to get email
            const collection = db.getPassengersCollection();
            const passenger = await collection.findOne({ PNR_Number: pnr });

            if (!passenger) {
                return res.status(404).json({
                    success: false,
                    message: 'Passenger not found'
                });
            }

            // Verify IRCTC ID matches
            if (passenger.IRCTC_ID !== irctcId) {
                return res.status(403).json({
                    success: false,
                    message: 'IRCTC ID does not match PNR'
                });
            }

            // Get email (handle both field names)
            let email = passenger.Email || passenger.email;

            // ✅ Fallback: If no email on train passenger data, check passenger_accounts
            if (!email && passenger.IRCTC_ID) {
                try {
                    const { COLLECTIONS } = require('../config/collections');
                    const racDb = await db.getDb();
                    const accountsCollection = racDb.collection(COLLECTIONS.PASSENGER_ACCOUNTS);
                    const account = await accountsCollection.findOne({
                        IRCTC_ID: passenger.IRCTC_ID
                    });
                    if (account) {
                        email = account.email || account.Email;
                    }
                } catch (lookupErr) {
                    console.warn('⚠️ Fallback email lookup failed:', lookupErr.message);
                }
            }

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'No email address found for this passenger. Please register with an email first.'
                });
            }

            // Send OTP
            const result = await OTPService.sendOTP(
                irctcId,
                pnr,
                email,
                purpose || 'ticket action'
            );

            res.json({
                success: true,
                message: `OTP sent to ${email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`,
                expiresIn: result.expiresIn
            });

        } catch (error) {
            console.error('❌ Error sending OTP:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to send OTP'
            });
        }
    }

    /**
     * Verify OTP
     */
    async verifyOTP(req, res) {
        try {
            const { irctcId, pnr, otp } = req.body;

            if (!irctcId || !pnr || !otp) {
                return res.status(400).json({
                    success: false,
                    message: 'IRCTC ID, PNR, and OTP are required'
                });
            }

            // Verify OTP
            const result = await OTPService.verifyOTP(irctcId, pnr, otp);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'OTP verified successfully',
                    verified: true
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.message,
                    verified: false
                });
            }

        } catch (error) {
            console.error('❌ Error verifying OTP:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify OTP',
                verified: false
            });
        }
    }
}

module.exports = new OTPController();
