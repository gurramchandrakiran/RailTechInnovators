// tte-portal/src/App.tsx
import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, AppBar, Toolbar, Typography, Container, Box, Tabs, Tab } from '@mui/material';
import TrainIcon from '@mui/icons-material/Train';

// Pages/Components
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BoardingVerificationPage from './pages/BoardingVerificationPage';
import PassengersPage from './pages/PassengersPage';
import BoardedPassengersPage from './pages/BoardedPassengersPage';
import UpgradeNotificationsPage from './pages/UpgradeNotificationsPage';
import PendingReallocationsPage from './pages/PendingReallocationsPage';
import VisualizationPage from './pages/VisualizationPage';
import './App.css';
import './UserMenu.css';

// Push notification service for TTE alerts
import { initializePushNotifications } from './services/pushNotificationService';

// API Base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// User interface
interface User {
    username?: string;
    role?: string;
    userId?: string;
}

// Temporary Placeholder Component
function OfflineUpgradeVerification(): React.ReactElement {
    return (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h4" gutterBottom>Offline Upgrade Verification</Typography>
            <Typography variant="body1" color="text.secondary">
                This feature will be replaced by new boarding verification workflow.
            </Typography>
        </Box>
    );
}

const theme = createTheme({
    palette: {
        primary: {
            main: '#2c3e50',  // Dark navy - same as admin-portal
            light: '#34495e',
            dark: '#1a252f',
        },
        secondary: {
            main: '#3498db',  // Blue accent
        },
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        h4: {
            fontWeight: 600,
        },
    },
});

