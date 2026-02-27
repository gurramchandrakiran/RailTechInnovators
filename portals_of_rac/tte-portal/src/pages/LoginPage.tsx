// tte-portal/src/pages/LoginPage.tsx
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { tteAPI } from '../api';
import '../styles/pages/LoginPage.css';

interface LoginPageProps {
    // No props needed - TTEs registered by admin only
}

function LoginPage({ }: LoginPageProps): React.ReactElement {
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
            const response = await tteAPI.login(employeeId, password);

            if (response.success && response.token && response.user) {
                // Map API response to localStorage format
                const apiUser = response.user;
                const userForStorage = {
                    username: apiUser.name || apiUser.employeeId || '',
                    role: apiUser.role || 'TTE',
                    userId: apiUser.employeeId || '',
                    trainAssigned: apiUser.trainAssigned || ''
                };

                localStorage.setItem('token', response.token);
                if (response.refreshToken) {
                    localStorage.setItem('refreshToken', response.refreshToken);
                }
                localStorage.setItem('user', JSON.stringify(userForStorage));
                localStorage.setItem('trainAssigned', String(apiUser.trainAssigned || ''));
                window.location.reload();
            }
        } catch (err: any) {
            // Clear any stale auth data so it doesn't interfere with the next login attempt
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('trainAssigned');
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1>🚂 TTE Portal</h1>
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
                    <p>TTE Portal</p>
                    <small>TTEs are registered by Admin. Contact your administrator for credentials.</small>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
