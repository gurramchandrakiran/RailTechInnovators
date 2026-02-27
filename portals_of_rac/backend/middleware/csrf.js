/**
 * CSRF Protection Middleware
 * Uses double-submit cookie pattern for stateless CSRF protection
 */
const crypto = require('crypto');

// Generate a secure random CSRF token
const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// CSRF middleware
const csrfProtection = (req, res, next) => {
    // Skip CSRF for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Skip CSRF for specific public endpoints (login, OTP, push notifications)
    const publicPaths = [
        '/api/auth/staff/login',
        '/api/auth/passenger/login',
        '/api/auth/passenger/register',
        '/api/auth/refresh',
        '/api/otp/send',
        '/api/otp/verify',
        '/api/config/setup',
        '/api/train/initialize',
        '/api/train/start-journey',
        '/api/train/next-station',
        '/api/train/reset',
        '/api/admin/push-subscribe',
        '/api/tte/push-subscribe',
        '/api/passenger/push-subscribe',
        '/api/test-email',
        '/api/push/test',
        '/api/passenger/revert-no-show',  // Allow passengers to revert no-show
        '/api/push-subscribe'
    ];

    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // If request has a Bearer JWT token, skip CSRF check.
    // JWT tokens are manually attached (not auto-sent like cookies),
    // so they inherently protect against CSRF attacks.
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return next();
    }

    // Get token from header
    const headerToken = req.headers['x-csrf-token'];
    const cookieToken = req.cookies?.csrfToken;

    if (!headerToken || !cookieToken) {
        return res.status(403).json({
            success: false,
            message: 'CSRF token missing',
            error: 'FORBIDDEN'
        });
    }

    if (headerToken !== cookieToken) {
        return res.status(403).json({
            success: false,
            message: 'CSRF token mismatch',
            error: 'FORBIDDEN'
        });
    }

    next();
};

// Endpoint to get CSRF token - sets cookie and returns token
const getCsrfToken = (req, res) => {
    const token = generateToken();

    // For cross-origin deployments (e.g., Vercel frontend + Render backend),
    // sameSite must be 'none' with secure: true
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('csrfToken', token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-origin
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
        success: true,
        csrfToken: token
    });
};

module.exports = {
    csrfProtection,
    getCsrfToken,
    generateToken
};
