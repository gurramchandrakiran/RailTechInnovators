/**
 * validate-request.js
 * Middleware to validate requests against Joi schemas
 * Usage: router.post('/path', validateRequest('schemaName'), handler)
 */

const schemas = require('./validation-schemas');

/**
 * Validation middleware factory
 * @param {string} schemaName - Name of the schema to use from validation-schemas.js
 * @returns {Function} Express middleware function
 */
const validateRequest = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      console.error(`⚠️ Validation schema not found: ${schemaName}`);
      return res.status(500).json({
        success: false,
        message: 'Server validation configuration error'
      });
    }

    // Validate based on request method
    let data = req.body;
    let source = 'body';

    if (req.method === 'GET') {
      data = req.query;
      source = 'query';
    } else if (req.method === 'DELETE' && Object.keys(req.body).length === 0) {
      data = req.params;
      source = 'params';
    }

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      console.warn(`❌ Validation error in ${source} for ${schemaName}:`, details);

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: details
      });
    }

    // Attach validated data to request
    if (req.method === 'GET') {
      req.query = value;
    } else {
      req.body = value;
    }

    console.log(`✅ Validation passed for ${schemaName}`);
    next();
  };
};

/**
 * Middleware to validate request params
 */
const validateParams = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      console.error(`⚠️ Validation schema not found: ${schemaName}`);
      return res.status(500).json({
        success: false,
        message: 'Server validation configuration error'
      });
    }

    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: details
      });
    }

    req.params = value;
    next();
  };
};

module.exports = {
  validateRequest,
  validateParams,
  schemas
};
