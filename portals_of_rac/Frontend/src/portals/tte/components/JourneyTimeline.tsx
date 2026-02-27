// tte-portal/src/components/JourneyTimeline.tsx
// Train Simulation - Journey Progress component (read-only, synced with admin-portal)
import React, { useRef, useEffect } from 'react';
import '../styles/components/JourneyTimeline.css';

interface Station {
    code?: string;
    name: string;
    sno?: number;
}

interface JourneyTimelineProps {
    stations: Station[];
    currentStationIndex: number;
}

function JourneyTimeline({ stations, currentStationIndex }: JourneyTimelineProps): React.ReactElement {
    const timelineRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to current station
    useEffect(() => {
        if (timelineRef.current && currentStationIndex >= 0) {
            const currentStation = timelineRef.current.querySelector(`.station-item.current`);
            if (currentStation) {
                currentStation.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [currentStationIndex]);

    const getStationStatus = (index: number): 'completed' | 'current' | 'upcoming' => {
        if (index < currentStationIndex) return 'completed';
        if (index === currentStationIndex) return 'current';
        return 'upcoming';
    };

    if (!stations || stations.length === 0) {
        return (
            <div className="journey-timeline-empty">
                <p>Journey information not available</p>
            </div>
        );
    }

    return (
        <div className="journey-timeline-container">
            {/* Header */}
            <div className="timeline-header">
                <h2> Train Simulation - Journey Progress</h2>
                <span className="station-progress-badge">
                    {currentStationIndex + 1}/{stations.length} Stations
                </span>
            </div>

            {/* Timeline Scroll */}
            <div className="timeline-scroll-wrapper" ref={timelineRef}>
                <div className="timeline-track">
                    {stations.map((station, idx) => {
                        const status = getStationStatus(idx);

                        return (
                            <div key={station.code || `station-${idx}`} className={`station-item ${status}`}>
                                {/* Connecting Line (before station, except first) */}
                                {idx > 0 && (
                                    <div className={`connecting-line-behind ${idx <= currentStationIndex ? 'completed' : 'upcoming'}`} />
                                )}

                                {/* Station Circle */}
                                <div className={`timeline-circle ${status}`}>
                                    {status === 'completed' ? '' :
                                        status === 'current' ? '' :
                                            station.sno || idx + 1}
                                </div>

                                {/* Station Info */}
                                <div className="station-info">
                                    <div className="station-name">{station.name}</div>
                                    <div className="station-code">{station.code}</div>
                                    {status === 'current' && (
                                        <span className="current-badge">Current</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="timeline-legend">
                <div className="legend-item">
                    <span className="legend-dot completed"></span>
                    <span>Completed</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot current"></span>
                    <span>Current</span>
                </div>
                <div className="legend-item">
                    <span className="legend-dot upcoming"></span>
                    <span>Upcoming</span>
                </div>
            </div>
        </div>
    );
}

export default JourneyTimeline;
