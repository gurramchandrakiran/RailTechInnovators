// passenger-portal/src/pages/DashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Container,
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Menu,
    MenuItem,
    Divider,
    TextField,
    Radio,
    RadioGroup,
    FormControlLabel,
    Paper
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import BoardingPass from '../components/BoardingPass';
import JourneyTimeline from '../components/JourneyTimeline';
import NotificationSettings from '../components/NotificationSettings';
import { requestPushPermission } from '../utils/pushManager';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Station {
    code: string;
    name: string;
    arrivalTime?: string;
}

interface JourneyData {
    stations?: Station[];
}

interface TrainState {
    journey?: JourneyData;
    currentStationIndex?: number;
    currentStationIdx?: number;
    journeyStarted?: boolean;
    stations?: Station[];
}

interface Passenger {
    Name?: string;
    PNR_Number?: string;
    NO_show?: boolean;
    [key: string]: unknown;
}

interface UpgradeOffer {
    notificationId?: string;
    offeredBerth?: string;
    coach?: string;
    berthType?: string;
    currentStatus?: string;
}

interface PendingUpgrade {
    id: string;
    pnr?: string;
    currentBerth?: string;
    proposedBerthFull?: string;
    proposedBerthType?: string;
    proposedCoach?: string;
    stationName?: string;
}

interface VerifyData {
    irctcId: string;
    pnr: string;
}

interface WebSocketMessage {
    type: string;
    irctcId?: string;
    offer?: UpgradeOffer;
    data?: {
        irctcId?: string;
        pnr?: string;
        reason?: string;
    };
    // Group upgrade properties
    pnr?: string;
    vacantSeatsCount?: number;
    passengerCount?: number;
}

