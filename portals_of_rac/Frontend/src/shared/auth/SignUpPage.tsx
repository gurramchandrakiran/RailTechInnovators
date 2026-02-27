// Frontend/src/shared/auth/SignUpPage.tsx
// Unified signup page — adapts fields based on ?role= query param
// Admin signup: employeeId, name, role (Admin/TTE), password
// Passenger signup: email, irctcId, name, phone, password
// TTE: No signup (managed by admin)
import React, { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './SignUpPage.css';

const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function SignUpPage(): React.ReactElement {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const role = searchParams.get('role') || 'passenger';
    const isAdmin = role === 'admin';

    // Admin fields
    const [employeeId, setEmployeeId] = useState<string>('');
    const [staffRole, setStaffRole] = useState<string>('Admin');
    const [staffEmail, setStaffEmail] = useState<string>('');

    // Passenger fields
    const [email, setEmail] = useState<string>('');
    const [irctcId, setIrctcId] = useState<string>('');
    const [phone, setPhone] = useState<string>('');

    // Common fields
    const [name, setName] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    // Ensure CSRF token
    useEffect(() => {
        axios.get(`${API_BASE_URL}/csrf-token`, { withCredentials: true }).catch(() => { });
    }, []);

    const getCsrfToken = (): string | null => {
        const value = `; ${document.cookie}`;
        const parts = value.split('; csrfToken=');
        if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
        return null;
    };

    const handleSignUp = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            let endpoint: string;
            let body: Record<string, any>;

            if (isAdmin) {
                // Validate employee ID prefix
                const idUpper = employeeId.toUpperCase();
                if (staffRole === 'Admin' && !idUpper.startsWith('ADMIN_')) {
                    setError('Admin Employee ID must start with ADMIN_ (e.g., ADMIN_001)');
                    setLoading(false);
                    return;
                }
                if (staffRole === 'TTE' && !idUpper.startsWith('TTE_')) {
                    setError('TTE Employee ID must start with TTE_ (e.g., TTE_001)');
                    setLoading(false);
                    return;
                }

                endpoint = '/auth/staff/register';
                body = {
                    employeeId: idUpper,
                    password,
                    confirmPassword,
                    role: staffRole,
                    name: name || idUpper,
                    email: staffEmail || undefined,
                };
            } else {
                // Validate IRCTC ID prefix
                if (!irctcId.toUpperCase().startsWith('IR_')) {
                    setError('IRCTC ID must start with IR_ (e.g., IR_0001)');
                    setLoading(false);
                    return;
                }

                endpoint = '/auth/passenger/register';
                body = {
                    email,
                    irctcId: irctcId.toUpperCase(),
                    name,
                    phone: phone || undefined,
                    password,
                    confirmPassword,
                };
            }

            const csrfToken = getCsrfToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

            const response = await axios.post(`${API_BASE_URL}${endpoint}`, body, {
                withCredentials: true,
                headers,
            });

            if (response.data.success) {
                setSuccess(response.data.message || 'Account created successfully! You can now login.');
                // Clear form
                setEmployeeId(''); setName(''); setPassword(''); setConfirmPassword('');
                setEmail(''); setIrctcId(''); setPhone(''); setStaffEmail('');
                // Auto-redirect to login after 2s
                setTimeout(() => {
                    navigate(`/login?role=${role}`);
                }, 2000);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getTitle = (): string => isAdmin ? '🛡️ Admin Portal' : ' Passenger Portal';

    return (
        <div className="signup-container">
            <video
                autoPlay
                loop
                muted
                playsInline
                className="background-video"
            >
                <source src="/videos/Train.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            <div className="signup-box">
                <div className="signup-header">
                    <h1>{getTitle()}</h1>
                    <p>Create Your Account</p>
                </div>

                <form onSubmit={handleSignUp} className="signup-form">
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                            type="text" id="name" value={name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                            placeholder="Enter your full name" required disabled={loading}
                        />
                    </div>

                    {isAdmin ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="employeeId">Employee ID</label>
                                <input
                                    type="text" id="employeeId" value={employeeId}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmployeeId(e.target.value.toUpperCase())}
                                    placeholder={staffRole === 'Admin' ? 'ADMIN_001' : 'TTE_001'}
                                    required disabled={loading}
                                />
                                <small>Must start with {staffRole === 'Admin' ? 'ADMIN_' : 'TTE_'}</small>
                            </div>

                            <div className="form-group">
                                <label>Role</label>
                                <div className="role-toggle">
                                    <button
                                        type="button"
                                        className={`role-btn ${staffRole === 'Admin' ? 'active' : ''}`}
                                        onClick={() => setStaffRole('Admin')}
                                    >Admin</button>
                                    <button
                                        type="button"
                                        className={`role-btn ${staffRole === 'TTE' ? 'active' : ''}`}
                                        onClick={() => setStaffRole('TTE')}
                                    >TTE</button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="staffEmail">Email (Optional)</label>
                                <input
                                    type="email" id="staffEmail" value={staffEmail}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setStaffEmail(e.target.value)}
                                    placeholder="your.email@example.com" disabled={loading}
                                />
                                <small>We'll send you a welcome email if provided</small>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-group">
                                <label htmlFor="signupEmail">Email</label>
                                <input
                                    type="email" id="signupEmail" value={email}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                    placeholder="your.email@example.com" required disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="signupIrctcId">IRCTC ID</label>
                                <input
                                    type="text" id="signupIrctcId" value={irctcId}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setIrctcId(e.target.value.toUpperCase())}
                                    placeholder="IR_0001" required disabled={loading}
                                />
                                <small>Must start with IR_</small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="signupPhone">Phone (Optional)</label>
                                <input
                                    type="tel" id="signupPhone" value={phone}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                                    placeholder="9876543210" disabled={loading}
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label htmlFor="signupPassword">Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'} id="signupPassword"
                            value={password}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            placeholder="Create a password" required disabled={loading}
                        />
                        <ul className="password-requirements">
                            <li>At least 8 characters</li>
                            <li>1 uppercase, 1 lowercase, 1 number</li>
                        </ul>
                    </div>

                    <div className="form-group">
                        <label htmlFor="signupConfirmPassword">Confirm Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'} id="signupConfirmPassword"
                            value={confirmPassword}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password" required disabled={loading}
                        />
                    </div>

                    <div className="show-password">
                        <input type="checkbox" id="showPasswordToggle"
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
                    <p>Already have an account? <Link to={`/login?role=${role}`} style={{ color: '#26a69a', fontWeight: 600, textDecoration: 'none' }}>Login</Link></p>
                    <p style={{ marginTop: '12px' }}>
                        <Link to="/" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.9rem' }}>
                            ← Back to Portal Selection
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default SignUpPage;
