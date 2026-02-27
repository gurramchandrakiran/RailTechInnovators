// admin-portal/src/components/TrainVisualization.tsx

import React, { useState } from 'react';
import '../styles/components/TrainVisualization.css';

interface Passenger {
    pnr?: string;
    name?: string;
    age?: number;
    gender?: string;
    pnrStatus?: string;
    from?: string;
    to?: string;
    fromIdx?: number;
    boarded?: boolean;
    noShow?: boolean;
}

interface Berth {
    fullBerthNo: string;
    berthNo: number;
    type: string;
    status: string;
    passengers?: Passenger[];
}

interface Coach {
    coachNo: string;
    class: string;
    berths: Berth[];
    capacity: number;
}

interface Station {
    code: string;
    name: string;
}

interface TrainVisualizationProps {
    coaches: Coach[];
    currentStationIdx: number;
    stations: Station[];
}

interface BerthDetailsModalProps {
    berth: Berth;
    onClose: () => void;
    currentStationIdx: number;
    stations: Station[];
}

function TrainVisualization({ coaches, currentStationIdx, stations }: TrainVisualizationProps): React.ReactElement | null {
    const [selectedBerth, setSelectedBerth] = useState<Berth | null>(null);

    if (!coaches || coaches.length === 0) {
        return null;
    }

    const getBerthStatusClass = (berth: Berth): string => {
        if (berth.status === 'VACANT') return 'vacant';
        if (berth.status === 'SHARED') return 'shared';
        return 'occupied';
    };

    return (
        <div className="train-visualization">
            <h3>🚂 Train Coaches & Berths</h3>

            <div className="legend">
                <span className="legend-item">
                    <span className="color-box vacant"></span> Vacant
                </span>
                <span className="legend-item">
                    <span className="color-box occupied"></span> Occupied
                </span>
                <span className="legend-item">
                    <span className="color-box shared"></span> Shared (RAC)
                </span>
            </div>

            <div className="coaches-grid">
                {coaches.map(coach => (
                    <div key={coach.coachNo} className="coach-card">
                        <div className="coach-header">
                            <h4>{coach.coachNo}</h4>
                            <span className="coach-class">{coach.class}</span>
                        </div>

                        <div className="berths-grid">
                            {(coach.berths || []).map(berth => (
                                <div
                                    key={berth.fullBerthNo}
                                    className={`berth ${getBerthStatusClass(berth)}`}
                                    onClick={() => setSelectedBerth(berth)}
                                    title={`${berth.fullBerthNo}\n${berth.type}\n${berth.status}\n${(berth.passengers?.length || 0)} passenger(s)`}
                                >
                                    {berth.berthNo}
                                </div>
                            ))}
                        </div>

                        <div className="coach-summary">
                            Vacant: {(coach.berths || []).filter(b => b.status === 'VACANT').length} / {coach.capacity}
                        </div>
                    </div>
                ))}
            </div>

            {selectedBerth && (
                <BerthDetailsModal
                    berth={selectedBerth}
                    onClose={() => setSelectedBerth(null)}
                    currentStationIdx={currentStationIdx}
                    stations={stations}
                />
            )}
        </div>
    );
}

function BerthDetailsModal({ berth, onClose, currentStationIdx, stations }: BerthDetailsModalProps): React.ReactElement {
    const passengers = berth.passengers || [];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3> Berth Details: {berth.fullBerthNo}</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <p><strong>Type:</strong> {berth.type}</p>
                    <p><strong>Status:</strong> <span className={`status-tag ${berth.status.toLowerCase()}`}>{berth.status}</span></p>
                    <p><strong>Passengers:</strong> {passengers.length}</p>

                    {passengers.length > 0 && (
                        <div className="passengers-list">
                            <h4>Passenger Details:</h4>
                            {passengers.map((p, idx) => (
                                <div key={`${p.pnr || idx}-${idx}`} className="passenger-card">
                                    <div className="passenger-info">
                                        <strong>{p.name || 'Unknown'}</strong> ({p.age || '-'} / {p.gender || '-'})
                                        <span className={`pnr-badge ${(p.pnrStatus || '').toLowerCase().replace(' ', '-')}`}>
                                            {p.pnrStatus || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="journey-info">
                                         {p.from || '-'} → {p.to || '-'}
                                    </div>
                                    <div className="passenger-status">
                                        {p.noShow ? (
                                            <span className="status-icon no-show">❌ No-Show</span>
                                        ) : p.boarded ? (
                                            <span className="status-icon boarded">✅ Boarded</span>
                                        ) : (p.fromIdx || 0) <= currentStationIdx ? (
                                            <span className="status-icon missed">⚠️ Missed Boarding</span>
                                        ) : (
                                            <span className="status-icon waiting">⏳ Not Yet Boarded</span>
                                        )}
                                    </div>
                                    <div className="passenger-meta">
                                        PNR: <code>{p.pnr || 'N/A'}</code>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {berth.status === 'VACANT' && (
                        <div className="vacant-message">
                            <p> This berth is currently vacant and available for allocation</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TrainVisualization;

