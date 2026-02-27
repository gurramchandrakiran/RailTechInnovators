import React, { useState } from 'react';
import './TicketActions.css';

export interface TicketActionsProps {
    onDeboard: () => Promise<void>;
    onCancel: () => Promise<void>;
    onChangeBoarding: () => Promise<void>;
}

// Inline SVGs for no-dependency icons
const LogoutIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
);

const CancelIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
);

const LocationIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
    </svg>
);

const Spinner = () => (
    <svg className="action-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </svg>
);

export const TicketActions: React.FC<TicketActionsProps> = ({
    onDeboard,
    onCancel,
    onChangeBoarding
}) => {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'deboard' | 'cancel' | 'change' | null;
    }>({ isOpen: false, type: null });

    const handleActionClick = (type: 'deboard' | 'cancel' | 'change') => {
        if (type === 'change') {
            onChangeBoarding();
        } else {
            setConfirmModal({ isOpen: true, type });
        }
    };

    const closeModal = () => {
        if (loadingAction === null) {
            setConfirmModal({ isOpen: false, type: null });
        }
    };

    const executeAction = async () => {
        const { type } = confirmModal;
        if (!type) return;

        setLoadingAction(type);
        try {
            if (type === 'deboard') await onDeboard();
            else if (type === 'cancel') await onCancel();
            else if (type === 'change') await onChangeBoarding();

            setConfirmModal({ isOpen: false, type: null });
        } catch (error) {
            console.error("Action failed:", error);
        } finally {
            setLoadingAction(null);
        }
    };

    const getModalContent = () => {
        switch (confirmModal.type) {
            case 'deboard':
                return {
                    title: 'Confirm Deboarding',
                    body: 'Are you sure you want to report leaving early? Your berth will be made available for other passengers to upgrade.',
                    btnClass: 'btn-warning',
                    btnText: 'Yes, Report Deboarding'
                };
            case 'cancel':
                return {
                    title: 'Confirm Cancellation',
                    body: 'Are you sure you want to cancel your ticket? This action cannot be undone.',
                    btnClass: 'btn-danger',
                    btnText: 'Yes, Cancel Ticket'
                };
            case 'change':
                return {
                    title: 'Change Boarding Station',
                    body: 'Do you want to change your boarding station? You can only select a forward station along your existing route.',
                    btnClass: 'btn-primary',
                    btnText: 'Yes, Change Station'
                };
            default:
                return { title: '', body: '', btnClass: '', btnText: '' };
        }
    };

    const modalContent = getModalContent();

    return (
        <div className="ticket-actions-container">
            <div className="ticket-actions-grid">
                {/* Card 1: Leaving Early */}
                <div className="ticket-action-card border-warning">
                    <div className="card-icon-wrapper bg-warning-light text-warning">
                        <LogoutIcon />
                    </div>
                    <h3 className="ticket-action-title">Leaving Early?</h3>
                    <p className="ticket-action-desc">
                        If you've left the train before your destination, report it here. Your berth will be made available for other passengers to upgrade.
                    </p>
                    <button
                        className="ticket-action-btn btn-warning"
                        onClick={() => handleActionClick('deboard')}
                        disabled={loadingAction !== null}
                    >
                        {loadingAction === 'deboard' ? <Spinner /> : 'REPORT DEBOARDING'}
                    </button>
                </div>

                {/* Card 2: Cancel Ticket */}
                <div className="ticket-action-card border-danger">
                    <div className="card-icon-wrapper bg-danger-light text-danger">
                        <CancelIcon />
                    </div>
                    <h3 className="ticket-action-title">Cancel Ticket?</h3>
                    <p className="ticket-action-desc">
                        Need to cancel your journey? Your berth will be freed for other passengers to upgrade.
                    </p>
                    <button
                        className="ticket-action-btn btn-danger"
                        onClick={() => handleActionClick('cancel')}
                        disabled={loadingAction !== null}
                    >
                        {loadingAction === 'cancel' ? <Spinner /> : 'CANCEL TICKET'}
                    </button>
                </div>

                {/* Card 3: Change Boarding Station */}
                <div className="ticket-action-card border-primary">
                    <div className="card-icon-wrapper bg-primary-light text-primary">
                        <LocationIcon />
                    </div>
                    <h3 className="ticket-action-title">Change Boarding Station?</h3>
                    <p className="ticket-action-desc">
                        Need to board from a different station? Change to a forward station along your route.
                    </p>
                    <button
                        className="ticket-action-btn btn-primary"
                        onClick={() => handleActionClick('change')}
                        disabled={loadingAction !== null}
                    >
                        {loadingAction === 'change' ? <Spinner /> : 'CHANGE STATION'}
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmModal.isOpen && (
                <div className="ticket-modal-overlay" onClick={closeModal}>
                    <div className="ticket-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="ticket-modal-title">{modalContent.title}</h2>
                        <p className="ticket-modal-body">{modalContent.body}</p>
                        <div className="ticket-modal-actions">
                            <button
                                className="ticket-modal-btn ticket-modal-btn-cancel"
                                onClick={closeModal}
                                disabled={loadingAction !== null}
                            >
                                Cancel
                            </button>
                            <button
                                className={`ticket-modal-btn ${modalContent.btnClass}`}
                                onClick={executeAction}
                                disabled={loadingAction !== null}
                            >
                                {loadingAction !== null ? <Spinner /> : modalContent.btnText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TicketActions;
