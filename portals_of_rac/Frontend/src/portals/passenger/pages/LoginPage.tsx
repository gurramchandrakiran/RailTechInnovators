// passenger-portal/src/pages/LoginPage.tsx
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { passengerAPI } from '../api';
import '../styles/pages/LoginPage.css';

interface LoginPageProps {
    onSwitchToSignUp?: () => void;
}

function LoginPage({ onSwitchToSignUp }: LoginPageProps): React.ReactElement {
    const [loginType, setLoginType] = useState<number>(0); // 0 = IRCTC ID, 1 = Email
    const [irctcId, setIrctcId] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const handleLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const loginId = loginType === 0 ? irctcId : email;
            const response = await passengerAPI.login(loginId, password, loginType === 0 ? 'irctcId' : 'email');

            if (response.success && response.token) {
                localStorage.setItem('token', response.token);
                if (response.refreshToken) {
                    localStorage.setItem('refreshToken', response.refreshToken);
                }
                localStorage.setItem('user', JSON.stringify(response.user));
                localStorage.setItem('tickets', JSON.stringify(response.tickets));
                // Store trainNo from first ticket for multi-train API scoping
                if (response.tickets?.length > 0 && response.tickets[0].trainNumber) {
                    localStorage.setItem('trainNo', String(response.tickets[0].trainNumber));
                }
                window.location.reload();
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1>🚂 Passenger Portal</h1>
                    <p>Check your RAC status & bookings</p>
                </div>

                <div className="login-tabs">
                    <button
                        className={`login-tab ${loginType === 0 ? 'active' : ''}`}
                        onClick={() => setLoginType(0)}
                        type="button"
                    >
                        IRCTC ID
                    </button>
                    <button
                        className={`login-tab ${loginType === 1 ? 'active' : ''}`}
                        onClick={() => setLoginType(1)}
                        type="button"
                    >
                        Email
                    </button>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {loginType === 0 ? (
                        <div className="form-group">
                            <label htmlFor="irctcId">IRCTC ID</label>
                            <input
                                type="text"
                                id="irctcId"
                                value={irctcId}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setIrctcId(e.target.value)}
                                placeholder="e.g., IR_0001"
                                required
                                disabled={loading}
                            />
                        </div>
                    ) : (
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
                    )}

                    <div className="form-group">
                        <label htmlFor="password">Password:</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            id="password"
                            value={password}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="show-password">
                        <input
                            type="checkbox"
                            id="showPassword"
                            checked={showPassword}
                            onChange={(e) => setShowPassword(e.target.checked)}
                        />
                        <label htmlFor="showPassword">Show Password</label>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div className="login-footer">
                    <p>Passenger Portal</p>
                    <small>Test Credentials: IR_0001 / Prasanth@123</small>
                    {onSwitchToSignUp && (
                        <p style={{ marginTop: '12px' }}>
                            Don't have an account?{' '}
                            <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToSignUp(); }} style={{ color: '#26a69a', fontWeight: 600 }}>
                                Sign Up
                            </a>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
