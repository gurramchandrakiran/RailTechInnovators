// backend/middleware/auth.js

const jwt = require("jsonwebtoken");

// JWT Secret (must match authController)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request
 *
 * Priority order:
 *  1. Authorization header (Bearer token from localStorage — portal-specific, no cross-portal leakage)
 *  2. httpOnly accessToken cookie (fallback for browser-only flows)
 *
 * Why header-first?
 *  Cookies are scoped to the *domain* (localhost), NOT the port. When the admin portal
 *  (localhost:3000) and TTE portal (localhost:3001) both call the same backend
 *  (localhost:5000), they share the same cookie jar. A TTE login therefore overwrites
 *  the admin's accessToken cookie, causing a 403 on admin-only routes.
 *  localStorage IS port-scoped, so the Authorization header carries the correct,
 *  portal-specific token and must be checked first.
 */
const authMiddleware = (req, res, next) => {
  try {
    // 1. Prefer Authorization header (portal-specific, no cross-portal collision)
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      token = authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : authHeader;
    }

    // 2. Fall back to httpOnly cookie (e.g. direct browser fetch without header)
    if (!token) {
      token = req.cookies?.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No authorization token provided",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = decoded;

    // Continue to next middleware/route handler
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/**
 * Role-based Access Control Middleware
 * Checks if user has required role
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Support both requireRole(['TTE', 'ADMIN']) and requireRole('TTE', 'ADMIN')
    const roles = Array.isArray(allowedRoles[0])
      ? allowedRoles[0]
      : allowedRoles;

    if (!roles.includes(req.user.role)) {
      console.log(
        `[AUTH] Role check failed: "${req.user.role}" not in [${roles.join(", ")}] for ${req.method} ${req.path}`,
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

/**
 * Permission-based Access Control
 * Checks if user has specific permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userPermissions = req.user.permissions || [];

    if (
      !userPermissions.includes(permission) &&
      !userPermissions.includes("ALL")
    ) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Requires: ${permission}`,
      });
    }

    next();
  };
};

/**
 * Train-Scoped Access Control Middleware
 * Ensures TTE can only operate on their assigned train's data.
 * ADMINs bypass this check.
 */
const requireTrainMatch = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // ADMINs can access any train
  if (req.user.role === "ADMIN") {
    return next();
  }

  // For TTE: check trainAssigned exists in JWT
  const tteTrainAssigned = req.user.trainAssigned;
  if (!tteTrainAssigned) {
    return res.status(403).json({
      success: false,
      message: "No train assigned to your account. Contact admin.",
    });
  }

  // Get trainNo from the request (auto-injected by TTE portal's request interceptor)
  const requestTrainNo =
    req.body?.trainNo || req.query?.trainNo || req.params?.trainNo;

  // If the request includes a trainNo, ensure it matches the TTE's assigned train
  // This prevents a TTE from accessing another train's data
  if (requestTrainNo && String(requestTrainNo) !== String(tteTrainAssigned)) {
    console.log(
      `[AUTH] Train mismatch: TTE assigned to ${tteTrainAssigned}, request for ${requestTrainNo}`,
    );
    return res.status(403).json({
      success: false,
      message: `Access denied. You are assigned to train ${tteTrainAssigned}, not ${requestTrainNo}.`,
    });
  }

  // If no trainNo in request, auto-inject it from the JWT so route handlers can use it
  if (!req.body?.trainNo && req.body) {
    req.body.trainNo = String(tteTrainAssigned);
  }
  if (!req.query?.trainNo) {
    req.query = req.query || {};
    req.query.trainNo = String(tteTrainAssigned);
  }

  next();
};

module.exports = {
  authMiddleware,
  requireRole,
  requirePermission,
  requireTrainMatch,
};
