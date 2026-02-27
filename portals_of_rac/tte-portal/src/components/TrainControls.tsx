// tte-portal/src/components/TrainControls.tsx
import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Alert,
    Chip,
    LinearProgress,
    List,
    ListItem,
    ListItemText,
    Divider
} from '@mui/material';
import Grid from '@mui/material/Grid';
import NavigationIcon from '@mui/icons-material/Navigation';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';
import { tteAPI } from '../api';

interface Station {
    code?: string;
    name: string;
    arrival?: string;
    departure?: string;
    idx?: number;
}

interface TrainState {
    trainNo: string;
    trainName: string;
    stations: Station[];
    currentStationIdx: number;
}

interface MoveResult {
    station: string;
    boarded: number;
    deboarded: number;
    racAllocated: number;
    noShows: number;
}

const TrainControls: React.FC = () => {
    const [trainState, setTrainState] = useState<TrainState | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');

    useEffect(() => {
        fetchTrainState();
    }, []);

    const fetchTrainState = async (): Promise<void> => {
        try {
            const response = await tteAPI.getTrainState();
            setTrainState(response.data);
        } catch (err) {
            setMessage('Failed to fetch train state');
        }
    };

    const handleMoveNextStation = async (): Promise<void> => {
        if (!window.confirm('Move train to next station? This will process boarding, deboarding, and RAC upgrades.')) {
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const response = await tteAPI.moveNextStation();

            const result = response.data as MoveResult;
            setMessage(
                `✅ Moved to: ${result.station}\n` +
                `Boarded: ${result.boarded}\n` +
                `Deboarded: ${result.deboarded}\n` +
                `RAC Upgraded: ${result.racAllocated}\n` +
                `No-Shows: ${result.noShows}`
            );

            fetchTrainState();
        } catch (err: any) {
            setMessage(err.response?.data?.message || 'Failed to move to next station');
        } finally {
            setLoading(false);
        }
    };

    if (!trainState) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <Typography>Loading train state...</Typography>
            </Box>
        );
    }

    const currentStation = trainState.stations[trainState.currentStationIdx];
    const nextStation = trainState.stations[trainState.currentStationIdx + 1];
    const progress = ((trainState.currentStationIdx + 1) / trainState.stations.length) * 100;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Train Controls</Typography>

            {/* Current Status */}
            <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'white' }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="h5">{trainState.trainName}</Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                Train #{trainState.trainNo}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="h6">Current Station:</Typography>
                            <Typography variant="h4">{currentStation?.name}</Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                Station {trainState.currentStationIdx + 1} of {trainState.stations.length}
                            </Typography>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Journey Progress */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Journey Progress</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                            <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            {progress.toFixed(0)}%
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        {trainState.stations[0]?.name} → {trainState.stations[trainState.stations.length - 1]?.name}
                    </Typography>
                </CardContent>
            </Card>

            {/* Next Station Control */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <NavigationIcon />
                        Move Next Station
                    </Typography>

                    {nextStation ? (
                        <Box>
                            <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
                                Next station: <strong>{nextStation.name}</strong>
                            </Alert>

                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                startIcon={loading ? null : <PlayArrowIcon />}
                                onClick={handleMoveNextStation}
                                disabled={loading}
                                sx={{ py: 2 }}
                            >
                                {loading ? 'Processing...' : `Move to ${nextStation.name}`}
                            </Button>

                            {loading && <LinearProgress sx={{ mt: 2 }} />}
                        </Box>
                    ) : (
                        <Alert severity="success">
                            🎉 Journey Complete! Train has reached the final station.
                        </Alert>
                    )}

                    {message && (
                        <Alert severity={message.includes('✅') ? 'success' : 'error'} sx={{ mt: 2, whiteSpace: 'pre-line' }}>
                            {message}
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Station List */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>All Stations</Typography>
                    <List>
                        {trainState.stations.map((station, index) => (
                            <React.Fragment key={station.code || station.idx || `station-${index}`}>
                                {index > 0 && <Divider />}
                                <ListItem>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="body1">{station.name}</Typography>
                                                {index === trainState.currentStationIdx && (
                                                    <Chip label="Current" color="primary" size="small" />
                                                )}
                                                {index < trainState.currentStationIdx && (
                                                    <Chip label="Completed" color="success" size="small" />
                                                )}
                                            </Box>
                                        }
                                        secondary={`Arrival: ${station.arrival} | Departure: ${station.departure}`}
                                    />
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                </CardContent>
            </Card>
        </Box>
    );
};

export default TrainControls;
