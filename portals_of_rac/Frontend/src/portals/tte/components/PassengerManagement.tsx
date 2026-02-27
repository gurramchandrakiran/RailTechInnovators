// tte-portal/src/components/PassengerManagement.tsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Button,
    CircularProgress,
    IconButton,
    SelectChangeEvent
} from '@mui/material';
import Grid from '@mui/material/Grid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import { tteAPI } from '../api';

interface Passenger {
    pnr: string;
    name: string;
    pnrStatus: 'CNF' | 'RAC' | 'WL' | string;
    berth?: string;
    from: string;
    to: string;
    boarded: boolean;
    noShow: boolean;
}

interface PassengerFilters {
    status?: string;
    coach?: string;
    from?: string;
    to?: string;
    [key: string]: string | undefined;
}

const PassengerManagement: React.FC = () => {
    const [passengers, setPassengers] = useState<Passenger[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchPNR, setSearchPNR] = useState<string>('');

    useEffect(() => {
        fetchPassengers();
    }, [statusFilter]);

    const fetchPassengers = async (): Promise<void> => {
        setLoading(true);
        try {
            const filters: PassengerFilters = {};
            if (statusFilter) filters.status = statusFilter;
            const response = await tteAPI.getPassengers(filters);
            setPassengers(response.data.passengers || []);
        } catch (err) {
            alert('Failed to fetch passengers');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkBoarded = async (pnr: string): Promise<void> => {
        if (!window.confirm(`Mark passenger ${pnr} as boarded?`)) return;
        try {
            await tteAPI.markBoarded(pnr);
            alert('✅ Passenger marked as boarded');
            fetchPassengers();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to mark boarded');
        }
    };

    const handleMarkDeboarded = async (pnr: string): Promise<void> => {
        if (!window.confirm(`Mark passenger ${pnr} as deboarded?`)) return;
        try {
            await tteAPI.markDeboarded(pnr);
            alert('✅ Passenger marked as deboarded');
            fetchPassengers();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to mark deboarded');
        }
    };

    const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
        switch (status?.toUpperCase()) {
            case 'CNF':
                return 'success';
            case 'RAC':
                return 'warning';
            case 'WL':
                return 'error';
            default:
                return 'default';
        }
    };

    const filteredPassengers = searchPNR
        ? passengers.filter(p => p.pnr.includes(searchPNR.toUpperCase()))
        : passengers;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Passenger Management</Typography>

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField
                                fullWidth
                                label="Search PNR"
                                value={searchPNR}
                                onChange={(e) => setSearchPNR(e.target.value)}
                                placeholder="Enter PNR"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <FormControl fullWidth>
                                <InputLabel>Filter by Status</InputLabel>
                                <Select
                                    value={statusFilter}
                                    onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
                                    label="Filter by Status"
                                >
                                    <MenuItem value="">All</MenuItem>
                                    <MenuItem value="boarded">Boarded</MenuItem>
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="deboarded">Deboarded</MenuItem>
                                    <MenuItem value="no-show">No-Show</MenuItem>
                                    <MenuItem value="cnf">CNF</MenuItem>
                                    <MenuItem value="rac">RAC</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<RefreshIcon />}
                                onClick={fetchPassengers}
                                disabled={loading}
                                sx={{ height: '56px' }}
                            >
                                Refresh
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Passenger Table */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>PNR</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Berth</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Journey</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Boarded</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                    <CircularProgress />
                                </TableCell>
                            </TableRow>
                        ) : filteredPassengers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                    No passengers found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPassengers.map((passenger) => (
                                <TableRow key={passenger.pnr} hover>
                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{passenger.pnr}</TableCell>
                                    <TableCell>{passenger.name}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={passenger.pnrStatus}
                                            color={getStatusColor(passenger.pnrStatus)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{passenger.berth || 'N/A'}</TableCell>
                                    <TableCell>{passenger.from} → {passenger.to}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={passenger.boarded ? 'Yes' : 'No'}
                                            color={passenger.boarded ? 'success' : 'warning'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {!passenger.boarded && !passenger.noShow && (
                                            <IconButton
                                                size="small"
                                                color="success"
                                                onClick={() => handleMarkBoarded(passenger.pnr)}
                                                title="Mark Boarded"
                                            >
                                                <CheckCircleIcon />
                                            </IconButton>
                                        )}
                                        {passenger.boarded && (
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleMarkDeboarded(passenger.pnr)}
                                                title="Mark Deboarded"
                                            >
                                                <CancelIcon />
                                            </IconButton>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default PassengerManagement;
