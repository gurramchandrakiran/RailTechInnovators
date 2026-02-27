// backend/controllers/authController.js

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { COLLECTIONS, DEFAULTS } = require("../config/collections");
const RefreshTokenService = require("../services/RefreshTokenService");
const NotificationService = require("../services/NotificationService");

// JWT Secret (in production, use environment variable)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h"; // Access token expiry (1 hour for dev, configure shorter in production)

/**
 * Authentication Controller
 * Handles login for Admin, TTE, and Passenger users
 */
class AuthController {
  /**
   * Admin/TTE Login
   * POST /api/auth/staff/login
   * Body: { employeeId, password }
   */
  async staffLogin(req, res) {
    try {
      const { employeeId, password } = req.body;

      // Validate input
      if (!employeeId || !password) {
        return res.status(400).json({
          success: false,
          message: "Employee ID and password are required",
        });
      }

      // Find user in tte_users collection
      const racDb = await db.getDb();
      const tteUsersCollection = racDb.collection(COLLECTIONS.TTE_USERS);
      const user = await tteUsersCollection.findOne({ employeeId });

      console.log(
        `[LOGIN DEBUG] employeeId: ${employeeId}, user found: ${!!user}, role: ${user?.role}`,
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Check if account is active
      if (!user.active) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated. Please contact administrator.",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      console.log(
        `[LOGIN DEBUG] password valid: ${isPasswordValid}, hash exists: ${!!user.passwordHash}`,
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // For TTE role: ensure they have a train assigned (set by admin during registration)
      // No form input needed — trainAssigned is already in the DB
      if (user.role === "TTE") {
        if (!user.trainAssigned) {
          return res.status(403).json({
            success: false,
            message: "No train assigned to your account. Contact admin.",
          });
        }
      }

      // Update last login
      await tteUsersCollection.updateOne(
        { employeeId },
        { $set: { lastLogin: new Date() } },
      );

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.employeeId,
          role: user.role,
          trainAssigned: user.trainAssigned,
          permissions: user.permissions,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );

      // Generate refresh token
      const refreshToken = await RefreshTokenService.createRefreshToken(
        user.employeeId,
        user.role,
        { trainAssigned: user.trainAssigned },
      );

      // Set tokens as httpOnly cookies (secure in production)
      const isProduction = process.env.NODE_ENV === "production";

      res.cookie("accessToken", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Return success with tokens and user info
      // Also return tokens in body for backward compatibility
      res.json({
        success: true,
        message: "Login successful",
        token,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
        user: {
          employeeId: user.employeeId,
          name: user.name,
          email: user.email,
          role: user.role,
          trainAssigned: user.trainAssigned,
          permissions: user.permissions,
        },
      });
    } catch (error) {
      console.error("Staff login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during login",
      });
    }
  }

