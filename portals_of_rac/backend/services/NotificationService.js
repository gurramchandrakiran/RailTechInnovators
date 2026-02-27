// backend/services/NotificationService.js
const nodemailer = require('nodemailer');

class NotificationService {
    constructor() {
        // Email transporter — uses EMAIL_HOST/PORT if set, falls back to Gmail service
        const transportConfig = process.env.EMAIL_HOST
            ? {
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT || '587'),
                secure: process.env.EMAIL_PORT === '465',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            }
            : {
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            };

        this.emailTransporter = nodemailer.createTransport(transportConfig);

        // Configurable frontend URL for email links
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        console.log('📧 NotificationService initialized');
        console.log('   Email:', process.env.EMAIL_USER ? '✓ Configured' : '✗ Not configured');
        console.log('   SMTP:', process.env.EMAIL_HOST || 'gmail (default)');
    }

    /**
     * Send upgrade notification via ALL channels
     */
    async sendUpgradeNotification(passenger, oldStatus, newBerth) {
        const results = {
            email: { sent: false, error: null }
        };

        // 1. Send Email
        if (passenger.email && process.env.EMAIL_USER) {
            try {
                await this.sendEmail(passenger, oldStatus, newBerth);
                results.email.sent = true;
                console.log(`📧 Email sent to ${passenger.email}`);
            } catch (error) {
                results.email.error = error.message;
                console.error('❌ Email failed:', error.message);
            }
        }



        return results;
    }

    /**
     * Send email notification for upgrade
     */
    async sendEmail(passenger, oldStatus, newBerth) {
        const mailOptions = {
            from: `"Indian Railways RAC System" <${process.env.EMAIL_USER}>`,
            to: passenger.email,
            subject: '🎉 RAC Ticket Confirmed - Indian Railways',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        .info-table td { padding: 12px; border-bottom: 1px solid #ddd; }
                        .info-table td:first-child { font-weight: bold; width: 40%; }
                        .highlight { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0;">🎉 Congratulations!</h1>
                            <p style="margin: 10px 0 0 0; font-size: 18px;">Your RAC Ticket is Now Confirmed</p>
                        </div>
                        <div class="content">
                            <p>Dear <strong>${passenger.name}</strong>,</p>
                            <p>Great news! Your RAC ticket has been confirmed and you've been allocated a berth.</p>
                            
                            <div class="highlight">
                                <strong>Your New Berth: ${newBerth.fullBerthNo || `${newBerth.coachNo}-${newBerth.berthNo}`}</strong>
                            </div>
                            
                            <table class="info-table">
                                <tr>
                                    <td>PNR Number:</td>
                                    <td><strong>${passenger.pnr}</strong></td>
                                </tr>
                                <tr>
                                    <td>Previous Status:</td>
                                    <td>${oldStatus}</td>
                                </tr>
                                <tr>
                                    <td>New Status:</td>
                                    <td><strong style="color: #28a745;">CONFIRMED (CNF)</strong></td>
                                </tr>
                                <tr>
                                    <td>Berth Number:</td>
                                    <td><strong>${newBerth.fullBerthNo || `${newBerth.coachNo}-${newBerth.berthNo}`}</strong></td>
                                </tr>
                                <tr>
                                    <td>Coach:</td>
                                    <td>${newBerth.coachNo}</td>
                                </tr>
                                <tr>
                                    <td>Berth Type:</td>
                                    <td>${newBerth.type}</td>
                                </tr>
                            </table>
                            
                            <p>Please check your boarding pass on the passenger portal for updated details.</p>
                            <p><strong>Happy Journey!</strong></p>
                        </div>
                        <div class="footer">
                            <p>This is an automated notification from Indian Railways RAC Reallocation System</p>
                            <p>Please do not reply to this email</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        return this.emailTransporter.sendMail(mailOptions);
    }



    /**
     * Send NO-SHOW marked notification (both online and offline passengers)
     */
    async sendNoShowMarkedNotification(pnr, passenger) {
        const results = {
            email: { sent: false, error: null }
        };

        console.log(`📢 Sending NO-SHOW notification for PNR: ${pnr} (${passenger.passengerStatus})`);

        // Get email (handle both 'Email' and 'email' field names from MongoDB)
        const passengerEmail = passenger.Email || passenger.email;
        console.log(`🔍 DEBUG: Email="${passengerEmail}" | Configured="${process.env.EMAIL_USER}"`);

        // Send Email (for both online and offline)
        if (passengerEmail && process.env.EMAIL_USER) {
            try {
                const mailOptions = {
                    from: `"Indian Railways Alert" <${process.env.EMAIL_USER}>`,
                    to: passengerEmail,
                    subject: '⚠️ NO-SHOW Alert - Immediate Action Required',
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                                .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; }
                                .header { background: #e74c3c; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                                .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                                .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                                .info-table td { padding: 12px; border-bottom: 1px solid #ddd; }
                                .info-table td:first-child { font-weight: bold; width: 40%; }
                                .action-button { background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; font-weight: 600; }
                                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1 style="margin: 0;">⚠️ NO-SHOW Alert</h1>
                                    <p style="margin: 10px 0 0 0; font-size: 18px;">Immediate Action Required</p>
                                </div>
                                <div class="content">
                                    <p>Dear <strong>${passenger.name}</strong>,</p>
                                    <p>You have been marked as <strong>NO-SHOW</strong> by the Train Ticket Examiner (TTE) for your journey.</p>
                                    
                                    <div class="alert-box">
                                        <strong>⚠️ Important:</strong> If you are present on the train, please contact the TTE immediately or use the passenger portal to revert this status.
                                    </div>
                                    
                                    <table class="info-table">
                                        <tr>
                                            <td>PNR Number:</td>
                                            <td><strong>${pnr}</strong></td>
                                        </tr>
                                        <tr>
                                            <td>Berth:</td>
                                            <td>${passenger.coach}-${passenger.berth}</td>
                                        </tr>
                                        <tr>
                                            <td>Status:</td>
                                            <td><strong style="color: #e74c3c;">NO-SHOW</strong></td>
                                        </tr>
                                    </table>
                                    
                                    <p><strong>What this means:</strong></p>
                                    <ul>
                                        <li>Your berth may be allocated to another passenger</li>
                                        <li>You must contact the TTE if you are present on the train</li>
                                        <li>You can also use the passenger portal to dispute this status</li>
                                    </ul>
                                    
                                    <center>
                                        <a href="${this.frontendUrl}" class="action-button">Open Passenger Portal</a>
                                    </center>
                                    
                                    <p style="margin-top: 20px; font-size: 13px; color: #666;">
                                        If you are not on the train, please ignore this message.
                                    </p>
                                </div>
                                <div class="footer">
                                    <p>This is an automated alert from Indian Railways</p>
                                    <p>For assistance, contact TTE or railway helpdesk</p>
                                    <p>Please do not reply to this email</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                };

                await this.emailTransporter.sendMail(mailOptions);
                results.email.sent = true;
                console.log(`📧 NO-SHOW email sent to ${passengerEmail}`);
            } catch (error) {
                results.email.error = error.message;
                console.error('❌ NO-SHOW email failed:', error.message);
            }
        }



        return results;
    }

    /**
     * Send NO-SHOW reverted notification
     */
    async sendNoShowRevertedNotification(pnr, passenger) {
        const results = {
            email: { sent: false, error: null }
        };

        console.log(`✅ Sending NO-SHOW REVERTED notification for PNR: ${pnr}`);

        // Send Email
        if (passenger.email && process.env.EMAIL_USER) {
            try {
                const mailOptions = {
                    from: `"Indian Railways" <${process.env.EMAIL_USER}>`,
                    to: passenger.email,
                    subject: '✅ NO-SHOW Status Cleared - Welcome Back!',
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                                .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; }
                                .header { background: #27ae60; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                                .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; color: #155724; }
                                .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                                .info-table td { padding: 12px; border-bottom: 1px solid #ddd; }
                                .info-table td:first-child { font-weight: bold; width: 40%; }
                                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1 style="margin: 0;">✅ Status Cleared!</h1>
                                    <p style="margin: 10px 0 0 0; font-size: 18px;">You're Back on Board</p>
                                </div>
                                <div class="content">
                                    <p>Dear <strong>${passenger.name}</strong>,</p>
                                    <p>Good news! Your NO-SHOW status has been successfully cleared.</p>
                                    
                                    <div class="success-box">
                                        <strong>✅ All Clear:</strong> You are confirmed as present on the train. Your berth is secure.
                                    </div>
                                    
                                    <table class="info-table">
                                        <tr>
                                            <td>PNR Number:</td>
                                            <td><strong>${pnr}</strong></td>
                                        </tr>
                                        <tr>
                                            <td>Berth:</td>
                                            <td>${passenger.coach}-${passenger.berth}</td>
                                        </tr>
                                        <tr>
                                            <td>Status:</td>
                                            <td><strong style="color: #27ae60;">BOARDED</strong></td>
                                        </tr>
                                    </table>
                                    
                                    <p><strong>Happy Journey!</strong></p>
                                    <p>Thank you for clarifying your presence on the train.</p>
                                </div>
                                <div class="footer">
                                    <p>This is an automated notification from Indian Railways</p>
                                    <p>Please do not reply to this email</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                };

                await this.emailTransporter.sendMail(mailOptions);
                results.email.sent = true;
                console.log(`📧 NO-SHOW revert email sent to ${passenger.email}`);
            } catch (error) {
                results.email.error = error.message;
                console.error('❌ Revert email failed:', error.message);
            }
        }



        return results;
    }

    /**
     * Test email configuration
     */
    async testEmail(recipientEmail) {
        try {
            const info = await this.emailTransporter.sendMail({
                from: process.env.EMAIL_USER,
                to: recipientEmail,
                subject: 'Test Email - RAC System',
                text: 'This is a test email from the RAC Reallocation System. If you receive this, your email configuration is working correctly!'
            });
            return { success: true, messageId: info.messageId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * ✅ TASK 2: Send approval request notification to Online passenger
     * Called when Admin sends upgrade for approval and passenger is Online
     */
    async sendApprovalRequestNotification(passenger, upgradeDetails) {
        if (!passenger.email || !process.env.EMAIL_USER) {
            console.log(`⚠️ Cannot send approval request email - no email configured`);
            return { sent: false, error: 'No email configured' };
        }

        try {
            const mailOptions = {
                from: `"Indian Railways RAC System" <${process.env.EMAIL_USER}>`,
                to: passenger.email,
                subject: '🎫 Upgrade Available! Action Required - Indian Railways',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .upgrade-box { background: #fff; border: 2px solid #27ae60; border-radius: 8px; padding: 20px; margin: 20px 0; }
                            .btn { display: inline-block; background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 5px; }
                            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1 style="margin: 0;">🎫 Upgrade Available!</h1>
                                <p style="margin: 10px 0 0 0; font-size: 18px;">Action Required</p>
                            </div>
                            <div class="content">
                                <p>Dear <strong>${passenger.name}</strong>,</p>
                                <p>Great news! A berth upgrade is available for your RAC ticket. You can approve this upgrade directly from your passenger portal.</p>
                                
                                <div class="upgrade-box">
                                    <h3 style="margin-top: 0; color: #27ae60;">Upgrade Details</h3>
                                    <p><strong>PNR:</strong> ${passenger.pnr}</p>
                                    <p><strong>Current Status:</strong> RAC - ${upgradeDetails.currentRAC}</p>
                                    <p><strong>Offered Berth:</strong> ${upgradeDetails.proposedBerthFull}</p>
                                    <p><strong>Berth Type:</strong> ${upgradeDetails.proposedBerthType}</p>
                                    <p><strong>Station:</strong> ${upgradeDetails.stationName}</p>
                                </div>
                                
                                <p style="text-align: center;">
                                    <a href="${this.frontendUrl}" class="btn">✓ View & Approve Upgrade</a>
                                </p>
                                
                                <p style="color: #e74c3c; font-weight: bold;">
                                    ⚠️ Please approve quickly! The TTE can also approve this upgrade, and the first approval wins.
                                </p>
                                
                                <div class="footer">
                                    <p>Indian Railways - RAC Reallocation System</p>
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await this.emailTransporter.sendMail(mailOptions);
            console.log(`📧 Approval request email sent to ${passenger.email}`);
            return { sent: true };
        } catch (error) {
            console.error(`❌ Approval request email failed:`, error.message);
            return { sent: false, error: error.message };
        }
    }
}

module.exports = new NotificationService();
