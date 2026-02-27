// tte-portal/src/pages/BoardingVerificationPage.tsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert,
    CircularProgress,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import { tteAPI } from '../api';

interface Passenger {
    pnr: string;
    name: string;
    pnrStatus: string;
    racStatus?: string;
    coach: string;
    berth: string;
    from: string;
    to: string;
}

interface Stats {
    total: number;
    pending: number;
}

interface ConfirmDialogState {
    open: boolean;
    pnr: string | null;
    name: string;
}

function BoardingVerificationPage(): React.ReactElement {
    const [loading, setLoading] = useState<boolean>(false);
    const [passengers, setPassengers] = useState<Passenger[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [station, setStation] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ open: false, pnr: null, name: '' });

    // Fetch boarding queue
    const fetchBoardingQueue = async (): Promise<void> => {
        setLoading(true);
        setError('');

        try {
            const response = await tteAPI.getBoardingQueue();

            if (response.success) {
                setPassengers(response.data.passengers);
                setStats(response.data.stats);
                setStation(response.data.station);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load boarding queue');
            console.error('Error loading queue:', err);
        } finally {
            setLoading(false);
        }
    };

    // Confirm all passengers boarded
    const handleConfirmAll = async (): Promise<void> => {
        if (passengers.length === 0) {
            setError('No passengers to confirm');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await tteAPI.confirmAllBoarded();

            if (response.success) {
                setSuccess(`✅ ${response.data.count} passengers confirmed boarded`);
                // Refresh queue
                setTimeout(() => {
                    fetchBoardingQueue();
                    setSuccess('');
                }, 2000);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to confirm boarding');
            console.error('Error confirming:', err);
        } finally {
            setLoading(false);
        }
    };

    // Mark individual passenger as NO_SHOW
    const handleMarkNoShow = async (pnr: string): Promise<void> => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await tteAPI.markNoShow(pnr);

            if (response.success) {
                setSuccess(`❌ Passenger ${pnr} marked as NO_SHOW`);
                // Refresh queue
                setTimeout(() => {
                    fetchBoardingQueue();
                    setSuccess('');
                }, 2000);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to mark NO_SHOW');
            console.error('Error marking no-show:', err);
        } finally {
            setLoading(false);
            setConfirmDialog({ open: false, pnr: null, name: '' });
        }
    };

    // Open confirmation dialog
    const openConfirmDialog = (pnr: string, name: string): void => {
        setConfirmDialog({ open: true, pnr, name });
    };

    // Load data on mount
    useEffect(() => {
        fetchBoardingQueue();
    }, []);

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Boarding Verification
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Current Station: <strong>{station || 'Loading...'}</strong>
                    </Typography>
                </Box>
                <IconButton onClick={fetchBoardingQueue} disabled={loading}>
                    <RefreshIcon />
                </IconButton>
            </Box>

            {/* Stats */}
            {stats && (
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Chip
                        label={`Total: ${stats.total}`}
                        color="default"
                        variant="outlined"
                    />
                    <Chip
                        label={`Pending: ${stats.pending}`}
                        color="warning"
                        variant="filled"
                    />
                </Box>
            )}

            {/* Success/Error Messages */}
            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {/* Confirm All Button */}
            {passengers.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Button
                        variant="contained"
                        color="success"
                        size="large"
                        startIcon={<CheckCircleIcon />}
                        onClick={handleConfirmAll}
                        disabled={loading}
                        fullWidth
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Confirm All Boarded'}
                    </Button>
                </Box>
            )}

            {/* Passengers Table */}
            {loading && passengers.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : passengers.length === 0 ? (
                <Alert severity="info">
                    No passengers pending boarding verification at this station.
                </Alert>
            ) : (
                <TableContainer component={Paper} elevation={2}>
                    <Table>
                        <TableHead sx={{ bgcolor: 'primary.main' }}>
                            <TableRow>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>PNR</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>RAC</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Seat</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>From → To</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {passengers.map((passenger) => (
                                <TableRow key={passenger.pnr} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight="600">
                                            {passenger.pnr}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{passenger.name}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={passenger.pnrStatus}
                                            size="small"
                                            color={passenger.pnrStatus === 'CNF' ? 'success' : 'warning'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {passenger.racStatus || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {passenger.coach}-{passenger.berth}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {passenger.from} → {passenger.to}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            size="small"
                                            startIcon={<CancelIcon />}
                                            onClick={() => openConfirmDialog(passenger.pnr, passenger.name)}
                                            disabled={loading}
                                        >
                                            NO_SHOW
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog({ open: false, pnr: null, name: '' })}
            >
                <DialogTitle>Confirm NO_SHOW</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to mark <strong>{confirmDialog.name}</strong> (PNR: {confirmDialog.pnr}) as NO_SHOW?
                        <br /><br />
                        This action will remove them from the boarding queue.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setConfirmDialog({ open: false, pnr: null, name: '' })}
                        color="primary"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => confirmDialog.pnr && handleMarkNoShow(confirmDialog.pnr)}
                        color="error"
                        variant="contained"
                        autoFocus
                    >
                        Confirm NO_SHOW
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default BoardingVerificationPage;