function App(): React.ReactElement {
    // Authentication state
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [user, setUser] = useState<User | null>(null);
    const [currentTab, setCurrentTab] = useState<number>(0);
    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 960);
    const [menuOpen, setMenuOpen] = useState<boolean>(false);

    const [isLoading, setIsLoading] = useState<boolean>(true); // Add loading state

    // Helper function to refresh access token
    const refreshAccessToken = async (refreshToken: string): Promise<string | null> => {
        try {
            console.log('[TTE Auth] Attempting to refresh access token...');
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.token) {
                    console.log('[TTE Auth] Token refreshed successfully');
                    localStorage.setItem('token', data.token);
                    return data.token;
                }
            }
            console.log('[TTE Auth] Token refresh failed');
            return null;
        } catch (error) {
            console.error('[TTE Auth] Token refresh error:', error);
            return null;
        }
    };

    // Check for existing auth token on mount and verify/refresh it
    useEffect(() => {
        const verifyAndSetup = async (): Promise<void> => {
            const token = localStorage.getItem('token');
            const refreshToken = localStorage.getItem('refreshToken');
            const userData = localStorage.getItem('user');

            if (!token && !refreshToken) {
                // No tokens at all - show login
                setIsLoading(false);
                return;
            }

            if (token && userData) {
                try {
                    // Verify token is still valid by calling /auth/verify
                    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        // Token is valid
                        console.log('[TTE Auth] Token verified successfully');
                        setIsAuthenticated(true);
                        setUser(JSON.parse(userData));
                        setIsLoading(false);

                        // Initialize push notifications when authenticated
                        initializePushNotifications(() => {
                            console.log('🔄 TTE Portal: Refreshing due to push notification...');
                            window.location.reload();
                        }).then(result => {
                            if (result.success) {
                                console.log('✅ TTE push notifications ready');
                            }
                        });
                        return;
                    }

                    // Token verification failed - try to refresh
                    console.log('[TTE Auth] Token verification failed, attempting refresh...');
                } catch (error) {
                    console.error('[TTE Auth] Token verification error:', error);
                }
            }

            // Try to refresh token if we have a refresh token
            if (refreshToken && userData) {
                const newToken = await refreshAccessToken(refreshToken);

                if (newToken) {
                    // Successfully refreshed - user stays logged in
                    setIsAuthenticated(true);
                    setUser(JSON.parse(userData));
                    setIsLoading(false);

                    // Initialize push notifications
                    initializePushNotifications(() => {
                        console.log('🔄 TTE Portal: Refreshing due to push notification...');
                        window.location.reload();
                    }).then(result => {
                        if (result.success) {
                            console.log('✅ TTE push notifications ready');
                        }
                    });
                    return;
                }
            }

            // All attempts failed - clear everything and show login
            console.log('[TTE Auth] All refresh attempts failed, requiring re-login');
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            setIsAuthenticated(false);
            setUser(null);
            setIsLoading(false);
        };

        verifyAndSetup();

        // Handle window resize for mobile detection
        const handleResize = (): void => {
            setIsMobile(window.innerWidth < 960);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Show loading spinner while verifying/refreshing token
    if (isLoading) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '100vh',
                    bgcolor: 'transparent',
                    flexDirection: 'column',
                    gap: 2
                }}>
                    <TrainIcon sx={{ fontSize: 64, color: '#2c3e50' }} />
                    <Typography variant="h6" color="text.secondary">
                        Verifying session...
                    </Typography>
                </Box>
            </ThemeProvider>
        );
    }

    // Show login page if not authenticated
    if (!isAuthenticated) {
        return <LoginPage />;
    }

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number): void => {
        setCurrentTab(newValue);
    };

    // Logout handler
    const handleLogout = (): void => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('trainAssigned');
        setIsAuthenticated(false);
        setUser(null);
        setMenuOpen(false);
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'transparent' }}>
                <AppBar position="static" elevation={3}>
                    <Toolbar>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrainIcon sx={{ fontSize: 32 }} />
                            <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
                                TTE Portal
                            </Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1 }} />
                        {localStorage.getItem('trainAssigned') && (
                            <Typography variant="body2" sx={{
                                mr: 2, px: 1.5, py: 0.5,
                                bgcolor: 'rgba(255,255,255,0.15)',
                                borderRadius: 1,
                                fontWeight: 600,
                                fontSize: '0.8rem'
                            }}>
                                🚂 Train {localStorage.getItem('trainAssigned')}
                            </Typography>
                        )}
                        <Typography variant="body2" sx={{ mr: 2, opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            Welcome, {user?.username || 'TTE'}
                        </Typography>
                        {/* 3-dot menu */}
                        <div className="user-menu">
                            <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
                                ⋮
                            </button>
                            {menuOpen && (
                                <div className="menu-dropdown">
                                    <div className="menu-user-info">
                                        <p><strong>{user?.username || 'TTE'}</strong></p>
                                        <p className="user-role">{user?.role || 'TTE'}</p>
                                    </div>
                                    <hr />
                                    <button onClick={handleLogout} className="menu-item logout">
                                        🚪 Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </Toolbar>
                    <Tabs
                        value={currentTab}
                        onChange={handleTabChange}
                        sx={{
                            bgcolor: '#1a252f',
                            '& .MuiTab-root': {
                                color: 'rgba(255,255,255,0.7)',
                                fontWeight: 500,
                                fontSize: '0.875rem',
                                textTransform: 'none',
                                minHeight: 48,
                                '&.Mui-selected': {
                                    color: '#ffffff',
                                    fontWeight: 600
                                }
                            },
                            '& .MuiTabs-indicator': {
                                backgroundColor: '#3498db',
                                height: 3
                            }
                        }}
                        textColor="inherit"
                        variant={isMobile ? "scrollable" : "standard"}
                        scrollButtons={isMobile ? "auto" : false}
                        allowScrollButtonsMobile
                    >
                        <Tab label="Dashboard" />
                        <Tab label="Passenger List" />
                        <Tab label="Boarded Passengers" />
                        <Tab label="Pending Reallocations" />
                        <Tab label="Journey Visualization" />
                    </Tabs>
                </AppBar>

                {/* Tab Content */}
                <Box sx={{ flex: 1, py: 2 }}>
                    {currentTab === 0 && <DashboardPage />}
                    {currentTab === 1 && <PassengersPage />}
                    {currentTab === 2 && <BoardedPassengersPage />}
                    {currentTab === 3 && <PendingReallocationsPage />}
                    {currentTab === 4 && <VisualizationPage />}
                </Box>

                <Box component="footer" sx={{ bgcolor: 'background.paper', py: 2, borderTop: '1px solid #e0e0e0' }}>
                    <Container maxWidth="xl">
                        <Typography variant="body2" color="text.secondary" align="center">
                            © 2025 Indian Railways TTE Portal - Dynamic RAC Reallocation System
                        </Typography>
                    </Container>
                </Box>
            </Box>
        </ThemeProvider>
    );
}

export default App;
