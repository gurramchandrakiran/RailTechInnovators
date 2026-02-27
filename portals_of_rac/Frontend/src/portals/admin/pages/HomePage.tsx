// admin-portal/src/pages/HomePage.tsx

import React, { useState, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/pages/HomePage.css';

interface Station {
    code: string;
    name: string;
    sno?: number;
}

interface Stats {
    totalPassengers?: number;
    cnfPassengers?: number;
    racPassengers?: number;
    currentOnboard?: number;
    vacantBerths?: number;
    occupiedBerths?: number;
    totalDeboarded?: number;
}

interface TrainData {
    trainNo?: string;
    trainName?: string;
    journeyDate?: string;
    stations?: Station[];
    currentStationIdx?: number;
    stats?: Stats;
}

type PageType = 'config' | 'home' | 'rac-queue' | 'coaches' | 'passengers' | 'reallocation' | 'visualization' | 'add-passenger' | 'phase1';

interface HomePageProps {
    trainData: TrainData | null;
    journeyStarted: boolean;
    isJourneyComplete: boolean;
    loading: boolean;
    onStartJourney: () => void;
    onNextStation: () => void;
    onReset: () => void;
    onMarkNoShow: (pnr: string) => void;
    onNavigate: (page: PageType) => void;
    timerSeconds: number;
    timerActive: boolean;
}

function HomePage({
    trainData,
    journeyStarted,
    isJourneyComplete,
    loading,
    onStartJourney,
    onNextStation,
    onReset,
    onMarkNoShow,
    onNavigate,
    timerSeconds,
    timerActive
}: HomePageProps): React.ReactElement | null {
    const navigate = useNavigate();
    const [pnrInput, setPnrInput] = useState<string>('');

    if (!trainData) return null;

    const handleMarkNoShow = (): void => {
        if (!pnrInput.trim()) {
            alert("Please enter a PNR");
            return;
        }
        onMarkNoShow(pnrInput);
        setPnrInput('');
    };

    // Format timer seconds to MM:SS
    const formatTimer = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const currentStationIdx = trainData.currentStationIdx || 0;
    const stations = trainData.stations || [];
    const isLastStation = stations.length > 0 && currentStationIdx >= stations.length - 1;

    return (
        <div className="home-page">
            <div className="train-config-banner">
                <button className="exit-landing-btn" onClick={() => navigate('/admin')} title="Exit to Landing Page">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="config-item">
                    <span className="config-label">Train:</span>
                    <span className="config-value">{trainData.trainNo} - {trainData.trainName}</span>
                </div>
                <div className="config-item">
                    <span className="config-label">Journey Date:</span>
                    <span className="config-value">{trainData.journeyDate}</span>
                </div>
                <div className="config-item">
                    <span className="config-label">Route:</span>
                    <span className="config-value">
                        {stations.length > 0 ? `${stations[0]?.name} → ${stations[stations.length - 1]?.name}` : 'Loading route...'}
                    </span>
                </div>
            </div>

            <div className="journey-section">
                <h2> Train Simulation - Journey Progress</h2>

                <div className="timeline-container">
                    <div className="timeline-scroll">
                        {stations.map((station, idx) => (
                            <div key={station.code} className="timeline-station">
                                {idx > 0 && (
                                    <div className={`timeline-line ${idx <= currentStationIdx ? 'completed' : 'upcoming'
                                        }`}></div>
                                )}

                                <div className={`timeline-circle ${idx < currentStationIdx ? 'completed' :
                                    idx === currentStationIdx ? 'current' : 'upcoming'
                                    }`}>
                                    {idx < currentStationIdx ? '' : station.sno}
                                </div>

                                <div className="timeline-info">
                                    <div className="timeline-station-name">{station.name}</div>
                                    <div className="timeline-station-code">{station.code}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isJourneyComplete && (
                <div className="journey-complete-banner">
                    <span>🏁</span>
                    <div>
                        <strong>Journey Complete</strong>
                        <p>Train has reached its final destination. All operations are locked.</p>
                    </div>
                </div>
            )}

            <button
                onClick={onStartJourney}
                disabled={loading || journeyStarted || isJourneyComplete}
                className={`btn-start-journey ${journeyStarted ? 'journey-started' : ''} ${isJourneyComplete ? 'journey-complete' : ''}`}
            >
                {loading ? 'Starting...' : isJourneyComplete ? '🏁 Journey Complete' : journeyStarted ? '✅ Journey Started' : '🚀 Start Journey'}
            </button>

            <div className="main-actions-grid">
                <div className="action-card-compact simulation-card">
                    <div className="card-header">
                        <h4>Train Controls</h4>
                    </div>
                    <button
                        onClick={onNextStation}
                        disabled={loading || !journeyStarted || isLastStation}
                        className="btn-compact primary"
                    >
                        {loading ? 'Processing...' : isLastStation ? 'Complete' : 'Next Station'}
                    </button>
                    <button
                        onClick={onReset}
                        disabled={loading}
                        className="btn-compact secondary"
                    >
                        Reset
                    </button>
                </div>

                {/* Timer Card */}
                <div className="action-card-compact timer-card">
                    <div className="card-header">
                        <h4>⏱ Auto Timer</h4>
                    </div>
                    {!journeyStarted && (
                        <div className="timer-display paused">
                            <span className="timer-label">Waiting for Journey Start</span>
                            <span className="timer-value">--:--</span>
                        </div>
                    )}
                    {journeyStarted && !isLastStation && (
                        <div className={`timer-display ${timerActive ? 'active' : 'paused'} ${timerSeconds <= 30 && timerActive ? 'warning' : ''}`}>
                            <span className="timer-label">Next Station In:</span>
                            <span className="timer-value">{formatTimer(timerSeconds)}</span>
                        </div>
                    )}
                    {journeyStarted && isLastStation && (
                        <div className="timer-display complete">
                            <span className="timer-label">✅ Journey Complete!</span>
                        </div>
                    )}
                </div>

                <div className="action-card-compact phase1-card" onClick={() => onNavigate('phase1')}>
                    <div className="card-header">
                        <h4>🎯 Current Station Matching</h4>
                    </div>
                    <p className="card-description">Phase 1: HashMap-based reallocation</p>
                    <div className="card-arrow">→</div>
                </div>
            </div>

            <div className="noshow-section">
                <h3>❌ Mark Passenger as No-Show</h3>
                <div className="noshow-input-row">
                    <input
                        type="text"
                        placeholder="Enter 10-digit PNR"
                        value={pnrInput}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPnrInput(e.target.value)}
                        maxLength={10}
                        className="input-pnr"
                    />
                    <button
                        onClick={handleMarkNoShow}
                        disabled={loading || !pnrInput.trim()}
                        className="btn-noshow"
                    >
                        Mark No-Show
                    </button>
                </div>
            </div>

            <div className="action-cards-section">
                <h3 className="section-title">📊 Quick Statistics & Navigation</h3>

                <div className="stats-action-grid">
                    <div className="stat-box">
                        <div className="stat-label">Total Passengers</div>
                        <div className="stat-value">{journeyStarted && trainData?.stats ? trainData.stats.totalPassengers : '-'}</div>
                    </div>

                    <div className="stat-box">
                        <div className="stat-label">Confirmed (CNF)</div>
                        <div className="stat-value">{journeyStarted && trainData?.stats ? trainData.stats.cnfPassengers : '-'}</div>
                    </div>

                    <div
                        className="stat-box clickable"
                        onClick={() => onNavigate('rac-queue')}
                    >
                        <div className="stat-label">RAC Queue</div>
                        <div className="stat-value">{journeyStarted && trainData?.stats ? trainData.stats.racPassengers : '-'}</div>
                    </div>

                    <div className="stat-box">
                        <div className="stat-label">Currently Onboard</div>
                        <div className="stat-value">{journeyStarted && trainData?.stats ? trainData.stats.currentOnboard : '-'}</div>
                    </div>

                    <div className="stat-box">
                        <div className="stat-label">Vacant Berths</div>
                        <div className="stat-value">{journeyStarted && trainData?.stats ? trainData.stats.vacantBerths : '-'}</div>
                    </div>

                    <div className="stat-box">
                        <div className="stat-label">Occupied Berths</div>
                        <div className="stat-value">{journeyStarted && trainData?.stats ? trainData.stats.occupiedBerths : '-'}</div>
                    </div>

                    <div className="stat-box">
                        <div className="stat-label">Total Deboarded</div>
                        <div className="stat-value">{journeyStarted && trainData?.stats ? trainData.stats.totalDeboarded : '-'}</div>
                    </div>

                    <div className="nav-card add-passenger-nav-card" onClick={() => onNavigate('add-passenger')}>
                        <span className="nav-icon"></span>
                        <span className="nav-text">Add Passenger</span>
                    </div>

                    <div
                        className="nav-card"
                        onClick={() => onNavigate('coaches')}
                    >
                        <span className="nav-icon">🚂</span>
                        <span className="nav-text">Coaches & Berths</span>
                    </div>

                    <div
                        className="nav-card"
                        onClick={() => onNavigate('passengers')}
                    >
                        <span className="nav-icon"></span>
                        <span className="nav-text">Passenger List & Vacant Positions </span>
                    </div>

                    <div
                        className="nav-card"
                        onClick={() => onNavigate('visualization')}
                    >
                        <span className="nav-icon">📊</span>
                        <span className="nav-text">Segment View</span>
                    </div>

                    <div className="nav-card" onClick={() => onNavigate('config')}>
                        <span className="nav-icon">⚙️</span>
                        <span className="nav-text">Update Config</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HomePage;

