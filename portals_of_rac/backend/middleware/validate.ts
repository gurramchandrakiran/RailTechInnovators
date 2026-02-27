// backend/middleware/validate.ts
// Express middleware for Zod request validation

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Creates an Express middleware that validates request body against a Zod schema
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export const validateBody = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errorMessages = error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message
                }));

                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errorMessages
                });
            }
            next(error);
        }
    };
};

/**
 * Creates an Express middleware that validates request params against a Zod schema
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export const validateParams = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.params);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errorMessages = error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message
                }));

                return res.status(400).json({
                    success: false,
                    message: 'Invalid parameters',
                    errors: errorMessages
                });
            }
            next(error);
        }
    };
};

/**
 * Creates an Express middleware that validates request query against a Zod schema
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export const validateQuery = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.query);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errorMessages = error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message
                }));

                return res.status(400).json({
                    success: false,
                    message: 'Invalid query parameters',
                    errors: errorMessages
                });
            }
            next(error);
        }
    };
};
