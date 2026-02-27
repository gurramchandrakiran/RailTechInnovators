// Frontend/src/shared/auth/LoginPage.tsx
// Unified login page — adapts fields based on ?role= query param
import React, { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type PortalRole = 'admin' | 'tte' | 'passenger';

interface LoginPageProps {
    onLoginSuccess: (portal: PortalRole) => void;
}

function LoginPage({ onLoginSuccess }: LoginPageProps): React.ReactElement {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const role = (searchParams.get('role') || 'passenger') as PortalRole;

    // Staff fields (admin/tte)
    const [employeeId, setEmployeeId] = useState<string>('');

    // Passenger fields
    const [loginType, setLoginType] = useState<number>(0); // 0 = IRCTC ID, 1 = Email
    const [irctcId, setIrctcId] = useState<string>('');
    const [email, setEmail] = useState<string>('');

    // Common
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    // Ensure CSRF token is fetched
    useEffect(() => {
        axios.get(`${API_BASE_URL}/csrf-token`, { withCredentials: true }).catch(() => { });
    }, []);

    const isStaffRole = role === 'admin' || role === 'tte';

    const getRoleTitle = (): string => {
        switch (role) {
            case 'admin': return '🛡️ Admin Portal';
            case 'tte': return '📝 TTE Portal';
            case 'passenger': return ' Passenger Portal';
        }
    };

    const getRoleSubtitle = (): string => {
        switch (role) {
            case 'admin': return 'System Management & Configuration';
            case 'tte': return 'Dynamic RAC Reallocation System';
            case 'passenger': return 'Check your RAC status & bookings';
        }
    };

    const getCsrfToken = (): string | null => {
        const value = `; ${document.cookie}`;
        const parts = value.split('; csrfToken=');
        if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
        return null;
    };

    const handleLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let endpoint: string;
            let body: Record<string, string>;

            if (isStaffRole) {
                endpoint = '/auth/staff/login';
                body = { employeeId, password };
            } else {
                endpoint = '/auth/passenger/login';
                if (loginType === 0) {
                    body = { irctcId, password };
                } else {
                    body = { email, password };
                }
            }

            const csrfToken = getCsrfToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

            const response = await axios.post(`${API_BASE_URL}${endpoint}`, body, {
                withCredentials: true,
                headers,
            });

            const data = response.data;

            if (data.success && data.token) {
                // Store auth tokens
                localStorage.setItem('token', data.token);
                if (data.refreshToken) {
                    localStorage.setItem('refreshToken', data.refreshToken);
                }
                localStorage.setItem('activePortal', role);

                // Store user data (shape differs per role)
                if (isStaffRole) {
                    const apiUser = data.user;
                    const userForStorage = {
                        username: apiUser?.name || apiUser?.employeeId || '',
                        role: apiUser?.role || role.toUpperCase(),
                        userId: apiUser?.employeeId || '',
                        trainAssigned: apiUser?.trainAssigned || '',
                    };
                    localStorage.setItem('user', JSON.stringify(userForStorage));

                    // TTE-specific: store trainAssigned separately
                    if (role === 'tte' && apiUser?.trainAssigned) {
                        localStorage.setItem('trainAssigned', String(apiUser.trainAssigned));
                    }
                } else {
                    // Passenger
                    localStorage.setItem('user', JSON.stringify(data.user));
                    if (data.tickets) {
                        localStorage.setItem('tickets', JSON.stringify(data.tickets));
                        if (data.tickets.length > 0 && data.tickets[0].trainNumber) {
                            localStorage.setItem('trainNo', String(data.tickets[0].trainNumber));
                        }
                    }
                }

                onLoginSuccess(role);
                navigate(`/${role}`, { replace: true });
            }
        } catch (err: any) {
            if (isStaffRole) {
                // Clear stale auth data on staff login failure
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                localStorage.removeItem('trainAssigned');
            }
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1>{getRoleTitle()}</h1>
                    <p>{getRoleSubtitle()}</p>
                </div>

                {/* Passenger: login type tabs */}
                {!isStaffRole && (
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
                )}

                <form onSubmit={handleLogin} className="login-form">
                    {isStaffRole ? (
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
                    ) : loginType === 0 ? (
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
                            type={showPassword ? 'text' : 'password'}
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
                    {role === 'tte' ? (
                        <small>TTEs are registered by Admin. Contact your administrator for credentials.</small>
                    ) : (
                        <p style={{ marginTop: '12px' }}>
                            Don't have an account?{' '}
                            <Link
                                to={`/signup?role=${role}`}
                                style={{ color: '#26a69a', fontWeight: 600, textDecoration: 'none' }}
                            >
                                Sign Up
                            </Link>
                        </p>
                    )}
                    <p style={{ marginTop: '16px' }}>
                        <Link
                            to="/"
                            style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.9rem' }}
                        >
                            ← Back to Portal Selection
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
