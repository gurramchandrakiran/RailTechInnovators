// admin-portal/src/pages/LoginPage.tsx
import React, { useState, FormEvent, ChangeEvent } from 'react';
import api from '../services/api';
import '../styles/pages/LoginPage.css';

interface LoginPageProps {
    onSwitchToSignUp?: () => void;
}

function LoginPage({ onSwitchToSignUp }: LoginPageProps): React.ReactElement {
    const [employeeId, setEmployeeId] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const handleLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/staff/login', {
                employeeId,
                password
            });

            if (response.data.success) {
                localStorage.setItem('token', response.data.token);
                if (response.data.refreshToken) {
                    localStorage.setItem('refreshToken', response.data.refreshToken);
                }
                localStorage.setItem('user', JSON.stringify(response.data.user));
                window.location.reload();
            }
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1>🚂 Admin Portal</h1>
                    <p>Dynamic RAC Reallocation System</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label htmlFor="employeeId">Employee ID</label>
                        <input
                            type="text"
                            id="employeeId"
                            value={employeeId}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmployeeId(e.target.value)}
                            placeholder="Enter your employee ID"
                            required
                            disabled={loading}
                        />
                    </div>

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
                    <p>Admin & TTE Portal</p>
                    <small>Test Credentials: ADMIN_01 / Prasanth@123</small>
                    {onSwitchToSignUp && (
                        <p style={{ marginTop: '12px' }}>
                            Don't have an account?{' '}
                            <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToSignUp(); }} style={{ color: '#667eea', fontWeight: 600 }}>
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
