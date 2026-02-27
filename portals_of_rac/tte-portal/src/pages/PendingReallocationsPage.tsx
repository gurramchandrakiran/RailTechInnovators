// tte-portal/src/pages/PendingReallocationsPage.tsx
import React, { useState, useEffect, ChangeEvent } from 'react';
import { tteAPI } from '../api';
import useTteSocket from '../hooks/useTteSocket';
import '../styles/pages/PendingReallocationsPage.css';

interface Reallocation {
    _id: string;
    passengerName: string;
    passengerPNR: string;
    stationName: string;
    passengerFrom: string;
    passengerTo: string;
    currentBerth: string;
    currentRAC: string;
    proposedBerthFull: string;
    proposedBerthType: string;
    berthVacantFrom: string;
    berthVacantTo: string;
    passengerStatus?: string; // 'Online' | 'Offline'
}

const PendingReallocationsPage: React.FC = () => {
    const [pendingReallocations, setPendingReallocations] = useState<Reallocation[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [processing, setProcessing] = useState<boolean>(false);
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string>('');

    // Use shared WebSocket hook instead of creating a duplicate connection
    const { on } = useTteSocket();

    // Get TTE ID from localStorage
    const getTteId = (): string => {
        const user = localStorage.getItem('user');
        if (user) {
            const parsedUser = JSON.parse(user);
            return parsedUser.userId || parsedUser.employeeId || 'TTE1';
        }
        return 'TTE1';
    };

    useEffect(() => {
        fetchPendingReallocations();

        // Auto-refresh every 10 seconds
        const interval = setInterval(fetchPendingReallocations, 10000);

        // Listen for approval events via shared WebSocket hook
        const unsubApproved = on('UPGRADE_APPROVED_BY_PASSENGER', () => {
            console.log('🔄 TTE: Refresh triggered by passenger approval');
            fetchPendingReallocations();
        });
        const unsubRealloc = on('RAC_REALLOCATION_APPROVED', () => {
            console.log('🔄 TTE: Refresh triggered by reallocation approval');
            fetchPendingReallocations();
        });

        return () => {
            clearInterval(interval);
            unsubApproved();
            unsubRealloc();
        };
    }, []);

    const fetchPendingReallocations = async (): Promise<void> => {
        try {
            const response = await tteAPI.getPendingReallocations();
            setPendingReallocations(response.data?.reallocations || []);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching pending reallocations:', error);
            setLoading(false);
        }
    };

    const toggleSelection = (id: string): void => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = (): void => {
        if (selectedIds.length === pendingReallocations.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pendingReallocations.map(r => r._id));
        }
    };

    const toggleSelectGroup = (groupIds: string[]): void => {
        const allSelected = groupIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...groupIds])]);
        }
    };

    const approveBatch = async (): Promise<void> => {
        if (selectedIds.length === 0) {
            alert('Please select at least one reallocation to approve');
            return;
        }

        if (!confirm(`Approve ${selectedIds.length} reallocation(s)?`)) {
            return;
        }

        setProcessing(true);
        try {
            const response = await tteAPI.approveBatchReallocations(selectedIds, getTteId());

            if (response.success) {
                alert(`✅ ${response.data.totalApproved} reallocations approved!`);
                setSelectedIds([]);
                fetchPendingReallocations();
            }
        } catch (error: any) {
            alert('Failed to approve reallocations: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    const rejectReallocation = async (id: string): Promise<void> => {
        if (!rejectionReason.trim()) {
            alert('Please provide a rejection reason');
            return;
        }

        setProcessing(true);
        try {
            const response = await tteAPI.rejectReallocation(id, rejectionReason, getTteId());

            if (response.success) {
                alert('✅ Reallocation rejected');
                setRejecting(null);
                setRejectionReason('');
                fetchPendingReallocations();
            }
        } catch (error: any) {
            alert('Failed to reject reallocation: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    // Split into online and offline groups
    const onlineReallocations = pendingReallocations.filter(
        r => r.passengerStatus?.toLowerCase() === 'online'
    );
    const offlineReallocations = pendingReallocations.filter(
        r => r.passengerStatus?.toLowerCase() !== 'online'
    );

    const renderReallocationRow = (realloc: Reallocation) => (
        <tr key={realloc._id} className={selectedIds.includes(realloc._id) ? 'selected' : ''}>
            <td>
                <input
                    type="checkbox"
                    checked={selectedIds.includes(realloc._id)}
                    onChange={() => toggleSelection(realloc._id)}
                />
            </td>
            <td className="passenger-name">{realloc.passengerName}</td>
            <td className="pnr">{realloc.passengerPNR}</td>
            <td>
                <span className="station-badge">📍 {realloc.stationName}</span>
            </td>
            <td className="journey">
                {realloc.passengerFrom} → {realloc.passengerTo}
            </td>
            <td className="current-status">
                <span className="status-rac">
                    {realloc.currentBerth} ({realloc.currentRAC})
                </span>
            </td>
            <td className="proposed-berth">
                <span className="status-proposed">
                    ✨ {realloc.proposedBerthFull} ({realloc.proposedBerthType})
                </span>
            </td>
            <td className="berth-vacant">
                {realloc.berthVacantFrom} → {realloc.berthVacantTo}
            </td>
            <td className="actions">
                {rejecting === realloc._id ? (
                    <div className="rejection-form-inline">
                        <input
                            type="text"
                            placeholder="Reason..."
                            value={rejectionReason}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setRejectionReason(e.target.value)}
                            autoFocus
                        />
                        <button
                            className="btn-confirm-small"
                            onClick={() => rejectReallocation(realloc._id)}
                            disabled={processing}
                        >
                            ✓
                        </button>
                        <button
                            className="btn-cancel-small"
                            onClick={() => {
                                setRejecting(null);
                                setRejectionReason('');
                            }}
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <div className="action-buttons">
                        <button
                            className="btn-approve-small"
                            onClick={() => {
                                setSelectedIds([realloc._id]);
                                setTimeout(() => approveBatch(), 100);
                            }}
                            disabled={processing}
                        >
                            ✅ Select
                        </button>
                        <button
                            className="btn-reject-small"
                            onClick={() => setRejecting(realloc._id)}
                            disabled={processing}
                        >
                            ❌ Reject
                        </button>
                    </div>
                )}
            </td>
        </tr>
    );

    const renderTable = (reallocations: Reallocation[], groupIds: string[]) => (
        <div className="table-container">
            <table className="reallocations-table">
                <thead>
                    <tr>
                        <th>
                            <input
                                type="checkbox"
                                checked={groupIds.length > 0 && groupIds.every(id => selectedIds.includes(id))}
                                onChange={() => toggleSelectGroup(groupIds)}
                            />
                        </th>
                        <th>Passenger Name</th>
                        <th>PNR</th>
                        <th>Station</th>
                        <th>Journey</th>
                        <th>Current Status</th>
                        <th>Proposed Berth</th>
                        <th>Berth Vacant</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {reallocations.map(renderReallocationRow)}
                </tbody>
            </table>
        </div>
    );

    if (loading) {
        return (
            <div className="pending-reallocations-page">
                <div className="loading">⏳ Loading...</div>
            </div>
        );
    }

    return (
        <div className="pending-reallocations-page">
            {/* Header */}
            <div className="page-header">
                <h1>⏳ Pending RAC Reallocations</h1>
                <div className="header-actions">
                    <span className="pending-count">
                        {pendingReallocations.length} Pending
                    </span>
                    <button className="btn-refresh" onClick={fetchPendingReallocations}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Bulk Actions */}
            {pendingReallocations.length > 0 && (
                <div className="bulk-actions-bar">
                    <div className="select-all">
                        <input
                            type="checkbox"
                            checked={selectedIds.length === pendingReallocations.length}
                            onChange={toggleSelectAll}
                        />
                        <label>
                            Select All ({selectedIds.length} selected)
                        </label>
                    </div>
                    <div className="actions">
                        <button
                            className="btn-approve"
                            onClick={approveBatch}
                            disabled={selectedIds.length === 0 || processing}
                        >
                            ✅ Approve Selected ({selectedIds.length})
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {pendingReallocations.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">✨</div>
                    <h3>No Pending Reallocations</h3>
                    <p>All reallocations have been processed</p>
                </div>
            ) : (
                <div className="reallocation-sections">
                    {/* Online Passengers Section */}
                    <div className="reallocation-section">
                        <div className="section-header section-online">
                            <div className="section-title">
                                <span className="section-icon">🌐</span>
                                <h2>Online Passengers</h2>
                                <span className="section-count">{onlineReallocations.length}</span>
                            </div>
                            <p className="section-description">
                                Passengers connected via Passenger Portal — upgrade offers will be sent digitally
                            </p>
                        </div>
                        {onlineReallocations.length === 0 ? (
                            <div className="section-empty">
                                <p>No online passenger upgrades pending</p>
                            </div>
                        ) : (
                            renderTable(onlineReallocations, onlineReallocations.map(r => r._id))
                        )}
                    </div>

                    {/* ── Divider ── */}
                    <div className="section-divider">
                        <span className="divider-line"></span>
                        <span className="divider-label">Offline / Online Separation</span>
                        <span className="divider-line"></span>
                    </div>

                    {/* Offline Passengers Section */}
                    <div className="reallocation-section">
                        <div className="section-header section-offline">
                            <div className="section-title">
                                <span className="section-icon">📴</span>
                                <h2>Offline Passengers</h2>
                                <span className="section-count">{offlineReallocations.length}</span>
                            </div>
                            <p className="section-description">
                                Passengers not on the app — TTE must manually inform and confirm upgrade
                            </p>
                        </div>
                        {offlineReallocations.length === 0 ? (
                            <div className="section-empty">
                                <p>No offline passenger upgrades pending</p>
                            </div>
                        ) : (
                            renderTable(offlineReallocations, offlineReallocations.map(r => r._id))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PendingReallocationsPage;
