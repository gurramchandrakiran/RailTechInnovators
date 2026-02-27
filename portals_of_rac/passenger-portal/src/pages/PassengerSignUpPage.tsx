// passenger-portal/src/pages/PassengerSignUpPage.tsx
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { passengerAPI } from '../api';
import '../styles/pages/PassengerSignUpPage.css';

interface PassengerSignUpPageProps {
    onSwitchToLogin: () => void;
}

function PassengerSignUpPage({ onSwitchToLogin }: PassengerSignUpPageProps): React.ReactElement {
    const [email, setEmail] = useState<string>('');
    const [irctcId, setIrctcId] = useState<string>('');
    const [name, setName] = useState<string>('');
    const [phone, setPhone] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
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

        if (!irctcId.toUpperCase().startsWith('IR_')) {
            setError('IRCTC ID must start with IR_ (e.g., IR_0001)');
            setLoading(false);
            return;
        }

        try {
            const response = await passengerAPI.register({
                email,
                irctcId: irctcId.toUpperCase(),
                name,
                phone: phone || undefined,
                password,
                confirmPassword
            });

            if (response.success) {
                setSuccess(response.message || 'Account created successfully! You can now login.');
                // Clear form
                setEmail('');
                setIrctcId('');
                setName('');
                setPhone('');
                setPassword('');
                setConfirmPassword('');
                // Auto switch to login after 2 seconds
                setTimeout(() => {
                    onSwitchToLogin();
                }, 2000);
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
                    <h1>🚂 Passenger Portal</h1>
                    <p>Create Your Account</p>
                </div>

                <form onSubmit={handleSignUp} className="signup-form">
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                            placeholder="your.email@example.com"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="irctcId">IRCTC ID</label>
                        <input
                            type="text"
                            id="irctcId"
                            value={irctcId}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setIrctcId(e.target.value.toUpperCase())}
                            placeholder="IR_0001"
                            required
                            disabled={loading}
                        />
                        <small>Must start with IR_</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="phone">Phone (Optional)</label>
                        <input
                            type="tel"
                            id="phone"
                            value={phone}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                            placeholder="9876543210"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            id="password"
                            value={password}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            placeholder="Create a password"
                            required
                            disabled={loading}
                        />
                        <ul className="password-requirements">
                            <li>At least 8 characters</li>
                            <li>1 uppercase, 1 lowercase, 1 number</li>
                        </ul>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="show-password">
                        <input
                            type="checkbox"
                            id="showPasswordToggle"
                            checked={showPassword}
                            onChange={(e) => setShowPassword(e.target.checked)}
                        />
                        <label htmlFor="showPasswordToggle">Show Password</label>
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

export default PassengerSignUpPage;
