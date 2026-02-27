// admin-portal/src/pages/ConfigPage.tsx
import React, { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { setupConfig, initializeTrain, getTrains } from "../services/apiWithErrorHandling";
import "../styles/pages/ConfigPage.css";

interface FormState {
    stationsDb: string;
    stationsCollection: string;
    trainNo: string;
    trainName: string;
    journeyDate: string;
}

interface TrainItem {
    trainNo: string | number;
    trainName?: string;
    stationsCollection?: string;
    passengersCollection?: string;
    sleeperCount?: number;
    threeAcCount?: number;
    sleeperCoachesCount?: number;
    threeTierACCoachesCount?: number;
}

interface ConfigPageProps {
    onClose: () => void;
    onApplySuccess?: (trainNo: string) => void;
    loadTrainState: () => Promise<void>;
}

function ConfigPage({ onClose, onApplySuccess, loadTrainState }: ConfigPageProps): React.ReactElement {
    const navigate = useNavigate();
    const [form, setForm] = useState<FormState>({
        stationsDb: "rac",
        stationsCollection: "",
        trainNo: "17225",
        trainName: "",
        journeyDate: "2025-11-15",
    });
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [trainList, setTrainList] = useState<TrainItem[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const res = await getTrains();
                if (res.success) setTrainList(res.data || []);
            } catch (error: any) {
                console.warn('Could not load train list:', error.message);
            }
        })();
    }, []);

    const update = (key: keyof FormState, value: string): void => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const item = trainList.find((t) => String(t.trainNo) === form.trainNo);

            let stationsCollection = form.stationsCollection;
            if (!stationsCollection && item?.stationsCollection) {
                stationsCollection = item.stationsCollection;
                update("stationsCollection", stationsCollection);
            }

            if (!stationsCollection) {
                throw new Error(
                    `Could not auto-detect Station Collection for train ${form.trainNo}. Please ensure "Station_Collection_Name" is set in "Trains_Details" collection.`
                );
            }

            // Auto-derive passengers collection from Trains_Details
            const passengersCollection = item?.passengersCollection || `${form.trainNo}_passengers`;

            const payload = {
                // MongoDB URI comes from backend .env - not from frontend!
                stationsDb: form.stationsDb,
                stationsCollection: stationsCollection,
                passengersDb: "PassengersDB", // collection name from Trains_Details, database from env
                passengersCollection: passengersCollection,
                trainNo: form.trainNo,
                journeyDate: form.journeyDate,
            };

            const res = await setupConfig(payload);
            if (!res.success)
                throw new Error((res as any).message || "Failed to apply configuration");

            const init = await initializeTrain(form.trainNo, form.journeyDate);
            if (!init.success)
                throw new Error((init as any).message || "Initialization failed");

            // For standalone/manual config: navigate immediately to the train dashboard.
            // The destination page will handle its own state loading.
            if (onApplySuccess) {
                onApplySuccess(form.trainNo);
                return; // Exit early — don't call loadTrainState or delays
            }

            // For homepage config: wait and reload state before closing
            await new Promise(resolve => setTimeout(resolve, 500));
            try { await loadTrainState(); } catch (_) { /* non-blocking */ }
            await new Promise(resolve => setTimeout(resolve, 300));
            onClose();
        } catch (err: any) {
            const msg =
                typeof err === "string"
                    ? err
                    : err?.message || err?.error || "Configuration failed";
            const hint =
                msg.includes("Network") || msg.includes("connect")
                    ? "Cannot reach backend. Is the API running on http://localhost:5000?"
                    : "";
            setError([msg, hint].filter(Boolean).join(" "));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="config-page">
            <div className="page-header">
                <button className="back-btn" onClick={onClose} disabled={submitting}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>

                </button>
                <h2>⚙️ System Configuration</h2>
            </div>

            <form className="config-form" onSubmit={handleSubmit}>
                {error && <div className="error-banner">{error}</div>}

                <div className="form-section">
                    <h3>ℹ️ Configuration</h3>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                        MongoDB connection is configured in backend <code>.env</code> file.
                        <br />
                        Update the fields below to test different trains or collections.
                    </p>
                </div>


                <div className="form-section">
                    <h3>Train Details</h3>
                    {trainList.length > 0 && (
                        <label>
                            Select Train (from Train_Details)
                            <select
                                value={form.trainNo}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                                    const no = e.target.value;
                                    const item = trainList.find((t) => String(t.trainNo) === no);
                                    update("trainNo", no);
                                    if (item) {
                                        update("trainName", item.trainName || "");
                                        if (item.stationsCollection) {
                                            update("stationsCollection", item.stationsCollection);
                                        }
                                    }
                                }}
                            >
                                <option value="">-- Select --</option>
                                {trainList.map((t) => (
                                    <option key={String(t.trainNo)} value={String(t.trainNo)}>
                                        {t.trainNo} - {t.trainName || "Unnamed"} (SL:
                                        {t.sleeperCoachesCount || t.sleeperCount || 0}, 3A:{t.threeTierACCoachesCount || t.threeAcCount || 0})
                                    </option>
                                ))}
                            </select>
                            <span className="field-hint">
                                Train metadata from rac.Trains_Details (includes Station_Collection_Name)
                            </span>
                        </label>
                    )}
                    <label>
                        Train Number
                        <input
                            type="text"
                            value={form.trainNo}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const no = e.target.value;
                                const item = trainList.find((t) => String(t.trainNo) === no);
                                update("trainNo", no);
                                if (item) {
                                    update("trainName", item.trainName || "");
                                    if (item.stationsCollection) {
                                        update("stationsCollection", item.stationsCollection);
                                    }
                                }
                            }}
                            placeholder="e.g., 17225"
                            maxLength={5}
                            required
                        />
                        <span className="field-hint">
                            Train name will be fetched from Train_Details collection
                        </span>
                    </label>
                    <label>
                        Journey Date
                        <input
                            type="date"
                            value={form.journeyDate}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => update("journeyDate", e.target.value)}
                            required
                        />
                        <span className="field-hint">Format: YYYY-MM-DD</span>
                    </label>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={submitting}>
                        {submitting ? "Applying..." : "Apply Configuration"}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ConfigPage;

