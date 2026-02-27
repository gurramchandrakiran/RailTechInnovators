// admin-portal/src/pages/SignUpPage.tsx
import React, { useState, FormEvent, ChangeEvent } from 'react';
import api from '../services/api';
import '../styles/pages/SignUpPage.css';

interface SignUpPageProps {
    onSwitchToLogin: () => void;
}

function SignUpPage({ onSwitchToLogin }: SignUpPageProps): React.ReactElement {
    const [employeeId, setEmployeeId] = useState<string>('');
    const [name, setName] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [role, setRole] = useState<string>('ADMIN');
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const handleSignUp = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        // Client-side validation
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        // Validate ID prefix
        const idPrefix = role === 'ADMIN' ? 'ADMIN_' : 'TTE_';
        if (!employeeId.toUpperCase().startsWith(idPrefix)) {
            setError(`Employee ID must start with ${idPrefix} (e.g., ${idPrefix}02)`);
            setLoading(false);
            return;
        }

        try {
            const response = await api.post('/auth/staff/register', {
                employeeId: employeeId.toUpperCase(),
                password,
                confirmPassword,
                role,
                name: name || employeeId.toUpperCase()
            });

            if (response.data.success) {
                setSuccess(response.data.message || 'Account created successfully! You can now login.');
                // Clear form
                setEmployeeId('');
                setName('');
                setPassword('');
                setConfirmPassword('');
                // Auto switch to login after 2 seconds
                setTimeout(() => {
                    onSwitchToLogin();
                }, 2000);
            }
        } catch (err: any) {
            // api.ts interceptor returns the error data object directly
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getIdPlaceholder = (): string => {
        return role === 'ADMIN' ? 'ADMIN_02' : 'TTE_02';
    };

    return (
        <div className="signup-container">
            <div className="signup-box">
                <div className="signup-header">
                    <h1>🚂 Admin Portal</h1>
                    <p>Create New Account</p>
                </div>

                <form onSubmit={handleSignUp} className="signup-form">
                    <div className="form-group">
                        <label htmlFor="role">Account Type</label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                                setRole(e.target.value);
                                setEmployeeId(''); // Reset ID when role changes
                            }}
                            disabled={loading}
                        >
                            <option value="ADMIN">Admin</option>
                            <option value="TTE">TTE (Ticket Examiner)</option>
                        </select>
                        <small>{role === 'ADMIN' ? 'Full system access' : 'Train operations access'}</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="employeeId">Employee ID</label>
                        <input
                            type="text"
                            id="employeeId"
                            value={employeeId}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmployeeId(e.target.value.toUpperCase())}
                            placeholder={getIdPlaceholder()}
                            required
                            disabled={loading}
                        />
                        <small>Must start with {role === 'ADMIN' ? 'ADMIN_' : 'TTE_'}</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="name">Full Name (Optional)</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            placeholder="Create a password"
                            required
                            disabled={loading}
                        />
                        <ul className="password-requirements">
                            <li>At least 8 characters</li>
                            <li>1 uppercase letter, 1 lowercase letter, 1 number</li>
                        </ul>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    <button type="submit" className="signup-btn" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>

                <div className="signup-footer">
                    <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }}>Login</a></p>
                </div>
            </div>
        </div>
    );
}

export default SignUpPage;
