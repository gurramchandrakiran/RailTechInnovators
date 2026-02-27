// backend/utils/envValidator.js
// Environment variable validation on startup

const requiredEnvVars = [
    // MongoDB
    { name: 'MONGO_URI', default: 'mongodb://localhost:27017', required: false },

    // JWT
    { name: 'JWT_SECRET', default: null, required: true, sensitive: true },

    // Server
    { name: 'PORT', default: '5000', required: false },
    { name: 'NODE_ENV', default: 'development', required: false },

    // CORS
    { name: 'CORS_ORIGIN', default: 'http://localhost:5173,http://localhost:5174,http://localhost:5175', required: false }
];

const optionalEnvVars = [
    // Web Push (VAPID)
    { name: 'VAPID_PUBLIC_KEY', default: null },
    { name: 'VAPID_PRIVATE_KEY', default: null },
    { name: 'VAPID_SUBJECT', default: null },

    // Email
    { name: 'EMAIL_HOST', default: null },
    { name: 'EMAIL_PORT', default: null },
    { name: 'EMAIL_USER', default: null },
    { name: 'EMAIL_PASS', default: null },

    // Logging
    { name: 'LOG_LEVEL', default: 'info' }
];

/**
 * Validate environment variables on startup
 * @returns {Object} validation result
 */
function validateEnv() {
    console.log('\n🔍 Validating environment variables...\n');

    const errors = [];
    const warnings = [];
    const loaded = [];

    // Check required variables
    for (const envVar of requiredEnvVars) {
        const value = process.env[envVar.name];

        if (!value && envVar.required && !envVar.default) {
            errors.push(`❌ Missing required: ${envVar.name}`);
        } else if (!value && envVar.default) {
            process.env[envVar.name] = envVar.default;
            loaded.push(`   ✓ ${envVar.name} (default: ${envVar.sensitive ? '***' : envVar.default})`);
        } else if (value) {
            // Security warning for default JWT_SECRET
            if (envVar.name === 'JWT_SECRET' && value === 'your-secret-key-change-in-production') {
                warnings.push(`⚠️  ${envVar.name} is using default value - CHANGE IN PRODUCTION!`);
            }
            loaded.push(`   ✓ ${envVar.name} ${envVar.sensitive ? '(set)' : `= ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`}`);
        }
    }

    // Check optional variables
    for (const envVar of optionalEnvVars) {
        const value = process.env[envVar.name];

        if (!value && envVar.default) {
            process.env[envVar.name] = envVar.default;
        }

        if (value) {
            loaded.push(`   ✓ ${envVar.name} (optional)`);
        }
    }

    // Check VAPID keys completeness
    const vapidKeys = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
    const vapidSet = vapidKeys.filter(k => process.env[k]);
    if (vapidSet.length > 0 && vapidSet.length < 3) {
        warnings.push(`⚠️  Incomplete VAPID configuration - need all 3 keys for push notifications`);
    }

    // Print results
    if (loaded.length > 0) {
        console.log('📋 Environment variables loaded:');
        loaded.forEach(l => console.log(l));
    }

    if (warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        warnings.forEach(w => console.log(`   ${w}`));
    }

    if (errors.length > 0) {
        console.log('\n❌ Errors:');
        errors.forEach(e => console.log(`   ${e}`));
        console.log('\n');

        return {
            valid: false,
            errors,
            warnings
        };
    }

    console.log('\n✅ Environment validation passed!\n');

    return {
        valid: true,
        errors: [],
        warnings
    };
}

/**
 * Validate and exit if invalid (use at startup)
 */
function validateEnvOrExit() {
    const result = validateEnv();

    if (!result.valid) {
        console.error('❌ Environment validation failed! Please set required environment variables.');
        console.error('   See .env.example for required variables.\n');
        process.exit(1);
    }

    return result;
}

/**
 * Get environment info for debugging
 */
function getEnvInfo() {
    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 5000,
        mongoUri: process.env.MONGO_URI ? '(set)' : '(default)',
        jwtConfigured: !!process.env.JWT_SECRET,
        vapidConfigured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        emailConfigured: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER)
    };
}

module.exports = {
    validateEnv,
    validateEnvOrExit,
    getEnvInfo
};
