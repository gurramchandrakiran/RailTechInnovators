// admin-portal/src/pages/AddPassengerPage.tsx

import React, { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { addPassenger, getTrainState } from "../services/apiWithErrorHandling";
import "../styles/pages/AddPassengerPage.css";

interface Station {
    code: string;
    name: string;
    idx?: number;
}

interface TrainData {
    trainNo?: string;
    trainName?: string;
    journeyDate?: string;
    stations?: Station[];
}

interface PrimaryFormData {
    irctc_id: string;
    pnr: string;
    name: string;
    age: string;
    gender: string;
    mobile: string;
    email: string;
    train_no: string;
    train_name: string;
    journey_date: string;
    from: string;
    to: string;
    class: string;
    pnr_status: string;
    rac_status: string;
    coach: string;
    seat_no: string;
    berth_type: string;
    passenger_status: string;
}

interface CoPassenger {
    name: string;
    age: string;
    gender: string;
    mobile: string;
    email: string;
    class: string;
    pnr_status: string;
    rac_status: string;
    coach: string;
    seat_no: string;
    berth_type: string;
    passenger_status: string;
}

interface AddPassengerPageProps {
    trainData: TrainData | null;
    onClose: () => void;
}

const createEmptyCoPassenger = (): CoPassenger => ({
    name: "",
    age: "",
    gender: "Male",
    mobile: "",
    email: "",
    class: "Sleeper",
    pnr_status: "CNF",
    rac_status: "-",
    coach: "S1",
    seat_no: "",
    berth_type: "Lower",
    passenger_status: "Online",
});

const AddPassengerPage = ({ trainData, onClose }: AddPassengerPageProps): React.ReactElement => {
    const [formData, setFormData] = useState<PrimaryFormData>({
        irctc_id: "",
        pnr: "",
        name: "",
        age: "",
        gender: "Male",
        mobile: "",
        email: "",
        train_no: trainData?.trainNo || "",
        train_name: trainData?.trainName || "",
        journey_date: trainData?.journeyDate || new Date().toISOString().split("T")[0],
        from: "",
        to: "",
        class: "Sleeper",
        pnr_status: "CNF",
        rac_status: "-",
        coach: "S1",
        seat_no: "",
        berth_type: "Lower",
        passenger_status: "Online",
    });

    const [coPassengers, setCoPassengers] = useState<CoPassenger[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [success, setSuccess] = useState<boolean>(false);

    useEffect(() => {
        if (trainData && trainData.stations) {
            setStations(trainData.stations);
            setFormData((prev) => ({
                ...prev,
                train_no: trainData.trainNo || "",
                train_name: trainData.trainName || "",
                journey_date: trainData.journeyDate || new Date().toISOString().split("T")[0],
            }));
        } else {
            loadStations();
        }
    }, [trainData]);

    const loadStations = async (): Promise<void> => {
        try {
            const response = await getTrainState();
            if (response.success && response.data.stations) {
                setStations(response.data.stations);
            }
        } catch (err) {
            console.error("Error loading stations:", err);
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
        if (error) setError("");
    };

    const handleCoPassengerChange = (index: number, e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
        const { name, value } = e.target;
        setCoPassengers(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [name]: value };
            return updated;
        });
        if (error) setError("");
    };

    const addCoPassenger = (): void => {
        if (coPassengers.length >= 5) {
            setError("Maximum 6 passengers per PNR (1 primary + 5 co-passengers)");
            return;
        }
        setCoPassengers(prev => [...prev, createEmptyCoPassenger()]);
    };

    const removeCoPassenger = (index: number): void => {
        setCoPassengers(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        // Validate primary passenger
        const seatNum = parseInt(formData.seat_no);
        if (seatNum < 1 || seatNum > 72) {
            setError("Seat number must be between 1 and 72");
            return;
        }

        const fromStation = stations.find((s) => s.code === formData.from);
        const toStation = stations.find((s) => s.code === formData.to);
        if (!fromStation || !toStation || (fromStation.idx !== undefined && toStation.idx !== undefined && fromStation.idx >= toStation.idx)) {
            setError("Destination station must come after boarding station");
            return;
        }

        // Validate co-passengers
        for (let i = 0; i < coPassengers.length; i++) {
            const cp = coPassengers[i];
            if (!cp.name || !cp.age || !cp.seat_no) {
                setError(`Co-passenger ${i + 1}: Name, Age, and Seat are required`);
                return;
            }
            const cpSeat = parseInt(cp.seat_no);
            if (cpSeat < 1 || cpSeat > 72) {
                setError(`Co-passenger ${i + 1}: Seat number must be between 1 and 72`);
                return;
            }
        }

        try {
            setLoading(true);
            setError("");

            // Add primary passenger
            const primaryResponse = await addPassenger(formData);
            if (!primaryResponse.success) {
                setError("Failed to add primary passenger");
                return;
            }

            // Add co-passengers (inherit shared fields from primary)
            let allSuccess = true;
            for (const cp of coPassengers) {
                const coPassengerData = {
                    ...cp,
                    irctc_id: formData.irctc_id,
                    pnr: formData.pnr,
                    train_no: formData.train_no,
                    train_name: formData.train_name,
                    journey_date: formData.journey_date,
                    from: formData.from,
                    to: formData.to,
                    passenger_status: formData.passenger_status, // Sync status with primary
                };
                const cpResponse = await addPassenger(coPassengerData);
                if (!cpResponse.success) {
                    allSuccess = false;
                }
            }

            if (allSuccess) {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                setError("Some co-passengers failed to add");
            }
        } catch (err: any) {
            setError(err.message || "Failed to add passengers. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="add-passenger-page">
                <div className="success-animation">
                    <div className="success-checkmark">
                        <svg viewBox="0 0 52 52">
                            <circle cx="26" cy="26" r="25" fill="none" />
                            <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                        </svg>
                    </div>
                    <h2>{coPassengers.length + 1} Passenger(s) Added Successfully!</h2>
                    <p>Redirecting to home...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="add-passenger-page">
            <div className="page-container">
                <div className="page-header">
                    <button onClick={onClose} className="back-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>

                    </button>
                    <div className="header-content">
                        <div className="header-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="20" y1="8" x2="20" y2="14" />
                                <line x1="23" y1="11" x2="17" y2="11" />
                            </svg>
                        </div>
                        <div>
                            <h1>Add Passengers</h1>
                            <p>Add primary passenger and co-passengers on same PNR</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="passenger-form">
                    {/* Primary Passenger Section */}
                    <div className="form-section">
                        <h3 className="section-title">
                            <span className="section-icon"></span>
                            Primary Passenger (Booking Holder)
                        </h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>IRCTC ID</label>
                                <input type="text" name="irctc_id" value={formData.irctc_id} onChange={handleChange} placeholder="e.g., IR_0001" required />
                                <span className="field-hint">Unique IRCTC identifier</span>
                            </div>

                            <div className="form-group">
                                <label>PNR Number</label>
                                <input type="text" name="pnr" value={formData.pnr} onChange={handleChange} placeholder="Enter 10-digit PNR" required maxLength={10} pattern="[0-9]{10}" />
                                <span className="field-hint">10-digit PNR number</span>
                            </div>

                            <div className="form-group full-width">
                                <label>Full Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter passenger name" required />
                            </div>

                            <div className="form-group">
                                <label>Age</label>
                                <input type="number" name="age" value={formData.age} onChange={handleChange} placeholder="Age" min={1} max={120} required />
                            </div>

                            <div className="form-group">
                                <label>Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} required>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Mobile Number</label>
                                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="10-digit mobile number" pattern="[0-9]{10}" maxLength={10} />
                                <span className="field-hint">For SMS notifications</span>
                            </div>

                            <div className="form-group">
                                <label>Email Address</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="passenger@email.com" />
                                <span className="field-hint">For email notifications & OTP</span>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">
                            <span className="section-icon">🚂</span>
                            Journey Details (Shared with Co-Passengers)
                        </h3>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label>Train Number</label>
                                <input type="text" name="train_no" value={formData.train_no} onChange={handleChange} placeholder="e.g., 17225" required />
                            </div>

                            <div className="form-group full-width">
                                <label>Train Name</label>
                                <input type="text" name="train_name" value={formData.train_name} onChange={handleChange} placeholder="e.g., Amaravathi Express" required />
                            </div>

                            <div className="form-group full-width">
                                <label>Journey Date</label>
                                <input type="date" name="journey_date" value={formData.journey_date} onChange={handleChange} required />
                            </div>

                            <div className="form-group">
                                <label>From Station</label>
                                <select name="from" value={formData.from} onChange={handleChange} required>
                                    <option value="">Select boarding station</option>
                                    {stations.map((s) => (
                                        <option key={s.code} value={s.code}>
                                            {s.code} - {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>To Station</label>
                                <select name="to" value={formData.to} onChange={handleChange} required>
                                    <option value="">Select destination</option>
                                    {stations.map((s) => (
                                        <option key={s.code} value={s.code}>
                                            {s.code} - {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">
                            <span className="section-icon"></span>
                            Primary Passenger Booking Details
                        </h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Class</label>
                                <select name="class" value={formData.class} onChange={handleChange} required>
                                    <option value="Sleeper">Sleeper (SL)</option>
                                    <option value="3-TierAC">AC 3-Tier (3A)</option>
                                    <option value="2-TierAC">AC 2-Tier (2A)</option>
                                    <option value="1-TierAC">AC 1-Tier (1A)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>PNR Status</label>
                                <select name="pnr_status" value={formData.pnr_status} onChange={handleChange} required>
                                    <option value="CNF">Confirmed (CNF)</option>
                                    <option value="RAC">RAC</option>
                                    <option value="WL">Waiting List (WL)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>RAC Status</label>
                                <select name="rac_status" value={formData.rac_status} onChange={handleChange}>
                                    <option value="-">-</option>
                                    <option value="RAC 1">RAC 1</option>
                                    <option value="RAC 2">RAC 2</option>
                                    <option value="RAC 3">RAC 3</option>
                                    <option value="RAC 4">RAC 4</option>
                                    <option value="RAC 5">RAC 5</option>
                                </select>
                                <span className="field-hint">Only for RAC passengers</span>
                            </div>

                            <div className="form-group">
                                <label>Coach</label>
                                <select name="coach" value={formData.coach} onChange={handleChange} required>
                                    {["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"].map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Seat Number</label>
                                <input type="number" name="seat_no" value={formData.seat_no} onChange={handleChange} placeholder="1-72" min={1} max={72} required />
                                <span className="field-hint">Between 1 and 72</span>
                            </div>

                            <div className="form-group">
                                <label>Berth Type</label>
                                <select name="berth_type" value={formData.berth_type} onChange={handleChange} required>
                                    <option value="Lower Berth">Lower Berth</option>
                                    <option value="Middle Berth">Middle Berth</option>
                                    <option value="Upper Berth">Upper Berth</option>
                                    <option value="Side Lower">Side Lower</option>
                                    <option value="Side Upper">Side Upper</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Group Status (Shared)</label>
                                <select name="passenger_status" value={formData.passenger_status} onChange={handleChange} required>
                                    <option value="Online">Online</option>
                                    <option value="Offline">Offline</option>
                                </select>
                                <span className="field-hint">Applies to ALL passengers in this PNR</span>
                            </div>
                        </div>
                    </div>

                    {/* Co-Passengers Section */}
                    {coPassengers.map((cp, index) => (
                        <div key={index} className="form-section" style={{ background: '#f0f9ff', border: '2px dashed #3498db' }}>
                            <h3 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                    <span className="section-icon"></span>
                                    Co-Passenger {index + 1}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeCoPassenger(index)}
                                    style={{
                                        background: '#e74c3c',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    🗑️ Remove
                                </button>
                            </h3>
                            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '15px' }}>
                                Shares PNR, Train & Journey details with primary passenger
                            </p>
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label>Full Name</label>
                                    <input type="text" name="name" value={cp.name} onChange={(e) => handleCoPassengerChange(index, e)} placeholder="Enter passenger name" required />
                                </div>

                                <div className="form-group">
                                    <label>Age</label>
                                    <input type="number" name="age" value={cp.age} onChange={(e) => handleCoPassengerChange(index, e)} placeholder="Age" min={1} max={120} required />
                                </div>

                                <div className="form-group">
                                    <label>Gender</label>
                                    <select name="gender" value={cp.gender} onChange={(e) => handleCoPassengerChange(index, e)} required>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Mobile (Optional)</label>
                                    <input type="tel" name="mobile" value={cp.mobile} onChange={(e) => handleCoPassengerChange(index, e)} placeholder="10-digit mobile" maxLength={10} />
                                </div>

                                <div className="form-group">
                                    <label>Email (Optional)</label>
                                    <input type="email" name="email" value={cp.email} onChange={(e) => handleCoPassengerChange(index, e)} placeholder="email@example.com" />
                                </div>

                                <div className="form-group">
                                    <label>Class</label>
                                    <select name="class" value={cp.class} onChange={(e) => handleCoPassengerChange(index, e)} required>
                                        <option value="Sleeper">Sleeper (SL)</option>
                                        <option value="3-TierAC">AC 3-Tier (3A)</option>
                                        <option value="2-TierAC">AC 2-Tier (2A)</option>
                                        <option value="1-TierAC">AC 1-Tier (1A)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>PNR Status</label>
                                    <select name="pnr_status" value={cp.pnr_status} onChange={(e) => handleCoPassengerChange(index, e)} required>
                                        <option value="CNF">Confirmed (CNF)</option>
                                        <option value="RAC">RAC</option>
                                        <option value="WL">Waiting List (WL)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>RAC Status</label>
                                    <select name="rac_status" value={cp.rac_status} onChange={(e) => handleCoPassengerChange(index, e)}>
                                        <option value="-">-</option>
                                        <option value="RAC 1">RAC 1</option>
                                        <option value="RAC 2">RAC 2</option>
                                        <option value="RAC 3">RAC 3</option>
                                        <option value="RAC 4">RAC 4</option>
                                        <option value="RAC 5">RAC 5</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Coach</label>
                                    <select name="coach" value={cp.coach} onChange={(e) => handleCoPassengerChange(index, e)} required>
                                        {["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"].map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Seat Number</label>
                                    <input type="number" name="seat_no" value={cp.seat_no} onChange={(e) => handleCoPassengerChange(index, e)} placeholder="1-72" min={1} max={72} required />
                                </div>

                                <div className="form-group">
                                    <label>Berth Type</label>
                                    <select name="berth_type" value={cp.berth_type} onChange={(e) => handleCoPassengerChange(index, e)} required>
                                        <option value="Lower Berth">Lower Berth</option>
                                        <option value="Middle Berth">Middle Berth</option>
                                        <option value="Upper Berth">Upper Berth</option>
                                        <option value="Side Lower">Side Lower</option>
                                        <option value="Side Upper">Side Upper</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Add Co-Passenger Button */}
                    <div style={{ textAlign: 'center', margin: '20px 0' }}>
                        <button
                            type="button"
                            onClick={addCoPassenger}
                            disabled={coPassengers.length >= 5}
                            style={{
                                background: coPassengers.length >= 5 ? '#ccc' : 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: coPassengers.length >= 5 ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                             Add Co-Passenger ({coPassengers.length}/5)
                        </button>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                            Co-passengers share the same PNR, Train & Journey details
                        </p>
                    </div>

                    {error && (
                        <div className="error-message">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="cancel-btn" disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="submit-btn">
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    Adding {coPassengers.length + 1} Passenger(s)...
                                </>
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="8.5" cy="7" r="4" />
                                        <line x1="20" y1="8" x2="20" y2="14" />
                                        <line x1="23" y1="11" x2="17" y2="11" />
                                    </svg>
                                    Add {coPassengers.length + 1} Passenger{coPassengers.length > 0 ? 's' : ''}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPassengerPage;
