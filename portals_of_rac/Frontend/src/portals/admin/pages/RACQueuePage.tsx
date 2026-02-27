// admin-portal/src/pages/RACQueuePage.tsx

import React, { useState, useEffect } from "react";
import { getRACQueue } from "../services/apiWithErrorHandling";
import "../styles/pages/RACQueuePage.css";

interface RACPassenger {
    pnr: string;
    name: string;
    age: number;
    gender: string;
    class: string;
    pnrStatus: string;
    from: string;
    to: string;
}

interface TrainData {
    trainNo?: string;
    trainName?: string;
}

interface RACQueuePageProps {
    trainData: TrainData | null;
    onClose: () => void;
}

function RACQueuePage({ trainData, onClose }: RACQueuePageProps): React.ReactElement {
    const [racQueue, setRacQueue] = useState<RACPassenger[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        loadRACQueue();

        const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:5000');

        ws.onopen = (): void => {
            console.log('RACQueuePage WebSocket connected');
        };

        ws.onmessage = (event: MessageEvent): void => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'RAC_REALLOCATION_APPROVED' || message.type === 'RAC_REALLOCATION') {
                    console.log('✅ RAC update detected, refreshing queue...', message.data);
                    loadRACQueue();
                }
            } catch (error) {
                console.error('WebSocket message parse error:', error);
            }
        };

        ws.onerror = (error: Event): void => {
            console.error('WebSocket error:', error);
        };

        return () => ws.close();
    }, []);

    const loadRACQueue = async (): Promise<void> => {
        try {
            setLoading(true);
            const response = await getRACQueue();

            if (response.success) {
                setRacQueue(response.data.queue);
            }
        } catch (error) {
            console.error("Error loading RAC queue:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="rac-queue-page">
                <div className="page-header">
                    <button className="back-btn" onClick={onClose}>
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>

                    </button>
                    <h2> RAC Queue</h2>
                </div>
                <div className="loading-container">
                    <div className="spinner-large"></div>
                    <p>Loading RAC queue...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rac-queue-page">
            <div className="page-header">
                <button className="back-btn" onClick={onClose}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>

                </button>
                <h2> RAC Queue ({racQueue.length} passengers)</h2>
            </div>

            {racQueue.length === 0 ? (
                <div className="empty-state">
                    <p>No passengers in RAC queue</p>
                </div>
            ) : (
                <div className="rac-list">
                    {racQueue.map((rac, idx) => (
                        <div key={rac.pnr} className="rac-item">
                            <div className="rac-position">{idx + 1}</div>
                            <div className="rac-details">
                                <div className="rac-header">
                                    <span className="rac-name">{rac.name}</span>
                                    <span className="rac-status">{rac.pnrStatus}</span>
                                </div>
                                <div className="rac-info">
                                    <span className="rac-age-gender">
                                        {rac.age}/{rac.gender}
                                    </span>
                                    <span className="rac-class">{rac.class}</span>
                                    <span className="rac-pnr">PNR: {rac.pnr}</span>
                                </div>
                                <div className="rac-journey">
                                    <span className="journey-from">{rac.from}</span>
                                    <span className="journey-arrow">→</span>
                                    <span className="journey-to">{rac.to}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default RACQueuePage;

