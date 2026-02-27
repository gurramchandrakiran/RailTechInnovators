// admin-portal/src/components/FormInput.tsx
// Reusable form input component with validation

import React, { useState, ChangeEvent, FocusEvent } from 'react';
import { validateField, transformFieldValue, getValidationMessage } from '../services/formValidation';
import '../styles/components/FormInput.css';

interface FormInputProps {
    name: string;
    label?: string;
    type?: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    required?: boolean;
    validate?: boolean;
    autoComplete?: string;
    className?: string;
    icon?: React.ReactNode;
    hint?: string;
    maxLength?: number;
}

function FormInput({
    name,
    label,
    type = 'text',
    placeholder = '',
    value,
    onChange,
    onBlur,
    disabled = false,
    required = false,
    validate = true,
    autoComplete = 'off',
    className = '',
    icon = null,
    hint = null,
    maxLength = undefined
}: FormInputProps): React.ReactElement {
    const [touched, setTouched] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
        let newValue = e.target.value;

        if (validate) {
            newValue = transformFieldValue(name, newValue);
        }

        onChange(newValue);

        if (touched && validate) {
            const result = validateField(name, newValue);
            setError(result.error);
        }
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement>): void => {
        setTouched(true);

        if (validate && required) {
            const result = validateField(name, value);
            setError(result.error);
        }

        if (onBlur) {
            onBlur(e);
        }
    };

    const validationMessage = validate ? getValidationMessage(name) : '';
    const hasError = error && touched;

    return (
        <div className={`form-input-wrapper ${hasError ? 'has-error' : ''} ${className}`}>
            {label && (
                <label className="form-label" htmlFor={name}>
                    {label}
                    {required && <span className="required-asterisk">*</span>}
                </label>
            )}

            <div className="form-input-container">
                {icon && <span className="form-input-icon">{icon}</span>}
                <input
                    id={name}
                    type={type}
                    name={name}
                    className={`form-input ${icon ? 'with-icon' : ''} ${hasError ? 'error' : ''}`}
                    placeholder={placeholder}
                    value={value || ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    maxLength={maxLength}
                    required={required}
                />
            </div>

            {hasError && (
                <p className="form-error-message" role="alert">
                    {error}
                </p>
            )}

            {hint && !hasError && (
                <p className="form-hint-message">
                    {hint}
                </p>
            )}

            {validationMessage && !hasError && touched && (
                <p className="form-validation-message">
                    {validationMessage}
                </p>
            )}
        </div>
    );
}

export default FormInput;