function DashboardPage(): React.ReactElement {
    const [passenger, setPassenger] = useState<Passenger | null>(null);
    const [trainState, setTrainState] = useState<TrainState | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [upgradeOffer, setUpgradeOffer] = useState<UpgradeOffer | null>(null);
    const [reverting, setReverting] = useState<boolean>(false);
    const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [isRejected, setIsRejected] = useState<boolean>(false);  // ✅ Track if upgrade was rejected

    // DUAL-APPROVAL: Pending upgrades for Online passengers
    const [pendingUpgrades, setPendingUpgrades] = useState<PendingUpgrade[]>([]);
    const [approvingUpgrade, setApprovingUpgrade] = useState<string | null>(null);

    // Boarding station change modal states
    const [showChangeModal, setShowChangeModal] = useState<boolean>(false);
    const [changeStep, setChangeStep] = useState<number>(1);
    const [verifyData, setVerifyData] = useState<VerifyData>({ irctcId: '', pnr: '' });
    const [changeOTP, setChangeOTP] = useState<string>('');
    const [changeOTPSent, setChangeOTPSent] = useState<boolean>(false);
    const [availableStations, setAvailableStations] = useState<Station[]>([]);
    const [selectedStation, setSelectedStation] = useState<Station | null>(null);
    const [processing, setProcessing] = useState<boolean>(false);

    // Cancel ticket modal states
    const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
    const [cancelStep, setCancelStep] = useState<number>(1);
    const [cancelVerifyData, setCancelVerifyData] = useState<VerifyData>({ irctcId: '', pnr: '' });
    const [cancelOTP, setCancelOTP] = useState<string>('');
    const [cancelOTPSent, setCancelOTPSent] = useState<boolean>(false);
    const [cancelProcessing, setCancelProcessing] = useState<boolean>(false);

    const handleSettingsClick = (event: React.MouseEvent<HTMLElement>): void => {
        setSettingsAnchor(event.currentTarget);
    };

    const handleSettingsClose = (): void => {
        setSettingsAnchor(null);
    };

    const handleOpenSettings = (): void => {
        setShowSettings(true);
        handleSettingsClose();
    };

    const handleLogout = (): void => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    };

    const fetchData = async (): Promise<void> => {
        try {
            setLoading(true);
            setError(null);

            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const irctcId = userData.irctcId || 'IR_8001';

            // Fetch passenger booking — this should work even without train initialization
            try {
                const passengerRes = await axios.get(`${API_URL}/passengers/by-irctc/${irctcId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (passengerRes.data.success && passengerRes.data.data) {
                    setPassenger(passengerRes.data.data);
                    // ✅ Check if passenger rejected an upgrade offer
                    if (passengerRes.data.data.Upgrade_Status === 'REJECTED') {
                        setIsRejected(true);
                    }
                } else {
                    setError('No booking found for your IRCTC ID');
                }
            } catch (err) {
                console.error('Error fetching passenger data:', err);
                const axiosError = err as { response?: { data?: { message?: string } } };
                setError(axiosError.response?.data?.message || 'Failed to load your booking details');
            }

            // Fetch train state separately — this may fail if train isn't initialized yet
            // Don't block passenger details if it fails
            try {
                const trainRes = await axios.get(`${API_URL}/train/state`);
                if (trainRes.data.success && trainRes.data.data) {
                    setTrainState(trainRes.data.data);
                }
            } catch {
                // Train not initialized yet — that's OK, passenger details still show
                console.log('[Dashboard] Train state not available (train may not be initialized yet)');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingUpgrades = async (): Promise<void> => {
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            if (!userData.irctcId) return;

            const response = await axios.get(
                `${API_URL}/passenger/pending-upgrades/${userData.irctcId}`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
            );

            if (response.data.success && response.data.data?.upgrades) {
                setPendingUpgrades(response.data.data.upgrades);
                console.log(`📋 Found ${response.data.data.upgrades.length} pending upgrades`);
            }
        } catch (err) {
            console.error('Error fetching pending upgrades:', err);
        }
    };

    // ✅ UX ENHANCEMENT: Check for active group upgrade offers on reconnection
    const checkForActiveGroupUpgrade = async (): Promise<void> => {
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const pnr = userData.pnr || userData.PNR_Number;

            if (!pnr) {
                console.log('⚠️ No PNR found in user data, skipping group upgrade check');
                return;
            }

            console.log('🔍 Checking for active group upgrade offers...');

            const response = await axios.get(
                `${API_URL}/reallocation/group-upgrade-status/${pnr}`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
            );

            if (response.data.success && response.data.hasActiveOffer) {
                console.log('✅ Found active group upgrade offer on reconnection!', response.data);

                // Show notification and navigate to selection page
                alert(`🎉 You have an active upgrade offer!\\n\\nSeats available: ${response.data.vacantSeatsCount}\\nYour group size: ${response.data.passengerCount}\\n\\nSelect passengers now!`);

                window.location.href = `/#/family-upgrade?pnr=${pnr}`;
            } else {
                console.log('ℹ️ No active group upgrade offers found');
            }
        } catch (err) {
            console.error('Error checking for active group upgrades:', err);
            // Silently fail - this is just a reconnection check
        }
    };

    useEffect(() => {
        fetchData();

        const userData = JSON.parse(localStorage.getItem('user') || '{}');

        if (userData.irctcId) {
            requestPushPermission(userData.irctcId);
        }

        // ✅ Check for active group upgrade offers on load (reconnection scenario)
        checkForActiveGroupUpgrade();

        const ws = new WebSocket('ws://localhost:5000');

        ws.onopen = (): void => {
            console.log('📡 WebSocket connected to passenger portal');
            // Identify this client for targeted messaging
            ws.send(JSON.stringify({ type: 'IDENTIFY', role: 'PASSENGER', irctcId: userData.irctcId }));
        };

        ws.onmessage = (event: MessageEvent): void => {
            try {
                const data: WebSocketMessage = JSON.parse(event.data);

                // Multi-train filter: ignore broadcast events for other trains
                const myTrainNo = userData.trainNo || localStorage.getItem('trainNo');
                if ((data as any).trainNo && myTrainNo && String((data as any).trainNo) !== String(myTrainNo)) {
                    return; // Not our train
                }

                if (data.type === 'upgradeOffer' && data.irctcId === userData.irctcId) {
                    console.log('🎉 Upgrade offer received:', data);
                    setUpgradeOffer(data.offer || null);
                }

                if (data.type === 'UPGRADE_OFFER_AVAILABLE' && data.irctcId === userData.irctcId) {
                    console.log('🎉 Dual-approval upgrade offer received:', data);
                    fetchPendingUpgrades();
                }


                if (data.type === 'RAC_REALLOCATION_APPROVED') {
                    fetchPendingUpgrades();
                }

                if (data.type === 'RAC_UPGRADE_REJECTED' && data.data?.irctcId === userData.irctcId) {
                    console.log('❌ Upgrade rejected:', data);
                    setPendingUpgrades(prev => prev.filter(u => u.pnr !== data.data?.pnr));
                    alert(`❌ Your upgrade offer was rejected.\nReason: ${data.data.reason}`);
                }

                // ✨ NEW: Group upgrade offer received - navigate to selection page
                if (data.type === 'GROUP_UPGRADE_AVAILABLE') {
                    // Match PNR - check both pnr and PNR_Number fields
                    const passengerPNR = userData.pnr || userData.PNR_Number;
                    const groupData: any = data.data || data;

                    if (passengerPNR && groupData.pnr === passengerPNR) {
                        console.log('🎯 Group upgrade offer received!', data);
                        alert(`🎉 Great news! Your group is eligible for an upgrade!\n\nYou have 10 minutes to select passengers.\n\nSeats available: ${groupData.vacantSeatsCount}\nYour group size: ${groupData.passengerCount}`);

                        // Navigate to family upgrade selection page
                        window.location.href = `/#/family-upgrade?pnr=${groupData.pnr}`;
                    }
                }
            } catch (err) {
                console.error('Error parsing WebSocket message:', err);
            }
        };

        const refreshInterval = setInterval(() => {
            fetchData();
        }, 120000);

        return () => {
            ws.close();
            clearInterval(refreshInterval);
        };
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            if (userData.irctcId) {
                fetchPendingUpgrades();
            }
        }, 500);

        const upgradeInterval = setInterval(() => {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            if (userData.irctcId) {
                axios.get(
                    `${API_URL}/passenger/pending-upgrades/${userData.irctcId}`,
                    { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
                ).then(res => {
                    if (res.data.success && res.data.data?.upgrades) {
                        setPendingUpgrades(res.data.data.upgrades);
                    }
                }).catch(() => { });
            }
        }, 30000);

        return () => {
            clearTimeout(timer);
            clearInterval(upgradeInterval);
        };
    }, []);

    const handleApproveUpgrade = async (upgrade: PendingUpgrade): Promise<void> => {
        if (!window.confirm(`Accept upgrade to ${upgrade.proposedBerthFull} (${upgrade.proposedBerthType})?`)) {
            return;
        }

        setApprovingUpgrade(upgrade.id);
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const response = await axios.post(
                `${API_URL}/passenger/approve-upgrade`,
                { upgradeId: upgrade.id, irctcId: userData.irctcId },
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
            );

            if (response.data.success) {
                alert(`🎉 Upgrade approved! Your new berth: ${response.data.data.newBerth}`);
                setPendingUpgrades(prev => prev.filter(u => u.id !== upgrade.id));
                fetchData();
            }
        } catch (err) {
            const axiosError = err as { response?: { data?: { message?: string } } };
            alert('❌ ' + (axiosError.response?.data?.message || 'Failed to approve upgrade'));
        } finally {
            setApprovingUpgrade(null);
        }
    };

    const handleAcceptUpgrade = async (): Promise<void> => {
        if (!upgradeOffer) return;

        try {
            const response = await axios.post(
                `${API_URL}/tte/confirm-upgrade`,
                {
                    pnr: passenger?.PNR_Number,
                    notificationId: upgradeOffer.notificationId || 'MANUAL_ACCEPT'
                },
                {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }
            );

            if (response.data.success) {
                alert('🎉 Upgrade confirmed! Your new berth is ' + upgradeOffer.offeredBerth);
                setUpgradeOffer(null);
                fetchData();
            }
        } catch (err) {
            const axiosError = err as { response?: { data?: { message?: string } } };
            alert(axiosError.response?.data?.message || 'Failed to confirm upgrade');
        }
    };

    const handleRejectUpgrade = (): void => {
        if (window.confirm('Are you sure you want to reject this upgrade offer?')) {
            setUpgradeOffer(null);
            alert('Upgrade offer rejected. The berth will be offered to another passenger.');
        }
    };

    const handleRevertNoShow = async (): Promise<void> => {
        if (!window.confirm('Are you present on the train? This will revert your NO-SHOW status.')) {
            return;
        }

        setReverting(true);
        try {
            const response = await axios.post(
                `${API_URL}/passenger/revert-no-show`,
                { pnr: passenger?.PNR_Number },
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
            );

            if (response.data.success) {
                alert('✅ NO-SHOW status cleared! You are confirmed as boarded.');
                fetchData();
            }
        } catch (err) {
            const axiosError = err as { response?: { data?: { message?: string } } };
            const errorMsg = axiosError.response?.data?.message || 'Failed to revert NO-SHOW status';
            alert('❌ ' + errorMsg);
        } finally {
            setReverting(false);
        }
    };

    // Boarding Station Change Handlers
    const handleOpenChangeModal = (): void => {
        setShowChangeModal(true);
        setChangeStep(1);
        setVerifyData({ irctcId: '', pnr: '' });
        setSelectedStation(null);
        setAvailableStations([]);
    };

    const handleCloseChangeModal = (): void => {
        setShowChangeModal(false);
        setChangeStep(1);
        setVerifyData({ irctcId: '', pnr: '' });
        setSelectedStation(null);
    };

    const handleVerifyForChange = async (): Promise<void> => {
        if (!verifyData.irctcId || !verifyData.pnr) {
            alert('Please enter both IRCTC ID and PNR Number');
            return;
        }

        setProcessing(true);
        try {
            const response = await axios.post(`${API_URL}/otp/send`, {
                irctcId: verifyData.irctcId,
                pnr: verifyData.pnr,
                purpose: 'Change Boarding Station'
            });

            if (response.data.success) {
                setChangeOTPSent(true);
                setChangeStep(2);
                alert(`✅ ${response.data.message}\n\nPlease check your email for the OTP.`);
            }
        } catch (err) {
            console.error('Error sending OTP:', err);
            const axiosError = err as { response?: { data?: { message?: string } } };
            alert(axiosError.response?.data?.message || 'Failed to send OTP');
        } finally {
            setProcessing(false);
        }
    };

    const handleVerifyOTPForChange = async (): Promise<void> => {
        if (!changeOTP || changeOTP.length !== 6) {
            alert('Please enter the 6-digit OTP');
            return;
        }

        setProcessing(true);
        try {
            const otpResponse = await axios.post(`${API_URL}/otp/verify`, {
                irctcId: verifyData.irctcId,
                pnr: verifyData.pnr,
                otp: changeOTP
            });

            if (otpResponse.data.success) {
                const stationsResponse = await axios.get(`${API_URL}/passenger/available-boarding-stations/${verifyData.pnr}`);

                if (stationsResponse.data.success) {
                    if (stationsResponse.data.alreadyChanged) {
                        alert('Boarding station has already been changed once for this booking.');
                        handleCloseChangeModal();
                        return;
                    }

                    setAvailableStations(stationsResponse.data.availableStations || []);

                    if (stationsResponse.data.availableStations?.length === 0) {
                        alert('No forward stations available for change.');
                        handleCloseChangeModal();
                        return;
                    }

                    setChangeStep(3);
                }
            }
        } catch (err) {
            console.error('Error verifying OTP:', err);
            const axiosError = err as { response?: { data?: { message?: string } } };
            alert(axiosError.response?.data?.message || 'Failed to verify OTP');
        } finally {
            setProcessing(false);
        }
    };

    const handleSelectStation = (station: Station | undefined): void => {
        if (station) {
            setSelectedStation(station);
        }
    };

    const handleConfirmChange = async (): Promise<void> => {
        if (!selectedStation) {
            alert('Please select a station');
            return;
        }

        const confirmResult = window.confirm(
            `Are you sure you want to change your boarding station to ${selectedStation.name} (${selectedStation.code})?\n\nThis action can only be done ONCE and cannot be undone.`
        );

        if (!confirmResult) return;

        setProcessing(true);
        try {
            const response = await axios.post(`${API_URL}/passenger/change-boarding-station`, {
                pnr: verifyData.pnr,
                irctcId: verifyData.irctcId,
                newStationCode: selectedStation.code
            });

            if (response.data.success) {
                alert(`✅ Boarding station changed successfully to ${selectedStation.name}!`);
                handleCloseChangeModal();
                fetchData();
            }
        } catch (err) {
            console.error('Error changing station:', err);
            const axiosError = err as { response?: { data?: { message?: string } } };
            alert(axiosError.response?.data?.message || 'Failed to change boarding station');
        } finally {
            setProcessing(false);
        }
    };

    // Cancel Ticket Handlers
    const handleOpenCancelModal = (): void => {
        setShowCancelModal(true);
        setCancelVerifyData({ irctcId: '', pnr: '' });
    };

    const handleCloseCancelModal = (): void => {
        setShowCancelModal(false);
        setCancelStep(1);
        setCancelVerifyData({ irctcId: '', pnr: '' });
        setCancelOTP('');
        setCancelOTPSent(false);
    };

    const handleSendCancelOTP = async (): Promise<void> => {
        if (!cancelVerifyData.irctcId || !cancelVerifyData.pnr) {
            alert('Please enter both IRCTC ID and PNR Number');
            return;
        }

        setCancelProcessing(true);
        try {
            const response = await axios.post(`${API_URL}/otp/send`, {
                irctcId: cancelVerifyData.irctcId,
                pnr: cancelVerifyData.pnr,
                purpose: 'Cancel Ticket'
            });

            if (response.data.success) {
                setCancelOTPSent(true);
                setCancelStep(2);
                alert(`✅ ${response.data.message}\n\nPlease check your email for the OTP.`);
            }
        } catch (err) {
            console.error('Error sending OTP:', err);
            const axiosError = err as { response?: { data?: { message?: string } } };
            alert(axiosError.response?.data?.message || 'Failed to send OTP');
        } finally {
            setCancelProcessing(false);
        }
    };

    const handleConfirmCancel = async (): Promise<void> => {
        if (!cancelOTP || cancelOTP.length !== 6) {
            alert('Please enter the 6-digit OTP');
            return;
        }

        setCancelProcessing(true);
        try {
            const otpResponse = await axios.post(`${API_URL}/otp/verify`, {
                irctcId: cancelVerifyData.irctcId,
                pnr: cancelVerifyData.pnr,
                otp: cancelOTP
            });

            if (!otpResponse.data.success) {
                alert(otpResponse.data.message || 'Invalid OTP');
                setCancelProcessing(false);
                return;
            }

            const confirmed = window.confirm(
                '⚠️ Are you sure you want to CANCEL your ticket?\n\n' +
                'This will mark you as NO-SHOW and your berth will be made available for other passengers.\n\n' +
                'This action cannot be undone!'
            );

            if (!confirmed) {
                setCancelProcessing(false);
                return;
            }

            const response = await axios.post(`${API_URL}/passenger/self-cancel`, {
                pnr: cancelVerifyData.pnr,
                irctcId: cancelVerifyData.irctcId
            });

            if (response.data.success) {
                alert('✅ Ticket cancelled successfully. Your berth is now available for other passengers.');
                handleCloseCancelModal();
                fetchData();
            } else {
                throw new Error(response.data.message || 'Failed to cancel ticket');
            }
        } catch (err) {
            const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
            alert('❌ ' + (axiosError.response?.data?.message || axiosError.message || 'Failed to cancel ticket'));
        } finally {
            setCancelProcessing(false);
        }
    };

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Loading your booking...</Typography>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            No Active Booking
                        </Typography>
                        <Typography color="text.secondary">
                            You don't have any confirmed bookings at the moment.
                            Please book a ticket through IRCTC to view your boarding pass.
                        </Typography>
                    </CardContent>
                </Card>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, mb: { xs: 2, md: 4 }, px: { xs: 2, sm: 3, md: 4 } }}>
            <Box sx={{ mb: 4, textAlign: 'center' }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                    Welcome, {passenger?.Name || 'Passenger'}!
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Your digital boarding pass is ready
                </Typography>
            </Box>

            {/* Settings Dialog */}
            <Dialog
                open={showSettings}
                onClose={() => setShowSettings(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SettingsIcon />
                        Settings
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <NotificationSettings />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowSettings(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* NO-SHOW Warning Banner */}
            {passenger?.NO_show && (
                <Alert
                    severity="error"
                    sx={{
                        mb: 3,
                        p: 2,
                        border: '2px solid #d32f2f',
                        borderRadius: '8px',
                        backgroundColor: '#ffebee'
                    }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            variant="outlined"
                            onClick={handleRevertNoShow}
                            disabled={reverting}
                            sx={{
                                fontWeight: 600,
                                borderWidth: 2,
                                '&:hover': { borderWidth: 2 }
                            }}
                        >
                            {reverting ? 'Reverting...' : "I'm Here! Revert"}
                        </Button>
                    }
                >
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            ⚠️ YOU HAVE BEEN MARKED AS NO-SHOW
                        </Typography>
                        <Typography variant="body2">
                            The Train Ticket Examiner (TTE) has marked you as not present on the train.
                            If you ARE present, click the "I'm Here!" button to revert this status immediately.
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                            ⚠️ Your berth may be allocated to another passenger if not reverted!
                        </Typography>
                    </Box>
                </Alert>
            )}

            {/* ✅ UPGRADE REJECTED Warning Banner */}
            {isRejected && (
                <Alert
                    severity="warning"
                    sx={{
                        mb: 3,
                        p: 2,
                        border: '2px solid #f57c00',
                        borderRadius: '8px',
                        backgroundColor: '#fff3e0'
                    }}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            🚫 Upgrade Not Available
                        </Typography>
                        <Typography variant="body2">
                            You previously declined an upgrade offer. Passengers who decline upgrades are not eligible for further upgrade offers during this journey.
                        </Typography>
                    </Box>
                </Alert>
            )}

            {/* ⚠️ OFFLINE STATUS Info Banner */}
            {passenger?.Online_Status === 'offline' && (
                <Alert
                    severity="info"
                    sx={{
                        mb: 3,
                        p: 2,
                        border: '2px solid #1976d2',
                        borderRadius: '8px',
                        backgroundColor: '#e3f2fd'
                    }}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            ℹ️ Offline Passenger
                        </Typography>
                        <Typography variant="body2">
                            Your booking status is <strong>Offline</strong>. You are not eligible for automatic upgrade notifications through the Passenger Portal.
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            For upgrade opportunities, please contact the Train Ticket Examiner (TTE) directly on board.
                        </Typography>
                    </Box>
                </Alert>
            )}

            {/* Journey Tracker */}
            {trainState?.journey?.stations && (
                <JourneyTimeline
                    stations={trainState.journey.stations}
                    currentStationIndex={trainState.currentStationIndex || 0}
                />
            )}

            {/* Boarding Pass */}
            <BoardingPass
                passenger={passenger}
                journeyStarted={trainState?.journeyStarted || false}
                currentStation={
                    trainState?.stations?.[
                        trainState?.currentStationIdx ?? trainState?.currentStationIndex ?? 0
                    ]?.name || 'Unknown'
                }
            />

            {/* Ticket Actions */}
            <Paper elevation={0} sx={{ mt: 4, mb: 4, p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                    Ticket Actions
                </Typography>
                <Grid container spacing={3}>
                    {/* Report Deboarding Card */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Card sx={{ bgcolor: '#fff3e0', border: '1px solid #f57c00', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    🚉 Leaving Early?
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    If you've left the train before your destination, report it here. Your berth will be made available for other passengers to upgrade.
                                </Typography>
                                <Box sx={{ mt: 'auto' }}>
                                    <Button
                                        component={Link}
                                        to="/report-deboarding"
                                        variant="contained"
                                        fullWidth
                                        sx={{ bgcolor: '#f57c00', '&:hover': { bgcolor: '#e65100' } }}
                                    >
                                        Report Deboarding
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Cancel Ticket Card */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Card sx={{ bgcolor: '#ffebee', border: '1px solid #e53935', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    ❌ Cancel Ticket?
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Need to cancel your journey? Your berth will be freed for other passengers to upgrade.
                                </Typography>
                                <Box sx={{ mt: 'auto' }}>
                                    <Button
                                        component={Link}
                                        to="/cancel-ticket"
                                        variant="contained"
                                        fullWidth
                                        sx={{ bgcolor: '#e53935', '&:hover': { bgcolor: '#c62828' } }}
                                    >
                                        Cancel Ticket
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Change Boarding Station Card */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Card sx={{ bgcolor: '#e3f2fd', border: '1px solid #1976d2', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    🔄 Change Boarding Station?
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Need to board from a different station? Change to a forward station along your route.
                                </Typography>
                                <Box sx={{ mt: 'auto' }}>
                                    <Button
                                        component={Link}
                                        to="/change-boarding"
                                        variant="contained"
                                        fullWidth
                                        sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }}
                                    >
                                        Change Station
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>
            {/* Boarding Station Change Modal */}
            <Dialog open={showChangeModal} onClose={handleCloseChangeModal} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: '#2c3e50', color: '#ffffff' }}>
                    🔄 Change Boarding Station
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    {changeStep === 1 && (
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Please verify your IRCTC ID and PNR to proceed with changing your boarding station.
                            </Typography>
                            <TextField
                                fullWidth
                                label="IRCTC ID"
                                value={verifyData.irctcId}
                                onChange={(e) => setVerifyData({ ...verifyData, irctcId: e.target.value })}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                fullWidth
                                label="PNR Number"
                                value={verifyData.pnr}
                                onChange={(e) => setVerifyData({ ...verifyData, pnr: e.target.value })}
                            />
                        </Box>
                    )}

                    {changeStep === 2 && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                📧 OTP has been sent to your registered email address.
                            </Alert>
                            <TextField
                                fullWidth
                                label="Enter 6-digit OTP"
                                value={changeOTP}
                                onChange={(e) => setChangeOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
                                placeholder="000000"
                                autoFocus
                            />
                        </Box>
                    )}

                    {changeStep === 3 && (
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Select your new boarding station from the next 3 upcoming stations:
                            </Typography>
                            <RadioGroup
                                value={selectedStation?.code || ''}
                                onChange={(e) => {
                                    const station = availableStations.find(s => s.code === e.target.value);
                                    handleSelectStation(station);
                                }}
                            >
                                {availableStations.map((station, index) => (
                                    <Box
                                        key={station.code}
                                        sx={{
                                            border: '1px solid #ecf0f1',
                                            borderRadius: '6px',
                                            p: 2,
                                            mb: 1.5,
                                            bgcolor: selectedStation?.code === station.code ? '#e3f2fd' : '#ffffff',
                                            cursor: 'pointer',
                                            '&:hover': { bgcolor: '#f5f5f5' }
                                        }}
                                        onClick={() => handleSelectStation(station)}
                                    >
                                        <FormControlLabel
                                            value={station.code}
                                            control={<Radio />}
                                            label={
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                        {index + 1}. {station.name} ({station.code})
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Arrival: {station.arrivalTime || 'N/A'}
                                                    </Typography>
                                                </Box>
                                            }
                                            sx={{ width: '100%', m: 0 }}
                                        />
                                    </Box>
                                ))}
                            </RadioGroup>
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                    <strong>Important:</strong> This change can only be made ONCE and cannot be undone.
                                </Typography>
                            </Alert>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handleCloseChangeModal} disabled={processing}>
                        Cancel
                    </Button>
                    {changeStep === 1 && (
                        <Button
                            onClick={handleVerifyForChange}
                            variant="contained"
                            disabled={processing || !verifyData.irctcId || !verifyData.pnr}
                        >
                            {processing ? 'Sending OTP...' : 'Send OTP'}
                        </Button>
                    )}
                    {changeStep === 2 && (
                        <Button
                            onClick={handleVerifyOTPForChange}
                            variant="contained"
                            disabled={processing || changeOTP.length !== 6}
                        >
                            {processing ? 'Verifying...' : 'Verify OTP'}
                        </Button>
                    )}
                    {changeStep === 3 && (
                        <Button
                            onClick={handleConfirmChange}
                            variant="contained"
                            color="primary"
                            disabled={processing || !selectedStation}
                        >
                            {processing ? 'Updating...' : 'Confirm Change'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Cancel Ticket Modal */}
            <Dialog open={showCancelModal} onClose={handleCloseCancelModal} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: '#e74c3c', color: '#ffffff' }}>
                    ❌ Cancel Ticket
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Alert severity="error" sx={{ mb: 3 }}>
                        <Typography variant="body2">
                            <strong>Warning:</strong> Cancelling your ticket will mark you as NO-SHOW and your berth will be made available for other passengers.
                        </Typography>
                    </Alert>
                    {cancelStep === 1 && (
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Please verify your IRCTC ID and PNR to proceed with ticket cancellation.
                            </Typography>
                            <TextField
                                fullWidth
                                label="IRCTC ID"
                                value={cancelVerifyData.irctcId}
                                onChange={(e) => setCancelVerifyData({ ...cancelVerifyData, irctcId: e.target.value })}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                fullWidth
                                label="PNR Number"
                                value={cancelVerifyData.pnr}
                                onChange={(e) => setCancelVerifyData({ ...cancelVerifyData, pnr: e.target.value })}
                            />
                        </Box>
                    )}

                    {cancelStep === 2 && (
                        <Box>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                📧 OTP has been sent to your registered email.
                            </Alert>
                            <TextField
                                fullWidth
                                label="Enter 6-digit OTP"
                                value={cancelOTP}
                                onChange={(e) => setCancelOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                inputProps={{ maxLength: 6 }}
                                placeholder="000000"
                                autoFocus
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handleCloseCancelModal} disabled={cancelProcessing}>
                        Back
                    </Button>

                    {cancelStep === 1 && (
                        <Button
                            onClick={handleSendCancelOTP}
                            variant="contained"
                            color="error"
                            disabled={cancelProcessing || !cancelVerifyData.irctcId || !cancelVerifyData.pnr}
                        >
                            {cancelProcessing ? 'Sending...' : 'Send OTP'}
                        </Button>
                    )}

                    {cancelStep === 2 && (
                        <Button
                            onClick={handleConfirmCancel}
                            variant="contained"
                            color="error"
                            disabled={cancelProcessing || cancelOTP.length !== 6}
                        >
                            {cancelProcessing ? 'Cancelling...' : 'Confirm Cancellation'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Container >
    );
}

export default DashboardPage;
