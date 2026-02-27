// passenger-portal/src/pages/CancelTicketPage.tsx
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
    Booking_Status: string;
    Email?: string;
    NO_show?: boolean;
}

const CancelTicketPage: React.FC = () => {
    const navigate = useNavigate();

    // Step tracking
    const [step, setStep] = useState<number>(1);

    // Step 1: PNR input
    const [pnr, setPnr] = useState<string>('');
    const [passengers, setPassengers] = useState<Passenger[]>([]);

    // Step 2: Passenger selection - now supports multiple
    const [selectedPassengers, setSelectedPassengers] = useState<Passenger[]>([]);

    // Step 3: OTP verification
    const [otp, setOtp] = useState<string>('');
    const [maskedEmail, setMaskedEmail] = useState<string>('');

    // Loading states
    const [loading, setLoading] = useState<boolean>(false);
    const [processing, setProcessing] = useState<boolean>(false);

    // Toggle passenger selection
    const togglePassenger = (passenger: Passenger): void => {
        setSelectedPassengers(prev => {
            const isSelected = prev.some(p => p.Name === passenger.Name);
            if (isSelected) {
                return prev.filter(p => p.Name !== passenger.Name);
            } else {
                return [...prev, passenger];
            }
        });
    };

    // Select All / Deselect All
    const toggleSelectAll = (): void => {
        if (selectedPassengers.length === passengers.length) {
            setSelectedPassengers([]);
        } else {
            setSelectedPassengers([...passengers]);
        }
    };

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
                // Handle both single and array responses
                const passengerList = Array.isArray(data.data) ? data.data : [data.data];
                // Filter out already cancelled passengers
                const activePassengers = passengerList.filter((p: Passenger) => !p.NO_show);

                if (activePassengers.length === 0) {
                    toast.error('All passengers on this PNR are already cancelled');
                    return;
                }

                setPassengers(activePassengers);
                setStep(2);
                toast.success(`Found ${activePassengers.length} active passenger(s) on this PNR`);
            } else {
                toast.error(data.message || 'No passengers found for this PNR');
            }
        } catch (error) {
            console.error('Error fetching passengers:', error);
            toast.error('Failed to fetch passengers');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Send OTP (use first selected passenger for OTP)
    const sendOTP = async (): Promise<void> => {
        if (selectedPassengers.length === 0) {
            toast.error('Please select at least one passenger');
            return;
        }

        setProcessing(true);
        try {
            // Send OTP using first selected passenger's details
            const firstPassenger = selectedPassengers[0];
            const response = await fetch(`${API_URL}/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    irctcId: firstPassenger.IRCTC_ID,
                    pnr: firstPassenger.PNR_Number,
                    purpose: 'Cancel Ticket'
                })
            });
            const data = await response.json();

            if (data.success) {
                // Mask email for display
                const email = firstPassenger.Email || 'registered email';
                const masked = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
                setMaskedEmail(masked);
                setStep(3);
                toast.success(`OTP sent to ${masked}`);
            } else {
                toast.error(data.message || 'Failed to send OTP');
            }
        } catch (error) {
            toast.error('Error sending OTP');
        } finally {
            setProcessing(false);
        }
    };

    // Step 3: Verify OTP and Cancel ALL selected passengers
    const verifyAndCancel = async (): Promise<void> => {
        if (!otp || otp.length !== 6) {
            toast.error('Please enter the 6-digit OTP');
            return;
        }

        setProcessing(true);
        try {
            const firstPassenger = selectedPassengers[0];

            // Verify OTP first
            const otpResponse = await fetch(`${API_URL}/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    irctcId: firstPassenger.IRCTC_ID,
                    pnr: firstPassenger.PNR_Number,
                    otp: otp
                })
            });
            const otpData = await otpResponse.json();

            if (!otpData.success) {
                toast.error(otpData.message || 'Invalid OTP');
                setProcessing(false);
                return;
            }

            // Confirmation
            const passengerNames = selectedPassengers.map(p => p.Name).join(', ');
            const confirmed = window.confirm(
                `⚠️ Confirm Cancellation\n\n` +
                `Passengers to cancel (${selectedPassengers.length}):\n${passengerNames}\n\n` +
                `Their berths will be made available for other passengers.\n\n` +
                `This action cannot be undone. Continue?`
            );

            if (!confirmed) {
                setProcessing(false);
                return;
            }

            // Cancel ALL selected passengers
            const token = localStorage.getItem('token');
            let successCount = 0;
            let failCount = 0;

            for (const passenger of selectedPassengers) {
                try {
                    const response = await fetch(`${API_URL}/passenger/self-cancel`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            pnr: passenger.PNR_Number,
                            irctcId: passenger.IRCTC_ID,
                            passengerName: passenger.Name
                        })
                    });
                    const data = await response.json();

                    if (data.success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch {
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`✅ ${successCount} ticket(s) cancelled successfully!`);
                if (failCount > 0) {
                    toast.error(`${failCount} ticket(s) failed to cancel`);
                }
                navigate('/');
            } else {
                toast.error('Failed to cancel tickets');
            }
        } catch (error) {
            toast.error('Error cancelling tickets');
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
                        <h1>❌ Cancel Ticket</h1>
                        <p className="subtitle">Cancel your ticket and free your berth for other passengers</p>
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
                    <div className={`step ${step >= 3 ? 'active' : ''}`}>
                        <span className="step-number">3</span>
                        <span className="step-label">Verify & Cancel</span>
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

                {/* Step 2: Select Passengers */}
                {step === 2 && (
                    <div className="step-content">
                        <h2>Step 2: Select Passengers to Cancel</h2>
                        <p className="hint">Select one or more passengers. OTP will be sent to the first passenger's email.</p>

                        {/* Select All Checkbox */}
                        <div
                            className="select-all-option"
                            style={{
                                padding: '12px 16px',
                                background: '#f0f4f8',
                                borderRadius: '8px',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer'
                            }}
                            onClick={toggleSelectAll}
                        >
                            <input
                                type="checkbox"
                                checked={selectedPassengers.length === passengers.length && passengers.length > 0}
                                readOnly
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: 600 }}>
                                {selectedPassengers.length === passengers.length ? 'Deselect All' : 'Select All'}
                                ({passengers.length} passengers)
                            </span>
                        </div>

                        <div className="passenger-list">
                            {passengers.map((p, idx) => (
                                <div
                                    key={idx}
                                    className={`passenger-card ${selectedPassengers.some(sp => sp.Name === p.Name) ? 'selected' : ''}`}
                                    onClick={() => togglePassenger(p)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="passenger-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedPassengers.some(sp => sp.Name === p.Name)}
                                            readOnly
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <span className="passenger-name">{p.Name}</span>
                                            <span className="passenger-berth">{p.Coach}-{p.Berth_Number}</span>
                                        </div>
                                    </div>
                                    <div className="passenger-route">
                                        Status: {p.Booking_Status}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '12px', color: '#6b7280', fontSize: '14px' }}>
                            Selected: {selectedPassengers.length} passenger(s)
                        </div>

                        <button
                            className="btn-primary"
                            onClick={sendOTP}
                            disabled={selectedPassengers.length === 0 || processing}
                        >
                            {processing ? 'Sending OTP...' : `📧 Send OTP (Cancel ${selectedPassengers.length} passenger${selectedPassengers.length !== 1 ? 's' : ''})`}
                        </button>
                        <button className="btn-secondary" onClick={() => setStep(1)}>
                            ← Back
                        </button>
                    </div>
                )}

                {/* Step 3: Verify OTP and Cancel */}
                {step === 3 && (
                    <div className="step-content">
                        <h2>Step 3: Verify OTP & Cancel</h2>
                        <p className="hint">OTP sent to: {maskedEmail}</p>

                        <div className="station-info">
                            <div style={{ padding: '12px', background: '#fee2e2', borderRadius: '8px', marginBottom: '16px' }}>
                                <strong>Cancelling {selectedPassengers.length} passenger(s):</strong>
                                <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                                    {selectedPassengers.map((p, idx) => (
                                        <li key={idx}>{p.Name} ({p.Coach}-{p.Berth_Number})</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

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
                            className="btn-danger"
                            onClick={verifyAndCancel}
                            disabled={otp.length !== 6 || processing}
                        >
                            {processing ? 'Processing...' : '❌ Verify & Cancel Ticket'}
                        </button>
                        <button className="btn-secondary" onClick={() => setStep(2)}>
                            ← Back
                        </button>
                    </div>
                )}

                {/* Info Section */}
                <div className="info-section">
                    <h3>ℹ️ Important Information</h3>
                    <ul>
                        <li>Cancellation will mark your ticket as NO-SHOW</li>
                        <li>Your berth will be made available for RAC passengers to upgrade</li>
                        <li>This action cannot be undone</li>
                        <li>Refund policies apply as per IRCTC guidelines</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default CancelTicketPage;
