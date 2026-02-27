// passenger-portal/src/components/JourneyTimeline.tsx
import React, { useRef, useEffect, RefObject } from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TrainIcon from '@mui/icons-material/Train';
import { Station } from '../types';
import '../styles/components/JourneyTimeline.css';

interface StationWithSno extends Station {
    sno?: number;
}

interface JourneyTimelineProps {
    stations: StationWithSno[];
    currentStationIndex: number;
}

type StationStatus = 'completed' | 'current' | 'upcoming';

function JourneyTimeline({ stations, currentStationIndex }: JourneyTimelineProps): React.ReactElement {
    const timelineRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);

    // Auto-scroll to current station
    useEffect(() => {
        if (timelineRef.current && currentStationIndex >= 0) {
            const currentStation = timelineRef.current.querySelector('.station-item.current');
            if (currentStation) {
                currentStation.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [currentStationIndex]);

    const getStationStatus = (index: number): StationStatus => {
        if (index < currentStationIndex) return 'completed';
        if (index === currentStationIndex) return 'current';
        return 'upcoming';
    };

    if (!stations || stations.length === 0) {
        return (
            <Paper className="journey-timeline-empty" elevation={2}>
                <Typography color="text.secondary">
                    Journey information not available
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper className="journey-timeline-container" elevation={3}>
            {/* Header */}
            <Box className="timeline-header">
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#f1f5f9' }}>
                    🚉 Train Simulation - Journey Progress
                </Typography>
                <Chip
                    label={`${currentStationIndex + 1}/${stations.length} Stations`}
                    size="small"
                    sx={{
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        color: '#3b82f6',
                        fontWeight: 600
                    }}
                />
            </Box>

            {/* Timeline Scroll */}
            <Box className="timeline-scroll-wrapper" ref={timelineRef}>
                <Box className="timeline-track">
                    {stations.map((station, idx) => {
                        const status = getStationStatus(idx);

                        return (
                            <Box key={station.code || `station-${idx}`} className={`station-item ${status}`}>
                                {/* Connecting Line */}
                                {idx > 0 && (
                                    <Box className={`connecting-line-behind ${idx <= currentStationIndex ? 'completed' : 'upcoming'}`}
                                        sx={{
                                            position: 'absolute',
                                            left: '-30px',
                                            top: '25px',
                                            width: '60px',
                                            height: '4px',
                                            background: idx <= currentStationIndex
                                                ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                                                : 'linear-gradient(90deg, rgba(148, 163, 184, 0.3) 0%, rgba(100, 116, 139, 0.3) 100%)',
                                            zIndex: 1,
                                            borderRadius: '2px',
                                            boxShadow: idx <= currentStationIndex ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
                                        }}
                                    />
                                )}

                                {/* Station Circle */}
                                <Box className={`timeline-circle ${status}`}>
                                    {status === 'completed' ? '✓' :
                                        status === 'current' ? <TrainIcon sx={{ fontSize: 24 }} /> :
                                            station.sno || idx + 1}
                                </Box>

                                {/* Station Info */}
                                <Box className="station-info">
                                    <Typography className="station-name">
                                        {station.name}
                                    </Typography>
                                    <Typography className="station-code">
                                        {station.code}
                                    </Typography>
                                    {status === 'current' && (
                                        <Chip
                                            label="Current"
                                            size="small"
                                            color="primary"
                                            className="current-badge"
                                            sx={{ mt: 0.5 }}
                                        />
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* Legend */}
            <Box className="timeline-legend">
                <Box className="legend-item">
                    <CheckCircleIcon sx={{ fontSize: 16, color: '#10b981' }} />
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Completed</Typography>
                </Box>
                <Box className="legend-item">
                    <TrainIcon sx={{ fontSize: 16, color: '#3b82f6' }} />
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Current</Typography>
                </Box>
                <Box className="legend-item">
                    <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Upcoming</Typography>
                </Box>
            </Box>
        </Paper>
    );
}

export default JourneyTimeline;

