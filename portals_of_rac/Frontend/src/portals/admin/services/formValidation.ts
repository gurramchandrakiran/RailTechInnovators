// admin-portal/src/services/formValidation.ts
// Form validation utilities using Joi schemas from backend

interface ValidationRule {
    pattern?: RegExp;
    message?: string;
    maxLength?: number;
    minLength?: number;
    validateDate?: boolean;
    uppercase?: boolean;
    enum?: string[];
}

interface ValidationResult {
    isValid: boolean;
    error: string | null;
}

interface ValidationResults {
    isValid: boolean;
    errors: Record<string, string>;
}

export const validationRules: Record<string, ValidationRule> = {
    trainNo: {
        pattern: /^\d{1,5}$/,
        message: 'Train number must be 1-5 digits',
        maxLength: 5
    },

    journeyDate: {
        pattern: /^\d{4}-\d{2}-\d{2}$/,
        message: 'Date must be in YYYY-MM-DD format',
        validateDate: true
    },

    trainName: {
        minLength: 2,
        maxLength: 100,
        message: 'Train name must be 2-100 characters'
    },

    pnr: {
        pattern: /^[A-Z0-9]{6}$/,
        message: 'PNR must be exactly 6 alphanumeric characters',
        maxLength: 6,
        minLength: 6,
        uppercase: true
    },

    passengerName: {
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-Z\s]*$/,
        message: 'Passenger name must contain only letters and spaces'
    },

    coach: {
        pattern: /^[A-Z0-9]{1,3}$/,
        message: 'Coach must be 1-3 alphanumeric characters'
    },

    berth: {
        pattern: /^[A-Z]?\d{1,2}$/,
        message: 'Berth must be 1-3 alphanumeric characters'
    },

    status: {
        enum: ['CNF', 'RAC', 'WAITLIST', 'NO_SHOW', 'BOARDED', 'DEBOARDED'],
        message: 'Invalid passenger status'
    },

    class: {
        enum: ['SL', '3A', '2A', '1A', 'FC'],
        message: 'Invalid coach class'
    },

    phone: {
        pattern: /^\d{10}$/,
        message: 'Phone number must be 10 digits'
    },

    email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Invalid email address'
    }
};

/**
 * Validate a single field
 */
export const validateField = (fieldName: string, value: any): ValidationResult => {
    const rule = validationRules[fieldName];

    if (!rule) {
        return { isValid: true, error: null };
    }

    if (value === null || value === undefined || value === '') {
        return {
            isValid: false,
            error: `${fieldName} is required`
        };
    }

    if (rule.minLength && String(value).length < rule.minLength) {
        return {
            isValid: false,
            error: rule.message || `Must be at least ${rule.minLength} characters`
        };
    }

    if (rule.maxLength && String(value).length > rule.maxLength) {
        return {
            isValid: false,
            error: rule.message || `Must be at most ${rule.maxLength} characters`
        };
    }

    if (rule.pattern && !rule.pattern.test(String(value))) {
        return {
            isValid: false,
            error: rule.message || 'Invalid format'
        };
    }

    if (rule.enum && !rule.enum.includes(value)) {
        return {
            isValid: false,
            error: rule.message || `Must be one of: ${rule.enum.join(', ')}`
        };
    }

    if (rule.validateDate) {
        try {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                return { isValid: false, error: 'Invalid date' };
            }
        } catch {
            return { isValid: false, error: 'Invalid date' };
        }
    }

    return { isValid: true, error: null };
};

/**
 * Validate multiple fields at once
 */
export const validateFields = (fields: Record<string, any>): ValidationResults => {
    const errors: Record<string, string> = {};
    let isValid = true;

    Object.entries(fields).forEach(([fieldName, value]) => {
        const result = validateField(fieldName, value);
        if (!result.isValid && result.error) {
            errors[fieldName] = result.error;
            isValid = false;
        }
    });

    return { isValid, errors };
};

/**
 * Get validation message for a field
 */
export const getValidationMessage = (fieldName: string): string => {
    const rule = validationRules[fieldName];
    if (!rule) return '';
    return rule.message || '';
};

/**
 * Transform field value based on validation rules
 */
export const transformFieldValue = (fieldName: string, value: any): any => {
    const rule = validationRules[fieldName];
    if (!rule) return value;

    let transformed = value;

    if (rule.uppercase) {
        transformed = String(transformed).toUpperCase();
    }

    if (typeof transformed === 'string') {
        transformed = transformed.trim();
    }

    return transformed;
};

/**
 * Common form field groups
 */
export const formFieldGroups: Record<string, string[]> = {
    trainInitialization: ['trainNo', 'journeyDate', 'trainName'],
    passengerSearch: ['pnr'],
    passengerDetails: ['passengerName', 'coach', 'berth', 'class', 'status'],
    contact: ['phone', 'email'],
    reallocation: ['pnr', 'status', 'berth']
};

export default {
    validationRules,
    validateField,
    validateFields,
    getValidationMessage,
    transformFieldValue,
    formFieldGroups
};
