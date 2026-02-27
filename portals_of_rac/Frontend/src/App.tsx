// Frontend/src/App.tsx — Root router for the unified frontend
import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RoleSelector from './shared/components/RoleSelector';
import LoginPage from './shared/auth/LoginPage';
import SignUpPage from './shared/auth/SignUpPage';
import './App.css';

// Lazy-load each portal for code splitting
const AdminApp = lazy(() => import('./portals/admin/AdminApp'));
const TteApp = lazy(() => import('./portals/tte/TteApp'));
const PassengerApp = lazy(() => import('./portals/passenger/PassengerApp'));

// Also lazy-load the QR ticket view (accessible without auth)
const QRTicketViewPage = lazy(() => import('./portals/passenger/pages/QRTicketViewPage'));

type PortalRole = 'admin' | 'tte' | 'passenger';

function LoadingFallback(): React.ReactElement {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontFamily: 'Inter, sans-serif',
            color: '#667eea',
            fontSize: '1.2rem'
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🚂</div>
                Loading portal...
            </div>
        </div>
    );
}

function App(): React.ReactElement {
    // Initialize auth state synchronously from localStorage
    // so route guards don't redirect on first render before useEffect runs
    const [authenticated, setAuthenticated] = useState<boolean>(() => {
        return !!localStorage.getItem('token') && !!localStorage.getItem('activePortal');
    });
    const [activePortal, setActivePortal] = useState<PortalRole | null>(() => {
        return (localStorage.getItem('activePortal') as PortalRole | null);
    });

    const handleLoginSuccess = (portal: PortalRole): void => {
        setAuthenticated(true);
        setActivePortal(portal);
    };

    const handleLogout = (): void => {
        // Clear all auth data
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('activePortal');
        localStorage.removeItem('trainAssigned');
        localStorage.removeItem('trainNo');
        localStorage.removeItem('tickets');
        setAuthenticated(false);
        setActivePortal(null);
    };

    return (
        <Router>
            <Suspense fallback={<LoadingFallback />}>
                <Routes>
                    {/* Public: QR ticket view — no auth needed */}
                    <Route path="/ticket-view" element={<QRTicketViewPage />} />

                    {/* Public: Role selection & auth */}
                    <Route path="/login" element={
                        authenticated && activePortal
                            ? <Navigate to={`/${activePortal}`} replace />
                            : <LoginPage onLoginSuccess={handleLoginSuccess} />
                    } />
                    <Route path="/signup" element={
                        authenticated && activePortal
                            ? <Navigate to={`/${activePortal}`} replace />
                            : <SignUpPage />
                    } />

                    {/* Portal routes — auth-guarded */}
                    <Route path="/admin/*" element={
                        authenticated && activePortal === 'admin'
                            ? <AdminApp onLogout={handleLogout} />
                            : <Navigate to="/" replace />
                    } />
                    <Route path="/tte/*" element={
                        authenticated && activePortal === 'tte'
                            ? <TteApp onLogout={handleLogout} />
                            : <Navigate to="/" replace />
                    } />
                    <Route path="/passenger/*" element={
                        authenticated && activePortal === 'passenger'
                            ? <PassengerApp onLogout={handleLogout} />
                            : <Navigate to="/" replace />
                    } />

                    {/* Default: Role selector or auto-redirect */}
                    <Route path="/" element={
                        authenticated && activePortal
                            ? <Navigate to={`/${activePortal}`} replace />
                            : <RoleSelector />
                    } />

                    {/* Catch-all */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </Router>
    );
}

export default App;
