// tte-portal/src/pages/VisualizationPage.tsx
// Train Journey Visualization - Station Schedule Table (DYNAMIC - loads from current train)
import React, { useState, useEffect } from 'react';
import { tteAPI } from '../api';
import '../styles/pages/VisualizationPage.css';

interface Station {
    code: string;
    name: string;
    sno: number;
    zone?: string;
    division?: string;
    arrival: string;
    departure: string;
    halt?: number;
    distance: number;
    day: number;
    platform?: string;
    remarks?: string;
}

function VisualizationPage(): React.ReactElement {
    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        loadStationSchedule();
    }, []);

    // Dynamic data - loads from currently initialized train
    const loadStationSchedule = async (): Promise<void> => {
        try {
            setLoading(true);
            const response = await tteAPI.getStationSchedule();

            if (response.success) {
                setStations(response.data.stations || []);
            }
        } catch (error) {
            console.error('Error loading station schedule:', error);
            setStations([]);
        } finally {
            setLoading(false);
        }
    };

    const calculateJourneyTime = (): number => {
        if (!stations || stations.length < 2) return 0;
        const first = stations[0];
        const last = stations[stations.length - 1];
        const firstHour = parseInt(first.departure?.split(':')[0] || '0');
        const lastHour = parseInt(last.arrival?.split(':')[0] || '0');
        const hours = (last.day - 1) * 24 + lastHour - firstHour;
        return hours > 0 ? hours : 0;
    };

    const getTotalDistance = (): number => {
        if (!stations || stations.length === 0) return 0;
        return stations[stations.length - 1]?.distance || 0;
    };

    if (loading) {
        return (
            <div className="visualization-page">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading station schedule...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="visualization-page">
            <h2 className="page-title">📊 Train Journey Visualization</h2>

            {/* Station Schedule Table */}
            <div className="station-schedule-section">
                <div className="section-header">
                    <h3>📍 Train Station Schedule</h3>
                    <div className="schedule-stats">
                        <span className="stat-badge">🚉 {stations.length} Stations</span>
                        <span className="stat-badge">📏 {getTotalDistance()} km</span>
                        <span className="stat-badge">⏱️ {calculateJourneyTime()} hrs</span>
                    </div>
                </div>

                <div className="table-container">
                    <table className="station-schedule-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>CODE</th>
                                <th>STATION NAME</th>
                                <th>ZONE</th>
                                <th>DIVISION</th>
                                <th>ARRIVAL</th>
                                <th>DEPARTURE</th>
                                <th>HALT</th>
                                <th>DISTANCE (KM)</th>
                                <th>DAY</th>
                                <th>PLATFORM</th>
                                <th>REMARKS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stations.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="no-data">
                                        No stations loaded.{' '}
                                        <button onClick={loadStationSchedule} className="retry-btn">
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : (
                                stations.map((station, idx) => (
                                    <tr
                                        key={station.code}
                                        className={
                                            idx === 0 ? 'first-station' :
                                                idx === stations.length - 1 ? 'last-station' : ''
                                        }
                                    >
                                        <td className="td-center">{station.sno}</td>
                                        <td className="td-code">{station.code}</td>
                                        <td className="td-name">
                                            {idx === 0 && <span className="station-badge origin">ORIGIN</span>}
                                            {idx === stations.length - 1 && <span className="station-badge destination">DESTINATION</span>}
                                            {station.name}
                                        </td>
                                        <td className="td-center">{station.zone || 'SCR'}</td>
                                        <td className="td-center">{station.division || '-'}</td>
                                        <td className="td-center">{station.arrival === '-' ? 'First' : station.arrival}</td>
                                        <td className="td-center">{station.departure === '-' ? 'Last' : station.departure}</td>
                                        <td className="td-right">{station.halt || 0} min</td>
                                        <td className="td-right">{station.distance}</td>
                                        <td className="td-center">{station.day}</td>
                                        <td className="td-center">{station.platform || '-'}</td>
                                        <td className="td-center">{station.remarks || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default VisualizationPage;

