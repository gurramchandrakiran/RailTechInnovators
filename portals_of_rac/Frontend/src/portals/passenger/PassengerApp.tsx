// Frontend/src/portals/passenger/PassengerApp.tsx
// Passenger portal — stripped of login/signup and BrowserRouter (handled by root App)
// Keeps: push notifications, upgrade count polling, Navigation tabs, all page routes
import React, { useState, useEffect, MouseEvent } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme, Theme } from '@mui/material/styles';
import { CssBaseline, AppBar, Toolbar, Typography, Container, Box, Tabs, Tab, IconButton, Menu, MenuItem, Divider, Badge } from '@mui/material';
import TrainIcon from '@mui/icons-material/Train';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import MapIcon from '@mui/icons-material/Map';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import UpgradeIcon from '@mui/icons-material/TrendingUp';
import DashboardPage from './pages/DashboardPage';
import PNRSearchPage from './pages/PNRSearchPage';
import JourneyVisualizationPage from './pages/JourneyVisualizationPage';
import UpgradeOffersPage from './pages/UpgradeOffersPage';
import ReportDeboardingPage from './pages/ReportDeboardingPage';
import CancelTicketPage from './pages/CancelTicketPage';
import ChangeBoardingStationPage from './pages/ChangeBoardingStationPage';
import FamilyUpgradeSelectionPage from './pages/FamilyUpgradeSelectionPage';
import QRTicketViewPage from './pages/QRTicketViewPage';
import NotificationBell from './components/NotificationBell';
import { initializePushNotifications } from './services/pushNotificationService';
import axios from 'axios';
import './App.css';
import './UserMenu.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface User {
    name?: string;
    IRCTC_ID?: string;
    pnr?: string;
}

interface NavigationProps {
    user: User | null;
    onLogout: () => void;
    upgradeCount: number;
}

const theme: Theme = createTheme({
    palette: {
        primary: {
            main: '#2c3e50',
            light: '#34495e',
            dark: '#1a252f',
        },
        secondary: {
            main: '#3498db',
        },
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        h4: {
            fontWeight: 600,
        },
    },
});

// Navigation component with tabs — paths are relative to /passenger/*
function Navigation({ user, onLogout, upgradeCount }: NavigationProps): React.ReactElement {
    const location = useLocation();
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

    const getTabValue = (): number => {
        const path = location.pathname.replace('/passenger', '') || '/';
        switch (path) {
            case '/': return 0;
            case '/pnr-search': return 1;
            case '/journey': return 2;
            case '/upgrades': return 3;
            default: return 0;
        }
    };

    const handleMenuOpen = (event: MouseEvent<HTMLElement>): void => {
        setMenuAnchor(event.currentTarget);
    };

    const handleMenuClose = (): void => {
        setMenuAnchor(null);
    };

    const handleLogoutClick = (): void => {
        handleMenuClose();
        onLogout();
    };

    return (
        <AppBar position="static" elevation={2}>
            <Toolbar>
                <TrainIcon sx={{ mr: 2 }} />
                <Typography variant="h6" component="div" sx={{ mr: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Passenger Portal
                </Typography>

                <Tabs
                    value={getTabValue()}
                    textColor="inherit"
                    indicatorColor="secondary"
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{
                        flexGrow: 1,
                        '& .MuiTab-root': {
                            minHeight: 64,
                            color: 'rgba(255,255,255,0.7)',
                            '&.Mui-selected': { color: 'white' }
                        }
                    }}
                >
                    <Tab icon={<HomeIcon />} label="Home"
                        component={Link} to="/passenger" iconPosition="start" />
                    <Tab icon={<SearchIcon />} label="PNR Search"
                        component={Link} to="/passenger/pnr-search" iconPosition="start" />
                    <Tab icon={<MapIcon />} label="Journey"
                        component={Link} to="/passenger/journey" iconPosition="start" />
                    <Tab
                        icon={
                            <Badge badgeContent={upgradeCount} color="error" max={99}>
                                <UpgradeIcon />
                            </Badge>
                        }
                        label={upgradeCount > 0 ? `Upgrades (${upgradeCount})` : 'Upgrades'}
                        component={Link} to="/passenger/upgrades" iconPosition="start"
                    />
                </Tabs>

                <NotificationBell irctcId={user?.IRCTC_ID} />

                {/* Three-dots Menu */}
                <IconButton color="inherit" onClick={handleMenuOpen} sx={{ ml: 1 }}>
                    <MoreVertIcon />
                </IconButton>
                <Menu
                    anchorEl={menuAnchor}
                    open={Boolean(menuAnchor)}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem disabled sx={{ opacity: 0.8 }}>
                        <Typography variant="body2" color="text.secondary">
                            {user?.name || user?.IRCTC_ID || 'Passenger'}
                        </Typography>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleMenuClose}>
                        <SettingsIcon sx={{ mr: 1, fontSize: 20 }} />
                        Settings
                    </MenuItem>
                    <MenuItem onClick={handleLogoutClick} sx={{ color: '#e74c3c' }}>
                        <LogoutIcon sx={{ mr: 1, fontSize: 20 }} />
                        Logout
                    </MenuItem>
                </Menu>
            </Toolbar>
        </AppBar>
    );
}

interface PassengerAppProps {
    onLogout: () => void;
}

function PassengerApp({ onLogout }: PassengerAppProps): React.ReactElement {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [upgradeCount, setUpgradeCount] = useState<number>(0);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
            initializePushNotifications();
        }
    }, []);

    // Fetch upgrade count periodically
    useEffect(() => {
        if (!user?.IRCTC_ID) return;

        const fetchUpgradeCount = async (): Promise<void> => {
            try {
                const response = await axios.get(`${API_URL}/passenger/pending-upgrades/${user.IRCTC_ID}`);
                if (response.data.success) {
                    setUpgradeCount(response.data.pendingUpgrades?.length || 0);
                }
            } catch (err) {
                console.log('Could not fetch upgrade count');
            }
        };

        fetchUpgradeCount();
        const interval = setInterval(fetchUpgradeCount, 30000);
        return () => clearInterval(interval);
    }, [user?.IRCTC_ID]);

    const handleLogout = (): void => {
        onLogout();
        navigate('/passenger', { replace: true });
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Navigation user={user} onLogout={handleLogout} upgradeCount={upgradeCount} />

                <Box sx={{ flex: 1 }}>
                    <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/pnr-search" element={<PNRSearchPage />} />
                        <Route path="/journey" element={<JourneyVisualizationPage />} />
                        <Route path="/upgrades" element={<UpgradeOffersPage />} />
                        <Route path="/family-upgrade" element={<FamilyUpgradeSelectionPage />} />
                        <Route path="/report-deboarding" element={<ReportDeboardingPage />} />
                        <Route path="/cancel-ticket" element={<CancelTicketPage />} />
                        <Route path="/change-boarding" element={<ChangeBoardingStationPage />} />
                        <Route path="/ticket-view" element={<QRTicketViewPage />} />
                    </Routes>
                </Box>

                <Box component="footer" sx={{ bgcolor: 'background.paper', py: 3, borderTop: '1px solid #e0e0e0' }}>
                    <Container maxWidth="lg">
                        <Typography variant="body2" color="text.secondary" align="center">
                            © 2025 Indian Railways - Dynamic RAC Reallocation System
                        </Typography>
                    </Container>
                </Box>
            </Box>
        </ThemeProvider>
    );
}

export default PassengerApp;
