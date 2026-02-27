// passenger-portal/src/pages/ChangeBoardingStationPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../styles/pages/ReportDeboardingPage.css'; // Reuse same styles

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Passenger {
    Name: string;
    PNR_Number: string;
    IRCTC_ID: string;
    Coach: string;
    Berth_Number: string;
    Boarding_Station: string;
    Deboarding_Station: string;
    Email?: string;
    boardingStationChanged?: boolean;
}

interface Station {
    code: string;
    name: string;
}

const ChangeBoardingStationPage: React.FC = () => {
    const navigate = useNavigate();

    // Step tracking
    const [step, setStep] = useState<number>(1);

    // Step 1: PNR input
    const [pnr, setPnr] = useState<string>('');
    const [passengers, setPassengers] = useState<Passenger[]>([]);

    // Step 2: Passenger selection
    const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null);

    // Step 3: OTP verification
    const [otp, setOtp] = useState<string>('');
    const [maskedEmail, setMaskedEmail] = useState<string>('');

    // Step 4: Station selection
    const [availableStations, setAvailableStations] = useState<Station[]>([]);
    const [selectedStation, setSelectedStation] = useState<string>('');

    // Loading states
    const [loading, setLoading] = useState<boolean>(false);
    const [processing, setProcessing] = useState<boolean>(false);

    // Step 1: Fetch passengers by PNR
    const fetchPassengers = async (): Promise<void> => {
        if (!pnr || pnr.length < 10) {
            toast.error('Please enter a valid 10-digit PNR number');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/passengers/by-pnr/${pnr}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (data.success && data.data) {
                const passengerList = Array.isArray(data.data) ? data.data : [data.data];
                // Filter out passengers who already changed their boarding station
                const eligiblePassengers = passengerList.filter((p: Passenger) => !p.boardingStationChanged);

                if (eligiblePassengers.length === 0) {
                    toast.error('All passengers on this PNR have already changed their boarding station');
                    return;
                }

                setPassengers(eligiblePassengers);
                setStep(2);
            } else {
                toast.error(data.message || 'No passengers found for this PNR');
            }
        } catch (error) {
            toast.error('Error fetching passenger details');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Select passenger and send OTP
    const selectPassengerAndSendOTP = async (passenger: Passenger): Promise<void> => {
        setSelectedPassenger(passenger);
        setProcessing(true);

        try {
            const response = await fetch(`${API_URL}/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    irctcId: passenger.IRCTC_ID,
                    pnr: passenger.PNR_Number,
                    purpose: 'Change Boarding Station'
                })
            });
            const data = await response.json();

            if (data.success) {
                setMaskedEmail(data.maskedEmail || passenger.Email || 'your registered email');
                toast.success(`OTP sent to ${data.maskedEmail || 'your email'}`);
                setStep(3);
            } else {
                toast.error(data.message || 'Failed to send OTP');
            }
        } catch (error) {
            toast.error('Error sending OTP');
        } finally {
            setProcessing(false);
        }
    };

    // Step 3: Verify OTP and fetch available stations
    const verifyOTPAndFetchStations = async (): Promise<void> => {
        if (!otp || otp.length !== 6) {
            toast.error('Please enter the 6-digit OTP');
            return;
        }

        if (!selectedPassenger) return;

        setProcessing(true);
        try {
            // Verify OTP
            const otpResponse = await fetch(`${API_URL}/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    irctcId: selectedPassenger.IRCTC_ID,
                    pnr: selectedPassenger.PNR_Number,
                    otp
                })
            });
            const otpData = await otpResponse.json();

            if (!otpData.success) {
                toast.error(otpData.message || 'Invalid OTP');
                setProcessing(false);
                return;
            }

            // Fetch available stations
            const stationsResponse = await fetch(`${API_URL}/passenger/available-boarding-stations/${selectedPassenger.PNR_Number}`);
            const stationsData = await stationsResponse.json();

            if (stationsData.success) {
                if (stationsData.alreadyChanged) {
                    toast.error('Boarding station has already been changed once for this booking');
                    setStep(1);
                    return;
                }

                if (!stationsData.availableStations || stationsData.availableStations.length === 0) {
                    toast.error('No forward stations available for change');
                    setStep(1);
                    return;
                }

                setAvailableStations(stationsData.availableStations);
                setStep(4);
                toast.success('OTP verified! Select your new boarding station');
            } else {
                toast.error(stationsData.message || 'Failed to fetch available stations');
            }
        } catch (error) {
            toast.error('Error verifying OTP');
        } finally {
            setProcessing(false);
        }
    };

    // Step 4: Confirm station change
    const confirmStationChange = async (): Promise<void> => {
        if (!selectedStation || !selectedPassenger) {
            toast.error('Please select a station');
            return;
        }

        const station = availableStations.find(s => s.code === selectedStation);
        const confirmed = window.confirm(
            `⚠️ Confirm Boarding Station Change\n\n` +
            `Passenger: ${selectedPassenger.Name}\n` +
            `Current Station: ${selectedPassenger.Boarding_Station}\n` +
            `New Station: ${station?.name} (${station?.code})\n\n` +
            `This action can only be done ONCE. Continue?`
        );

        if (!confirmed) return;

        setProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/passenger/change-boarding-station`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    pnr: selectedPassenger.PNR_Number,
                    irctcId: selectedPassenger.IRCTC_ID,
                    newStationCode: selectedStation
                })
            });
            const data = await response.json();

            if (data.success) {
                toast.success(`✅ Boarding station changed to ${station?.name}!`);
                navigate('/');
            } else {
                toast.error(data.message || 'Failed to change boarding station');
            }
        } catch (error) {
            toast.error('Error changing boarding station');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="report-deboarding-page">
            <div className="deboarding-container">
                <div className="page-header">
                    <button className="back-btn" onClick={() => navigate('/')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1>🔄 Change Boarding Station</h1>
                        <p className="subtitle">Change to a forward station along your route (one-time only)</p>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="progress-steps">
                    <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                        <span className="step-number">1</span>
                        <span className="step-label">Enter PNR</span>
                    </div>
                    <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                        <span className="step-number">2</span>
                        <span className="step-label">Select Passenger</span>
                    </div>
                    <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
                        <span className="step-number">3</span>
                        <span className="step-label">Verify OTP</span>
                    </div>
                    <div className={`step ${step >= 4 ? 'active' : ''}`}>
                        <span className="step-number">4</span>
                        <span className="step-label">Select Station</span>
                    </div>
                </div>

                {/* Step 1: Enter PNR */}
                {step === 1 && (
                    <div className="step-content">
                        <h2>Step 1: Enter Your PNR Number</h2>
                        <div className="input-group">
                            <label>PNR Number</label>
                            <input
                                type="text"
                                value={pnr}
                                onChange={(e) => setPnr(e.target.value)}
                                placeholder="Enter 10-digit PNR"
                                maxLength={10}
                            />
                        </div>
                        <button
                            className="btn-primary"
                            onClick={fetchPassengers}
                            disabled={loading || pnr.length < 10}
                        >
                            {loading ? 'Fetching...' : 'Fetch Passengers'}
                        </button>
                    </div>
                )}

                {/* Step 2: Select Passenger */}
                {step === 2 && (
                    <div className="step-content">
                        <h2>Step 2: Select Passenger</h2>
                        <p className="hint">Select the passenger whose boarding station you want to change.</p>
                        <div className="passenger-list">
                            {passengers.map((p, idx) => (
                                <div
                                    key={idx}
                                    className={`passenger-card ${selectedPassenger?.Name === p.Name ? 'selected' : ''}`}
                                    onClick={() => !processing && selectPassengerAndSendOTP(p)}
                                    style={{ cursor: processing ? 'not-allowed' : 'pointer' }}
                                >
                                    <div className="passenger-info">
                                        <span className="passenger-name">{p.Name}</span>
                                        <span className="passenger-berth">{p.Coach}-{p.Berth_Number}</span>
                                    </div>
                                    <div className="passenger-route">
                                        🚉 {p.Boarding_Station} → {p.Deboarding_Station}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {processing && <p style={{ textAlign: 'center', color: '#3498db' }}>Sending OTP...</p>}
                        <button className="btn-secondary" onClick={() => setStep(1)}>
                            ← Back
                        </button>
                    </div>
                )}

                {/* Step 3: Verify OTP */}
                {step === 3 && (
                    <div className="step-content">
                        <h2>Step 3: Verify OTP</h2>
                        <p className="hint">
                            📧 OTP has been sent to {maskedEmail}
                        </p>
                        <div className="input-group">
                            <label>Enter 6-digit OTP</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="Enter OTP"
                                maxLength={6}
                            />
                        </div>
                        <button
                            className="btn-primary"
                            onClick={verifyOTPAndFetchStations}
                            disabled={processing || otp.length !== 6}
                        >
                            {processing ? 'Verifying...' : '✓ Verify OTP'}
                        </button>
                        <button className="btn-secondary" onClick={() => setStep(2)}>
                            ← Back
                        </button>
                    </div>
                )}

                {/* Step 4: Select Station */}
                {step === 4 && selectedPassenger && (
                    <div className="step-content">
                        <h2>Step 4: Select New Boarding Station</h2>
                        <div className="station-info">
                            <p><strong>Current Station:</strong> {selectedPassenger.Boarding_Station}</p>
                            <p><strong>Destination:</strong> {selectedPassenger.Deboarding_Station}</p>
                        </div>
                        <p className="hint">Select a station ahead of your current boarding point:</p>

                        <div className="passenger-list">
                            {availableStations.map((station) => (
                                <div
                                    key={station.code}
                                    className={`passenger-card ${selectedStation === station.code ? 'selected' : ''}`}
                                    onClick={() => setSelectedStation(station.code)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="passenger-info">
                                        <span className="passenger-name">{station.name}</span>
                                        <span className="passenger-berth">{station.code}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            className="btn-primary"
                            onClick={confirmStationChange}
                            disabled={processing || !selectedStation}
                            style={{ background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' }}
                        >
                            {processing ? 'Processing...' : '🔄 Confirm Station Change'}
                        </button>
                        <button className="btn-secondary" onClick={() => setStep(3)}>
                            ← Back
                        </button>
                    </div>
                )}

                {/* Info Section */}
                {step === 1 && (
                    <div className="info-section">
                        <h3>ℹ️ Important Information</h3>
                        <ul>
                            <li>You can change your boarding station <strong>only once</strong> per booking</li>
                            <li>You can only select a station <strong>ahead</strong> of your original boarding point</li>
                            <li>Change must be done <strong>before</strong> the train reaches your original station</li>
                            <li>Your berth remains the same - only boarding station changes</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChangeBoardingStationPage;
