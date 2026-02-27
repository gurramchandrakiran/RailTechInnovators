import React, { useState, useEffect } from 'react';
import '../styles/components/GroupUpgradeSelectionModal.css';

interface Passenger {
    id: string;
    pnr: string;
    name: string;
    age: number;
    gender: string;
    racStatus: number;
    coach: string;
    berth: string;
    from: string;
    to: string;
    passengerStatus: string;
    boarded: boolean;
}

interface GroupUpgradeSelectionModalProps {
    pnr: string;
    passengers: Passenger[];
    vacantSeatsCount: number;
    onClose: () => void;
    onConfirm: (selectedPassengerIds: string[]) => void;
}

const GroupUpgradeSelectionModal: React.FC<GroupUpgradeSelectionModalProps> = ({
    pnr,
    passengers,
    vacantSeatsCount,
    onClose,
    onConfirm
}) => {
    const [selectedPassengers, setSelectedPassengers] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auto-select all if group size <= vacant seats
    useEffect(() => {
        if (passengers.length <= vacantSeatsCount) {
            const allIds = new Set(passengers.map(p => p.id));
            setSelectedPassengers(allIds);
        }
    }, [passengers, vacantSeatsCount]);

    const togglePassenger = (passengerId: string) => {
        const newSelection = new Set(selectedPassengers);
        if (newSelection.has(passengerId)) {
            newSelection.delete(passengerId);
        } else {
            // Only add if we haven't reached the limit
            if (newSelection.size < vacantSeatsCount) {
                newSelection.add(passengerId);
            }
        }
        setSelectedPassengers(newSelection);
    };

    const handleSmartSuggest = () => {
        // Priority: Children (age < 12) > Elderly (age > 60) > Others by RAC order
        const sortedPassengers = [...passengers].sort((a, b) => {
            const aIsChild = a.age < 12;
            const bIsChild = b.age < 12;
            const aIsElderly = a.age > 60;
            const bIsElderly = b.age > 60;

            if (aIsChild && !bIsChild) return -1;
            if (!aIsChild && bIsChild) return 1;
            if (aIsElderly && !bIsElderly) return -1;
            if (!aIsElderly && bIsElderly) return 1;

            return a.racStatus - b.racStatus;
        });

        const suggested = new Set(
            sortedPassengers.slice(0, vacantSeatsCount).map(p => p.id)
        );
        setSelectedPassengers(suggested);
    };

    const handleConfirm = async () => {
        if (selectedPassengers.size === 0) {
            alert('Please select at least one passenger to upgrade.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onConfirm(Array.from(selectedPassengers));
        } catch (error) {
            console.error('Error confirming selection:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const canAddMore = selectedPassengers.size < vacantSeatsCount;
    const selectionComplete = selectedPassengers.size === vacantSeatsCount;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="selection-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🎯 Select Passengers for Upgrade</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-info">
                    <div className="info-row">
                        <span className="label">PNR:</span>
                        <span className="value">{pnr}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">Vacant Seats:</span>
                        <span className="value">{vacantSeatsCount}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">Eligible Passengers:</span>
                        <span className="value">{passengers.length}</span>
                    </div>
                </div>

                {passengers.length > vacantSeatsCount && (
                    <div className="selection-notice">
                        ⚠️ Select exactly {vacantSeatsCount} passenger{vacantSeatsCount > 1 ? 's' : ''} to upgrade
                    </div>
                )}

                <div className="passengers-list">
                    {passengers.map((passenger, idx) => {
                        const isSelected = selectedPassengers.has(passenger.id);
                        const isDisabled = !isSelected && !canAddMore;

                        return (
                            <div
                                key={passenger.id}
                                className={`passenger-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                                onClick={() => !isDisabled && togglePassenger(passenger.id)}
                            >
                                <div className="checkbox">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => togglePassenger(passenger.id)}
                                        disabled={isDisabled}
                                    />
                                </div>
                                <div className="passenger-details">
                                    <div className="passenger-name">
                                        <span className="name">{passenger.name}</span>
                                        <span className="age-gender">({passenger.age}{passenger.gender})</span>
                                        {passenger.age < 12 && <span className="tag child-tag">Child</span>}
                                        {passenger.age > 60 && <span className="tag elderly-tag">Elderly</span>}
                                    </div>
                                    <div className="passenger-meta">
                                        RAC-{passenger.racStatus} | {passenger.coach}-{passenger.berth} | {passenger.from} → {passenger.to}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="selection-summary">
                    <span className={`count ${selectionComplete ? 'complete' : ''}`}>
                        Selected: {selectedPassengers.size} / {vacantSeatsCount}
                    </span>
                    {selectionComplete && <span className="check-icon">✅</span>}
                </div>

                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    {passengers.length > vacantSeatsCount && (
                        <button className="btn btn-suggestion" onClick={handleSmartSuggest} disabled={isSubmitting}>
                            💡 Smart Suggest
                        </button>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={selectedPassengers.size === 0 || isSubmitting}
                    >
                        {isSubmitting ? 'Upgrading...' : `Upgrade Selected (${selectedPassengers.size})`} →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupUpgradeSelectionModal;
