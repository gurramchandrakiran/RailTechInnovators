// admin-portal/src/components/TrainTabBar.tsx
// Excel-style sheet tabs for quick multi-train switching
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/components/TrainTabBar.css';

export interface TrainTab {
    trainNo: string;
    trainName: string;
}

const STORAGE_KEY = 'configuredTrainTabs';

/** Read persisted tabs from localStorage */
export function getPersistedTabs(): TrainTab[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/** Save tabs to localStorage */
export function persistTabs(tabs: TrainTab[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
}

/** Add a tab (idempotent — won't duplicate) */
export function addTrainTab(trainNo: string, trainName: string): TrainTab[] {
    const tabs = getPersistedTabs();
    if (tabs.some(t => t.trainNo === trainNo)) {
        // Update name if changed
        const updated = tabs.map(t => t.trainNo === trainNo ? { ...t, trainName } : t);
        persistTabs(updated);
        return updated;
    }
    const updated = [...tabs, { trainNo, trainName }];
    persistTabs(updated);
    return updated;
}

/** Remove a tab */
export function removeTrainTab(trainNo: string): TrainTab[] {
    const tabs = getPersistedTabs().filter(t => t.trainNo !== trainNo);
    persistTabs(tabs);
    return tabs;
}

/** Dispatch event to trigger tab bar re-render across all instances */
export function notifyTabsChanged(): void {
    window.dispatchEvent(new Event('trainTabsChanged'));
}

const TrainTabBar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Self-contained re-render on tab changes
    const [, setRenderKey] = useState(0);
    useEffect(() => {
        const handler = () => setRenderKey(k => k + 1);
        window.addEventListener('trainTabsChanged', handler);
        return () => window.removeEventListener('trainTabsChanged', handler);
    }, []);

    // Determine active train from URL (standalone: /train/:trainNo)
    const match = location.pathname.match(/\/train\/(\d+)/);
    const activeTrainNo = match ? match[1] : null;

    const tabs = getPersistedTabs();

    const handleTabClick = (trainNo: string) => {
        if (trainNo === activeTrainNo) return;
        // Navigate with a flag so TrainDashboard knows this is a tab-switch (skip config)
        navigate(`/train/${trainNo}`, { state: { fromTab: true } });
    };

    const handleClose = (e: React.MouseEvent, trainNo: string) => {
        e.stopPropagation();
        const remaining = removeTrainTab(trainNo);
        // If closing the active tab, switch to next tab or landing
        if (trainNo === activeTrainNo) {
            if (remaining.length > 0) {
                navigate(`/train/${remaining[0].trainNo}`, { state: { fromTab: true } });
            } else {
                navigate('/');
            }
        }
        notifyTabsChanged();
    };

    const handleAdd = () => {
        navigate('/');
    };

    // Don't render if no tabs and not on a train page
    if (tabs.length === 0 && !activeTrainNo) {
        return null;
    }

    return (
        <div className="train-tab-bar">
            {tabs.map(tab => (
                <div
                    key={tab.trainNo}
                    className={`train-tab ${tab.trainNo === activeTrainNo ? 'active' : ''}`}
                    onClick={() => handleTabClick(tab.trainNo)}
                    title={`${tab.trainNo} — ${tab.trainName}`}
                    role="tab"
                >
                    <span className="tab-icon">🚂</span>
                    <span className="tab-label">{tab.trainNo}</span>
                    {tab.trainName && <span className="tab-name">{tab.trainName}</span>}
                    <button
                        className="tab-close"
                        onClick={(e) => handleClose(e, tab.trainNo)}
                        title="Close tab"
                    >
                        ×
                    </button>
                </div>
            ))}
            <button
                className="train-tab-add"
                onClick={handleAdd}
                title="Open another train"
            >
                +
            </button>
        </div>
    );
};

export default TrainTabBar;
