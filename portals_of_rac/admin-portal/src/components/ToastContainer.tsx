// admin-portal/src/components/ToastContainer.tsx
// Global Toast Notification Container

import React, { useState, useEffect } from 'react';
import '../styles/components/ToastContainer.css';

// Types
interface Toast {
    id: number;
    type?: string;
    icon?: string;
    title?: string;
    message?: string;
    duration?: number;
}

type NotifyFunction = (toast: Toast) => void;

// Keep track of toasts globally
let toastQueue: Toast[] = [];
let notifyFunction: NotifyFunction | null = null;

export const addToast = (toast: Omit<Toast, 'id'>): void => {
    const id = Date.now() + Math.random();
    const toastWithId = { ...toast, id };
    toastQueue.push(toastWithId);
    if (notifyFunction) {
        notifyFunction(toastWithId);
    }
};

function ToastContainer(): React.ReactElement {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        notifyFunction = (toast: Toast): void => {
            setToasts(prev => [...prev, toast]);

            const duration = toast.duration || 4000;
            setTimeout(() => {
                removeToast(toast.id);
            }, duration);
        };

        toastQueue.forEach(toast => {
            notifyFunction!(toast);
        });
        toastQueue = [];

        return () => {
            notifyFunction = null;
        };
    }, []);

    const removeToast = (id: number): void => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleClose = (id: number): void => {
        removeToast(id);
    };

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.type || 'info'}`}
                    role="alert"
                    aria-live="polite"
                >
                    <div className="toast-content">
                        <span className="toast-icon">{toast.icon}</span>
                        <div className="toast-message">
                            {toast.title && <div className="toast-title">{toast.title}</div>}
                            {toast.message && <div className="toast-text">{toast.message}</div>}
                        </div>
                    </div>
                    <button
                        className="toast-close"
                        onClick={() => handleClose(toast.id)}
                        aria-label="Close notification"
                    >
                        
                    </button>
                    {(toast.duration) && (
                        <div
                            className="toast-progress"
                            style={{ animationDuration: `${toast.duration}ms` }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

export default ToastContainer;

