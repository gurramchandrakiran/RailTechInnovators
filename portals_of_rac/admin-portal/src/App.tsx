// admin-portal/src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import TrainDashboard from './pages/TrainDashboard';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';

/** Forces TrainDashboard to remount when trainNo changes (fixes stale data on tab switch) */
function TrainDashboardWithKey({ initialPage }: { initialPage?: string }) {
    const { trainNo } = useParams();
    return <TrainDashboard key={trainNo} initialPage={initialPage} />;
}

function App(): React.ReactElement {
    // Read token synchronously so the correct route renders immediately on refresh
    // (useEffect would cause a flash of the login page, losing the URL path)
    const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(
        () => !!localStorage.getItem('token')
    );
    const [showSignUp, setShowSignUp] = React.useState<boolean>(false);

    // If not authenticated, show login/signup
    if (!isAuthenticated) {
        if (showSignUp) {
            return <SignUpPage onSwitchToLogin={() => setShowSignUp(false)} />;
        }
        return <LoginPage onSwitchToSignUp={() => setShowSignUp(true)} />;
    }

    return (
        <BrowserRouter>
            <Routes>
                {/* Landing Page - Train Selection */}
                <Route path="/" element={<LandingPage />} />

                {/* Train Dashboard - Auto-configured from URL param */}
                <Route path="/train/:trainNo" element={<TrainDashboardWithKey />} />

                {/* Manual Config Page */}
                <Route path="/config" element={<TrainDashboardWithKey initialPage="config" />} />

                {/* Redirect unknown routes to landing */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

