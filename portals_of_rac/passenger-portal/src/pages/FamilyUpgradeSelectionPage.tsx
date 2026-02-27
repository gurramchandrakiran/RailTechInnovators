import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/pages/FamilyUpgradeSelectionPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface Passenger {
    id: string;
    pnr: string;
    name: string;
    age: number;
    gender: string;
    racStatus: number | null;  // null for CNF passengers
    pnrStatus: 'RAC' | 'CNF';  // Current status
    isSelectable: boolean;  // true for RAC, false for CNF
    coach: string;
    berth: string;
    from: string;
    to: string;
    passengerStatus: string;
    boarded: boolean;
}

interface VacantSeat {
    berth: string;
    coach: string;
    berthNo: string;
    type: string;
    class: string;
    from: string;
    to: string;
}

const FamilyUpgradeSelectionPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [pnr, setPnr] = useState<string>(searchParams.get('pnr') || '');
    const [passengers, setPassengers] = useState<Passenger[]>([]);
    const [vacantSeats, setVacantSeats] = useState<VacantSeat[]>([]);
    const [selectedPassengers, setSelectedPassengers] = useState<Set<string>>(new Set());
    const [timeRemaining, setTimeRemaining] = useState<number>(600); // 10 minutes in seconds
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpired, setIsExpired] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch group eligibility data
    useEffect(() => {
        const fetchEligibilityData = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/reallocation/eligible-groups`);

                if (response.data.success) {
                    const groupData = response.data.data.eligibleGroups.find(
                        (group: any) => group.pnr === pnr
                    );

                    if (groupData) {
                        setPassengers(groupData.passengers);
                        setVacantSeats(response.data.data.vacantSeats || []);
                    } else {
                        setError('Your booking is not currently eligible for upgrade');
                    }
                }
                setLoading(false);
            } catch (err: any) {
                console.error('Error fetching eligibility data:', err);
                setError(err.response?.data?.message || 'Failed to load upgrade information');
                setLoading(false);
            }
        };

        if (pnr) {
            fetchEligibilityData();
        } else {
            setError('Invalid PNR');
            setLoading(false);
        }
    }, [pnr]);

    // Countdown timer
    useEffect(() => {
        if (timeRemaining <= 0) {
            setIsExpired(true);
            return;
        }

        const timer = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    setIsExpired(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeRemaining]);

    // Auto-select all RAC passengers if group size <= vacant seats
    useEffect(() => {
        if (passengers.length > 0 && vacantSeats.length > 0) {
            const racPassengers = passengers.filter(p => p.isSelectable);
            if (racPassengers.length <= vacantSeats.length) {
                const allRACIds = new Set(racPassengers.map(p => p.id));
                setSelectedPassengers(allRACIds);
            }
        }
    }, [passengers, vacantSeats]);

    const togglePassenger = (passengerId: string) => {
        if (isExpired) return;

        // Check if passenger is selectable (RAC only)
        const passenger = passengers.find(p => p.id === passengerId);
        if (!passenger || !passenger.isSelectable) return;

        const newSelection = new Set(selectedPassengers);
        if (newSelection.has(passengerId)) {
            newSelection.delete(passengerId);
        } else {
            if (newSelection.size < vacantSeats.length) {
                newSelection.add(passengerId);
            }
        }
        setSelectedPassengers(newSelection);
    };

    const handleSmartSuggest = () => {
        if (isExpired) return;

        // Filter to only RAC passengers
        const racPassengers = passengers.filter(p => p.isSelectable);

        // Priority: Children < 12 > Elderly > 60 > RAC order
        const sorted = [...racPassengers].sort((a, b) => {
            const aChild = a.age < 12;
            const bChild = b.age < 12;
            const aElderly = a.age > 60;
            const bElderly = b.age > 60;

            if (aChild && !bChild) return -1;
            if (!aChild && bChild) return 1;
            if (aElderly && !bElderly) return -1;
            if (!aElderly && bElderly) return 1;

            return (a.racStatus || 999) - (b.racStatus || 999);
        });

        const suggested = new Set(sorted.slice(0, vacantSeats.length).map(p => p.id));
        setSelectedPassengers(suggested);
    };

    const handleDeclineAll = async () => {
        if (!window.confirm('Are you sure you want to decline the upgrade? Your family will remain in the RAC queue and will NOT receive future group upgrade offers.')) {
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_BASE_URL}/reallocation/reject-group-upgrade`,
                { pnr, reason: 'User declined offer' },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert('✓ Upgrade offer declined. You will not receive future group upgrade offers for this booking.');
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Error declining offer:', err);
            alert(err.response?.data?.message || 'Failed to decline offer. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirm = async () => {
        if (selectedPassengers.size === 0) {
            alert('Please select at least one passenger to upgrade');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${API_BASE_URL}/reallocation/select-passengers`,
                {
                    pnr,
                    selectedPassengerIds: Array.from(selectedPassengers),
                    requestedBy: 'passenger'
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (response.data.success) {
                alert(`✅ Successfully upgraded ${response.data.data.totalUpgraded} passenger(s)!`);
                navigate('/dashboard');
            }
        } catch (err: any) {
            console.error('Error confirming selection:', err);

            if (err.response?.status === 409) {
                alert('⚠️ These passengers have already been upgraded by the TTE.');
                navigate('/dashboard');
            } else {
                alert(err.response?.data?.message || 'Failed to confirm upgrade');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="family-upgrade-page">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading upgrade information...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="family-upgrade-page">
                <div className="error-container">
                    <h2>❌ {error}</h2>
                    <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (isExpired) {
        return (
            <div className="family-upgrade-page">
                <div className="expired-container">
                    <h1>⏰ Time Expired</h1>
                    <p>The upgrade selection window has closed.</p>
                    <p>The TTE will now handle the upgrade decision.</p>
                    <p>Your family remains in the RAC queue for the next opportunity.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const canAddMore = selectedPassengers.size < vacantSeats.length;
    const selectionComplete = selectedPassengers.size === vacantSeats.length;

    return (
        <div className="family-upgrade-page">
            <div className="upgrade-container">
                <div className="header">
                    <h1>🎉 Your Family is Eligible for Upgrade!</h1>
                    <div className={`timer ${timeRemaining < 60 ? 'urgent' : ''}`}>
                        ⏱️ {formatTime(timeRemaining)}
                    </div>
                </div>

                <div className="info-section">
                    <p className="good-news">Good news! {vacantSeats.length} confirmed seat{vacantSeats.length > 1 ? 's' : ''} became available.</p>

                    <div className="booking-info">
                        <div className="info-item">
                            <span className="label">Your Booking:</span>
                            <span className="value">{pnr}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Total Passengers:</span>
                            <span className="value">{passengers.length}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Available Seats:</span>
                            <span className="value">{vacantSeats.length}</span>
                        </div>
                    </div>

                    {passengers.length > vacantSeats.length && (
                        <div className="selection-prompt">
                            Please select which {vacantSeats.length} passenger{vacantSeats.length > 1 ? 's' : ''} to upgrade:
                        </div>
                    )}
                </div>

                <div className="passengers-list">
                    {passengers.map((passenger) => {
                        const isSelected = selectedPassengers.has(passenger.id);
                        const isCNF = !passenger.isSelectable;  // CNF passengers not selectable
                        const isDisabled = isCNF || (!isSelected && !canAddMore);

                        return (
                            <div
                                key={passenger.id}
                                className={`passenger-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''} ${isCNF ? 'already-confirmed' : ''}`}
                                onClick={() => !isDisabled && togglePassenger(passenger.id)}
                            >
                                <div className="checkbox-wrapper">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => togglePassenger(passenger.id)}
                                        disabled={isDisabled}
                                    />
                                </div>
                                <div className="passenger-info">
                                    <div className="passenger-name">
                                        {passenger.name}
                                        <span className="age-gender">({passenger.age}{passenger.gender})</span>
                                        {passenger.age < 12 && <span className="tag child">Child</span>}
                                        {passenger.age > 60 && <span className="tag elderly">Elderly</span>}
                                        {isCNF && <span className="tag cnf">✓ Already Confirmed</span>}
                                    </div>
                                    <div className="passenger-details">
                                        {isCNF ? (
                                            <>CNF | {passenger.coach}-{passenger.berth} (Already upgraded)</>
                                        ) : (
                                            <>Current: RAC-{passenger.racStatus} | {passenger.coach}-{passenger.berth}</>
                                        )}
                                    </div>
                                    {isSelected && !isCNF && vacantSeats[Array.from(selectedPassengers).indexOf(passenger.id)] && (
                                        <div className="upgrade-info">
                                            → Will get: <strong>{vacantSeats[Array.from(selectedPassengers).indexOf(passenger.id)]?.berth}</strong> ({vacantSeats[Array.from(selectedPassengers).indexOf(passenger.id)]?.type})
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {passengers.length > vacantSeats.length && (
                    <div className="suggestion-box">
                        💡 <strong>Suggestion:</strong> Consider upgrading children and elderly passengers first for comfort
                    </div>
                )}

                <div className="selection-summary">
                    <span className={`count ${selectionComplete ? 'complete' : ''}`}>
                        Selected: {selectedPassengers.size} / {vacantSeats.length}
                    </span>
                    {selectionComplete && <span className="check">✅</span>}
                </div>

                <div className="actions">
                    <button
                        className="btn btn-decline"
                        onClick={handleDeclineAll}
                        disabled={isSubmitting}
                    >
                        Decline All
                    </button>
                    {passengers.length > vacantSeats.length && (
                        <button
                            className="btn btn-suggest"
                            onClick={handleSmartSuggest}
                            disabled={isSubmitting}
                        >
                            💡 Smart Suggest
                        </button>
                    )}
                    <button
                        className="btn btn-confirm"
                        onClick={handleConfirm}
                        disabled={selectedPassengers.size === 0 || isSubmitting}
                    >
                        {isSubmitting ? 'Confirming...' : `Confirm Selection (${selectedPassengers.size})`} →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FamilyUpgradeSelectionPage;
