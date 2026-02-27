// tte-portal/src/pages/SignUpPage.tsx
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { tteAPI } from '../api';
import '../styles/pages/SignUpPage.css';

interface SignUpPageProps {
    onSwitchToLogin: () => void;
}

function SignUpPage({ onSwitchToLogin }: SignUpPageProps): React.ReactElement {
    const [employeeId, setEmployeeId] = useState<string>('');
    const [name, setName] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
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

        // Validate ID prefix - TTE IDs must start with TTE_
        if (!employeeId.toUpperCase().startsWith('TTE_')) {
            setError('Employee ID must start with TTE_ (e.g., TTE_02)');
            setLoading(false);
            return;
        }

        try {
            const response = await tteAPI.register(
                employeeId.toUpperCase(),
                password,
                confirmPassword,
                name || employeeId.toUpperCase()
            );

            if (response.success) {
                setSuccess(response.message || 'Account created successfully! You can now login.');
                // Clear form
                setEmployeeId('');
                setName('');
                setPassword('');
                setConfirmPassword('');
                // Auto switch to login after 2 seconds
                setTimeout(() => {
                    onSwitchToLogin();
                }, 2000);
            } else {
                setError(response.message || 'Registration failed. Please try again.');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-box">
                <div className="signup-header">
                    <h1>🚂 TTE Portal</h1>
                    <p>Create New TTE Account</p>
                </div>

                <form onSubmit={handleSignUp} className="signup-form">
                    <div className="form-group">
                        <label htmlFor="employeeId">Employee ID</label>
                        <input
                            type="text"
                            id="employeeId"
                            value={employeeId}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmployeeId(e.target.value.toUpperCase())}
                            placeholder="TTE_02"
                            required
                            disabled={loading}
                        />
                        <small>Must start with TTE_ (e.g., TTE_02, TTE_JOHN)</small>
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
