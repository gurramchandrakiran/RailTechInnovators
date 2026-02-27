// Frontend/src/portals/admin/AdminApp.tsx
// Admin portal — stripped of login logic and BrowserRouter (both handled by root App)
import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import TrainDashboard from './pages/TrainDashboard';

// CSS imports (previously loaded in admin-portal/src/main.tsx)
import './index.css';
import './App.css';
import './UserMenu.css';
import './styles/responsive-global.css';
import './styles/viewport-scale.css';

interface AdminAppProps {
    onLogout: () => void;
}

/**
 * Wrapper that forces TrainDashboard to fully re-mount when the trainNo
 * changes (e.g. switching tabs). Without this, React reuses the same
 * component instance and the old train data persists.
 */
function TrainDashboardWithKey({ initialPage }: { initialPage?: string }) {
    const { trainNo } = useParams();
    return <TrainDashboard key={trainNo} initialPage={initialPage} />;
}

function AdminApp({ onLogout }: AdminAppProps): React.ReactElement {
    return (
        <Routes>
            {/* Landing Page - Train Selection */}
            <Route path="/" element={<LandingPage onLogout={onLogout} />} />

            {/* Train Dashboard - Auto-configured from URL param */}
            <Route path="/train/:trainNo" element={<TrainDashboardWithKey />} />

            {/* Manual Config Page */}
            <Route path="/config" element={<TrainDashboardWithKey initialPage="config" />} />

            {/* Redirect unknown routes to admin landing */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
    );
}

export default AdminApp;