  /**
   * Admin/TTE Registration
   * POST /api/auth/staff/register
   * Body: { employeeId, password, confirmPassword, role, name }
   */
  async staffRegister(req, res) {
    try {
      const { employeeId, password, confirmPassword, role, name, email } = req.body;

      // Validate required fields
      if (!employeeId || !password || !confirmPassword || !role) {
        return res.status(400).json({
          success: false,
          message:
            "Employee ID, password, confirm password, and role are required",
        });
      }

      // Validate role
      const validRoles = ["ADMIN", "TTE"];
      if (!validRoles.includes(role.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "Role must be either ADMIN or TTE",
        });
      }

      const normalizedRole = role.toUpperCase();

      // Validate Employee ID prefix matches role
      // Admin IDs must start with ADMIN_, TTE IDs must start with TTE_
      if (
        normalizedRole === "ADMIN" &&
        !employeeId.toUpperCase().startsWith("ADMIN_")
      ) {
        return res.status(400).json({
          success: false,
          message: "Admin Employee ID must start with ADMIN_ (e.g., ADMIN_02)",
        });
      }
      if (
        normalizedRole === "TTE" &&
        !employeeId.toUpperCase().startsWith("TTE_")
      ) {
        return res.status(400).json({
          success: false,
          message: "TTE Employee ID must start with TTE_ (e.g., TTE_02)",
        });
      }

      // Validate passwords match
      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Passwords do not match",
        });
      }

      // Validate password strength (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number",
        });
      }

      // Check if employee ID already exists
      const racDb = await db.getDb();
      const tteUsersCollection = racDb.collection(COLLECTIONS.TTE_USERS);
      const existingUser = await tteUsersCollection.findOne({
        employeeId: { $regex: new RegExp(`^${employeeId}$`, "i") },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Employee ID already exists. Please choose a different ID.",
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Set permissions based on role
      const permissions =
        normalizedRole === "ADMIN"
          ? ["ALL"]
          : ["MARK_BOARDING", "MARK_NO_SHOW", "VIEW_PASSENGERS", "OFFLINE_UPGRADE"];

      // Create user document
      const newUser = {
        employeeId: employeeId.toUpperCase(),
        passwordHash,
        email: email?.trim()?.toLowerCase() || null,
        name: name || employeeId.toUpperCase(),
        role: normalizedRole,
        active: true,
        trainAssigned: normalizedRole === "TTE" ? null : null,
        phone: null,
        permissions,
        createdAt: new Date(),
        lastLogin: null,
      };

      // Insert into database
      await tteUsersCollection.insertOne(newUser);

      console.log(
        `✅ New ${normalizedRole} registered: ${employeeId.toUpperCase()}`,
      );

      // ✅ Send welcome email if email was provided (non-blocking)
      if (newUser.email) {
        this._sendWelcomeEmail(newUser.email, newUser.name, normalizedRole, newUser.employeeId);
      }

      res.status(201).json({
        success: true,
        message: `${normalizedRole} account created successfully! You can now login.`,
        user: {
          employeeId: newUser.employeeId,
          name: newUser.name,
          role: newUser.role,
        },
      });
    } catch (error) {
      console.error("Staff registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during registration",
      });
    }
  }

  /**
   * Register TTE for a specific train (Admin Landing Page)
   * POST /api/auth/tte/register
   * Body: { trainNo, name, employeeId, password, phone?, email? }
   * Admin enters the employee ID manually.
   */
  async registerTTE(req, res) {
    try {
      const { trainNo, name, password, employeeId, phone, email } = req.body;

      // Validate required fields
      if (!trainNo || !name || !employeeId) {
        return res.status(400).json({
          success: false,
          message: "Train number, TTE name, and Employee ID are required",
        });
      }

      const racDb = await db.getDb();

      // Verify train exists in Trains_Details
      // Try both field names: 'trainNo' (string) and 'Train_No' (number) for compatibility
      const trainsCollection = racDb.collection(COLLECTIONS.TRAINS_DETAILS);
      let trainExists = await trainsCollection.findOne({ trainNo });
      if (!trainExists) {
        trainExists = await trainsCollection.findOne({
          Train_No: Number(trainNo),
        });
      }

      if (!trainExists) {
        return res.status(404).json({
          success: false,
          message: `Train ${trainNo} not found. Please register the train first.`,
        });
      }

      // Check if this employee ID already exists
      const tteUsersCollection = racDb.collection(COLLECTIONS.TTE_USERS);
      const duplicate = await tteUsersCollection.findOne({ employeeId: employeeId.trim() });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Employee ID "${employeeId}" already exists. Please use a different ID.`,
        });
      }

      // Use provided password or fall back to default
      const ttePassword = password || "Prasanth@123";
      const passwordHash = await bcrypt.hash(ttePassword, 12);

      // Create TTE user document
      const newTTE = {
        employeeId: employeeId.trim(),
        passwordHash,
        email: email?.trim() || null,
        name,
        role: "TTE",
        active: true,
        trainAssigned: trainNo,
        phone: phone?.trim() || null,
        permissions: ["MARK_BOARDING", "MARK_NO_SHOW", "VIEW_PASSENGERS", "OFFLINE_UPGRADE"],
        createdAt: new Date(),
        lastLogin: null,
      };

      // Insert into database
      await tteUsersCollection.insertOne(newTTE);

      console.log(`✅ New TTE registered: ${employeeId} for train ${trainNo}`);

      // ✅ Send welcome email if email was provided (non-blocking)
      if (newTTE.email) {
        this._sendWelcomeEmail(newTTE.email, newTTE.name, 'TTE', newTTE.employeeId, trainNo);
      }

      res.status(201).json({
        success: true,
        message: `TTE account created successfully!`,
        user: {
          employeeId: newTTE.employeeId,
          name: newTTE.name,
          role: newTTE.role,
          trainAssigned: newTTE.trainAssigned,
          defaultPassword: ttePassword, // Return it so admin can inform the TTE
        },
      });
    } catch (error) {
      console.error("TTE registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during TTE registration",
      });
    }
  }

  /**
   * Passenger Login
   * POST /api/auth/passenger/login
   * Body: { irctcId, password } OR { email, password }
   */
  async passengerLogin(req, res) {
    try {
      const { irctcId, email, password } = req.body;

      // Validate input
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required",
        });
      }

      if (!irctcId && !email) {
        return res.status(400).json({
          success: false,
          message: "IRCTC ID or email is required",
        });
      }

      // Find user in passenger_accounts collection
      const racDb = await db.getDb();
      const passengerAccountsCollection = racDb.collection(
        COLLECTIONS.PASSENGER_ACCOUNTS,
      );
      const query = irctcId ? { IRCTC_ID: irctcId } : { email };
      const user = await passengerAccountsCollection.findOne(query);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Check if account is active
      if (!user.active) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated. Please contact support.",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Fetch all tickets for this IRCTC ID dynamically across ALL registered trains.
      // We query Trains_Details to discover every passenger collection, then search
      // each one.  This works in bootstrap mode (no active train) AND when multiple
      // trains are registered.
      let tickets = [];
      try {
        const trainsCollection = racDb.collection(COLLECTIONS.TRAINS_DETAILS);
        const allTrains = await trainsCollection.find({}).toArray();

        const passengersDbName = process.env.PASSENGERS_DB || "PassengersDB";
        const passDb = await db.getDbByName(passengersDbName);

        for (const train of allTrains) {
          // Normalise collection name from either schema version
          const collName =
            train.passengersCollection ||
            train.Passengers_Collection_Name ||
            `${train.trainNo || train.Train_No}_passengers`;
          if (!collName) continue;
          try {
            const coll = passDb.collection(collName);
            const trainTickets = await coll
              .find({ IRCTC_ID: user.IRCTC_ID })
              .toArray();
            tickets.push(...trainTickets);
          } catch (collErr) {
            // Skip unreachable / non-existent collections silently
            console.warn(
              `[AUTH] Skipping collection "${collName}": ${collErr.message}`,
            );
          }
        }

        console.log(
          `[AUTH] Found ${tickets.length} ticket(s) for ${user.IRCTC_ID} across ${allTrains.length} train(s)`,
        );
      } catch (ticketErr) {
        // Non-fatal: login still succeeds, portal shows empty ticket list
        console.warn(
          "[AUTH] Could not fetch passenger tickets:",
          ticketErr.message,
        );
      }

      // Update last login
      await passengerAccountsCollection.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } },
      );

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.IRCTC_ID, // ✅ FIXED: Use uppercase field
          email: user.email,
          role: "PASSENGER",
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );

      // Generate refresh token
      const refreshToken = await RefreshTokenService.createRefreshToken(
        user.IRCTC_ID,
        "PASSENGER",
        { email: user.email },
      );

      // Set tokens as httpOnly cookies (secure in production)
      const isProduction = process.env.NODE_ENV === "production";

      res.cookie("accessToken", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Return success with tokens, user info, and tickets
      // Also return tokens in body for backward compatibility
      res.json({
        success: true,
        message: "Login successful",
        token,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
        user: {
          irctcId: user.IRCTC_ID, // ✅ FIXED: Read from uppercase field
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "PASSENGER",
        },
        tickets: tickets.map((t) => ({
          pnr: t.PNR_Number,
          trainNumber: t.Train_Number,
          trainName: t.Train_Name,
          from: t.Boarding_Station,
          to: t.Deboarding_Station,
          journeyDate: t.Journey_Date,
          status: t.PNR_Status,
          racStatus: t.Rac_status,
          coach: t.Assigned_Coach,
          berth: t.Assigned_Berth,
          class: t.Class,
        })),
      });

      // Sync online status for all matching PNRs (non-fatal)
      try {
        const trainController = require("./trainController");
        const PassengerService = require("../services/PassengerService");

        if (tickets.length > 0) {
          console.log(
            `\n🔑 User ${user.IRCTC_ID || user.email} logged in. Syncing status for ${tickets.length} PNR(s)...`,
          );
          for (const ticket of tickets) {
            // Get the correct train state for this ticket's train
            const ticketTrainNo = String(ticket.Train_Number || "");
            const trainState = trainController.getGlobalTrainState(ticketTrainNo);
            if (trainState) {
              await PassengerService.updateGroupStatus(
                ticket.PNR_Number,
                "Online",
                trainState,
              );
            }
          }
        }
      } catch (syncError) {
        console.warn(
          "⚠️ Failed to sync group status on login:",
          syncError.message,
        );
        // Non-fatal — do not block login response
      }
    } catch (error) {
      console.error("Passenger login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during login",
      });
    }
  }

  /**
     * Passenger Registration
     * POST /api/auth/passenger/register
     * Body: { email, password, confirmPassword, name, phone, irctcId }
     */
  async passengerRegister(req, res) {
    try {
      const { email, password, confirmPassword, name, phone, irctcId } = req.body;

      // Validate required fields
      if (!email || !password || !confirmPassword || !name || !irctcId) {
        return res.status(400).json({
          success: false,
          message: 'Email, IRCTC ID, name, password, and confirm password are required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate IRCTC ID format (IR_XXXX)
      if (!irctcId.toUpperCase().startsWith('IR_')) {
        return res.status(400).json({
          success: false,
          message: 'IRCTC ID must start with IR_ (e.g., IR_0001)'
        });
      }

      // Validate passwords match
      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      // Validate password strength (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'
        });
      }

      // Check for existing account
      const racDb = await db.getDb();
      const passengerAccountsCollection = racDb.collection(COLLECTIONS.PASSENGER_ACCOUNTS);

      const existingEmail = await passengerAccountsCollection.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists'
        });
      }

      const existingIrctc = await passengerAccountsCollection.findOne({
        IRCTC_ID: irctcId.toUpperCase()
      });
      if (existingIrctc) {
        return res.status(409).json({
          success: false,
          message: 'An account with this IRCTC ID already exists'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create passenger account document
      const newPassenger = {
        email: email.toLowerCase(),
        IRCTC_ID: irctcId.toUpperCase(),
        passwordHash,
        name: name.trim(),
        role: 'PASSENGER',
        phone: phone || null,
        active: true,
        createdAt: new Date(),
        lastLogin: null,
        emailVerified: false,
        phoneVerified: false
      };

      await passengerAccountsCollection.insertOne(newPassenger);

      console.log(`✅ New passenger registered: ${irctcId.toUpperCase()} (${email})`);

      // ✅ Send welcome email (non-blocking) — email is required for passengers
      this._sendWelcomeEmail(newPassenger.email, newPassenger.name, 'PASSENGER', newPassenger.IRCTC_ID);

      res.status(201).json({
        success: true,
        message: 'Account created successfully! You can now login.',
        user: {
          email: newPassenger.email,
          IRCTC_ID: newPassenger.IRCTC_ID,
          name: newPassenger.name,
          role: 'PASSENGER'
        }
      });
    } catch (error) {
      console.error('Passenger registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }

  /**
   * Verify Token (for protected routes)
   * GET /api/auth/verify
   * Headers: Authorization: Bearer <token>
   */
  async verifyToken(req, res) {
    try {
      // Token is already verified by auth middleware
      // If we reach here, token is valid
      res.json({
        success: true,
        user: req.user, // Populated by auth middleware
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Token verification failed",
      });
    }
  }

  /**
   * Logout (revoke refresh token)
   * POST /api/auth/logout
   * Body: { refreshToken }
   */
  async logout(req, res) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        // ✅ NEW: Sync Group Status to OFFLINE on Logout
        try {
          const tokenData =
            await RefreshTokenService.validateRefreshToken(refreshToken);

          if (tokenData && tokenData.role === "PASSENGER") {
            const trainController = require("./trainController");
            const PassengerService = require("../services/PassengerService");
            const trainState = trainController.getGlobalTrainState();

            // Find user's PNRs
            const passengersCollection = db.getPassengersCollection();
            const tickets = await passengersCollection
              .find({
                IRCTC_ID: tokenData.userId,
              })
              .toArray();

            if (trainState && tickets && tickets.length > 0) {
              console.log(
                `\n🚪 User ${tokenData.userId} logging out. Marking ${tickets.length} PNRs as OFFLINE...`,
              );

              for (const ticket of tickets) {
                await PassengerService.updateGroupStatus(
                  ticket.PNR_Number,
                  "Offline",
                  trainState,
                );
              }
            }
          }
        } catch (logoutSyncError) {
          console.error(
            "⚠️ Error syncing offline status on logout:",
            logoutSyncError,
          );
          // Continue with revocation
        }

        // Revoke the refresh token
        await RefreshTokenService.revokeRefreshToken(refreshToken);
      }

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  }

  /**
   * Refresh Access Token
   * POST /api/auth/refresh
   * Body: { refreshToken }
   */
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      // Validate the refresh token
      const storedToken =
        await RefreshTokenService.validateRefreshToken(refreshToken);

      if (!storedToken) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token. Please login again.",
        });
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          userId: storedToken.userId,
          role: storedToken.role,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );

      res.json({
        success: true,
        token: newAccessToken,
        expiresIn: 900, // 15 minutes in seconds
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to refresh token",
      });
    }
  }

  /**
   * Send welcome email after successful registration (non-blocking).
   * @param {string} email - Recipient email
   * @param {string} name - User display name
   * @param {string} role - ADMIN / TTE / PASSENGER
   * @param {string} userId - Employee ID or IRCTC ID
   * @param {string} [trainNo] - Train number (TTE only)
   */
  async _sendWelcomeEmail(email, name, role, userId, trainNo = null) {
    try {
      const roleLabel = role === 'PASSENGER' ? 'Passenger'
        : role === 'TTE' ? 'Train Ticket Examiner (TTE)'
          : 'Administrator';

      const roleColor = role === 'PASSENGER' ? '#0ea5e9'
        : role === 'TTE' ? '#8b5cf6'
          : '#f59e0b';

      const roleIcon = role === 'PASSENGER' ? '🎫'
        : role === 'TTE' ? '🚂'
          : '🛡️';

      const extraInfo = trainNo
        ? `<p style="margin: 4px 0;"><strong>Train Assigned:</strong> ${trainNo}</p>`
        : '';

      const idLabel = role === 'PASSENGER' ? 'IRCTC ID' : 'Employee ID';

      await NotificationService.emailTransporter.sendMail({
        from: `"Indian Railways RAC System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `${roleIcon} Welcome to Indian Railways — Registration Successful!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
              .header { background: linear-gradient(135deg, #1e3a5f, #2d5a87); color: white; padding: 35px 30px; text-align: center; }
              .header h1 { margin: 0 0 8px; font-size: 24px; }
              .header p { margin: 0; opacity: 0.85; font-size: 14px; }
              .body-content { padding: 30px; }
              .welcome-box { background: linear-gradient(135deg, ${roleColor}15, ${roleColor}08); border: 2px solid ${roleColor}30; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center; }
              .welcome-box .icon { font-size: 48px; margin-bottom: 12px; }
              .welcome-box h2 { color: ${roleColor}; margin: 0 0 8px; font-size: 22px; }
              .welcome-box p { color: #64748b; margin: 0; font-size: 14px; }
              .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 24px; }
              .details-card h3 { margin: 0 0 12px; font-size: 16px; color: #1e293b; }
              .details-card p { margin: 4px 0; font-size: 14px; color: #475569; }
              .details-card strong { color: #1e293b; }
              .role-badge { display: inline-block; background: ${roleColor}; color: white; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; margin-top: 8px; }
              .cta-section { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0; }
              .cta-section p { margin: 4px 0; font-size: 14px; color: #15803d; }
              .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0; font-size: 13px; color: #92400e; }
              .footer { background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
              .footer p { margin: 4px 0; font-size: 12px; color: #94a3b8; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚆 Indian Railways</h1>
                <p>RAC Reallocation & Management System</p>
              </div>
              <div class="body-content">
                <div class="welcome-box">
                  <div class="icon">${roleIcon}</div>
                  <h2>Welcome, ${name}!</h2>
                  <p>Your account has been created successfully</p>
                  <div class="role-badge">${roleLabel}</div>
                </div>

                <div class="details-card">
                  <h3>📋 Account Details</h3>
                  <p><strong>Name:</strong> ${name}</p>
                  <p><strong>${idLabel}:</strong> ${userId}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Role:</strong> ${roleLabel}</p>
                  ${extraInfo}
                  <p><strong>Registered:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                </div>

                <div class="cta-section">
                  <p><strong>✅ What's Next?</strong></p>
                  <p>You can now log in to the ${roleLabel} Portal using your ${idLabel} and password.</p>
                </div>

                <div class="warning">
                  <strong>⚠️ Security Reminder:</strong> Never share your password or login credentials with anyone. Indian Railways staff will never ask for your password.
                </div>
              </div>
              <div class="footer">
                <p>This is an automated email from Indian Railways RAC System</p>
                <p>Please do not reply to this email</p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      console.log(`📧 Welcome email sent to ${email} (${role}: ${userId})`);
    } catch (error) {
      // Non-fatal: don't fail registration if email fails
      console.warn(`⚠️ Failed to send welcome email to ${email}: ${error.message}`);
    }
  }
}

module.exports = new AuthController();
