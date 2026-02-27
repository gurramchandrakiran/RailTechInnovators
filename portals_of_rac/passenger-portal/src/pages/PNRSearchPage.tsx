// passenger-portal/src/pages/PNRSearchPage.tsx
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { passengerAPI } from '../api';
import axios from 'axios';
import '../styles/pages/PNRSearchPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Passenger {
    pnr: string;
    name: string;
    coach?: string;
    seatNo?: string;
    berthType?: string;
    class?: string;
    trainName?: string;
    trainNo?: string;
    boardingStation?: string;
    boardingStationFull?: string;
    destinationStation?: string;
    destinationStationFull?: string;
}

interface Station {
    code: string;
    name: string;
    arrivalTime?: string;
}

interface VerifyData {
    irctcId: string;
    pnr: string;
}

function PNRSearchPage(): React.ReactElement {
    const [pnr, setPnr] = useState<string>('');
    const [passenger, setPassenger] = useState<Passenger | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);





    const handleSearch = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        if (!pnr.trim()) {
            setError('Please enter a PNR number');
            return;
        }

        setLoading(true);
        setError(null);
        setPassenger(null);

        try {
            const response = await passengerAPI.getPNRDetails(pnr.trim());

            if (response.success) {
                setPassenger(response.data);
            } else {
                setError(response.message || 'PNR not found');
            }
        } catch (err: any) {
            console.error('Search error:', err);
            setError(err.response?.data?.message || 'Failed to fetch PNR details');
        } finally {
            setLoading(false);
        }
    };





    return (
        <div className="pnr-search-page">
            <div className="page-header">
                <h2>🔍 PNR Status Search</h2>
            </div>

            <div className="search-container">
                <form className="search-form" onSubmit={handleSearch}>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Enter 10-digit PNR Number"
                        value={pnr}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPnr(e.target.value)}
                        maxLength={10}
                    />
                    <button
                        type="submit"
                        className="search-btn"
                        disabled={loading}
                    >
                        {loading ? '⏳ Searching...' : '🔍 Search'}
                    </button>
                </form>
            </div>

            {error && (
                <div className="error-message">
                    ❌ {error}
                </div>
            )}

            {loading && (
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Searching for PNR...</p>
                </div>
            )}

            {passenger && (
                <>
                    <div className="passenger-details-card">
                        <div className="card-header">
                            <h3>🎫 Passenger Details</h3>
                        </div>
                        <div className="card-body">
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <span className="detail-label">PNR Number</span>
                                    <span className="detail-value">{passenger.pnr}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Passenger Name</span>
                                    <span className="detail-value">{passenger.name}</span>
                                </div>

                                <div className="detail-item">
                                    <span className="detail-label">Coach / Berth</span>
                                    <span className="detail-value">
                                        {passenger.coach || '-'} / {passenger.seatNo || '-'}
                                    </span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Berth Type</span>
                                    <span className="detail-value">{passenger.berthType || '-'}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Class</span>
                                    <span className="detail-value">{passenger.class || 'Sleeper'}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Train</span>
                                    <span className="detail-value">
                                        {passenger.trainName} ({passenger.trainNo})
                                    </span>
                                </div>
                            </div>

                            <div className="journey-section">
                                <div className="journey-path">
                                    <div className="station-info">
                                        <div className="station-code">{passenger.boardingStation || '-'}</div>
                                        <div className="station-name">{passenger.boardingStationFull || 'Boarding Station'}</div>
                                    </div>
                                    <div className="journey-arrow">→</div>
                                    <div className="station-info">
                                        <div className="station-code">{passenger.destinationStation || '-'}</div>
                                        <div className="station-name">{passenger.destinationStationFull || 'Destination'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {!passenger && !loading && !error && (
                <div className="empty-state">
                    <div className="icon">🎫</div>
                    <h3>Enter PNR to Check Status</h3>
                    <p>Get complete passenger and journey details</p>
                </div>
            )}






        </div>
    );
}

export default PNRSearchPage;
