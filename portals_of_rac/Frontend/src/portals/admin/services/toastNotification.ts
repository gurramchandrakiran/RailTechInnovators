/**
 * toastNotification.ts (Frontend)
 * Toast notification utility for React applications
 */

import { addToast } from '../components/ToastContainer';

// Types
export interface Toast {
    id: string;
    message: string;
    title: string | null;
    type: ToastType;
    duration: number | null;
    icon: string;
    timestamp: Date;
    isClosable: boolean;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'upgrade-offer' | 'no-show';

// Toast types and severity levels
export const TOAST_TYPES: Record<string, ToastType> = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    UPGRADE_OFFER: 'upgrade-offer',
    NO_SHOW: 'no-show'
};

export const TOAST_DURATION: Record<string, number | null> = {
    SHORT: 2000,
    MEDIUM: 4000,
    LONG: 6000,
    PERSISTENT: null
};

const TOAST_ICONS: Record<ToastType, string> = {
    'success': '✅',
    'error': '❌',
    'warning': '⚠️',
    'info': 'ℹ️',
    'upgrade-offer': '✅',
    'no-show': '❌'
};

let _toastCounter = 0;

/**
 * Toast notification object structure
 */
export const createToast = (
    message: string,
    type: ToastType = 'info',
    duration: number | null = TOAST_DURATION.MEDIUM,
    title: string | null = null
): Toast => {
    const toast: Toast = {
        id: `toast-${++_toastCounter}`,
        message,
        title,
        type,
        duration,
        icon: TOAST_ICONS[type] || 'ℹ️',
        timestamp: new Date(),
        isClosable: true
    };

    if (typeof addToast === 'function') {
        addToast(toast);
    }

    return toast;
};

export const successToast = (message: string, title: string | null = null, duration: number | null = TOAST_DURATION.SHORT): Toast => {
    return createToast(message, 'success', duration, title);
};

export const errorToast = (message: string, title: string | null = null, duration: number | null = TOAST_DURATION.LONG): Toast => {
    return createToast(message, 'error', duration, title);
};

export const warningToast = (message: string, title: string | null = null, duration: number | null = TOAST_DURATION.MEDIUM): Toast => {
    return createToast(message, 'warning', duration, title);
};

export const infoToast = (message: string, title: string | null = null, duration: number | null = TOAST_DURATION.MEDIUM): Toast => {
    return createToast(message, 'info', duration, title);
};

export const upgradeOfferToast = (passengerName: string, offerDetails: string | { berth?: string }): Toast => {
    const title = `Upgrade Offer for ${passengerName}`;
    const message = typeof offerDetails === 'string'
        ? offerDetails
        : `New berth: ${offerDetails?.berth || 'TBD'}`;
    return createToast(message, 'upgrade-offer', TOAST_DURATION.PERSISTENT, title);
};

export const noShowToast = (passengerName: string, pnr: string): Toast => {
    const title = 'No-Show Marked';
    const message = `${passengerName} (${pnr}) marked as NO-SHOW`;
    return createToast(message, 'no-show', TOAST_DURATION.MEDIUM, title);
};

export const upgradeConfirmationToast = (passengerName: string, newBerth: string): Toast => {
    const title = 'Upgrade Confirmed';
    const message = `${passengerName} upgraded to berth ${newBerth}`;
    return createToast(message, 'success', TOAST_DURATION.SHORT, title);
};

export const reallocationErrorToast = (error?: string): Toast => {
    const message = error || 'Unable to process reallocation';
    return createToast(message, 'error', TOAST_DURATION.LONG, 'Reallocation Error');
};

export const networkErrorToast = (): Toast => {
    const message = 'Check your internet connection';
    return createToast(message, 'error', TOAST_DURATION.LONG, 'Network Error');
};

export const serverErrorToast = (): Toast => {
    const message = 'The server encountered an error. Please try again later.';
    return createToast(message, 'error', TOAST_DURATION.LONG, 'Server Error');
};

export const validationErrorToast = (fieldName: string = 'Input'): Toast => {
    const message = `Please check your ${fieldName.toLowerCase()} and try again.`;
    return createToast(message, 'warning', TOAST_DURATION.MEDIUM, `Invalid ${fieldName}`);
};

export const webSocketConnectedToast = (): Toast => {
    const message = 'Connected to real-time updates';
    return createToast(message, 'success', TOAST_DURATION.SHORT, 'Connected');
};

export const webSocketDisconnectedToast = (): Toast => {
    const message = 'Disconnected from real-time updates';
    return createToast(message, 'warning', TOAST_DURATION.MEDIUM, 'Disconnected');
};

export const actionToasts = {
    LOADING: (action: string): Toast => createToast(`${action}...`, 'info', TOAST_DURATION.LONG, 'Loading'),
    SUCCESS: (action: string): Toast => successToast(`${action} completed successfully`, 'Success'),
    FAILED: (action: string): Toast => errorToast(`${action} failed`, 'Failed'),
    SAVED: (): Toast => successToast('Changes saved successfully', 'Saved'),
    DISCARDED: (): Toast => infoToast('Changes discarded', 'Discarded'),
    COPIED: (): Toast => successToast('Copied to clipboard', 'Copied'),
    DELETED: (): Toast => successToast('Deleted successfully', 'Deleted')
};

const notificationModule = {
    TOAST_TYPES,
    TOAST_DURATION,
    createToast,
    successToast,
    errorToast,
    warningToast,
    infoToast,
    upgradeOfferToast,
    noShowToast,
    upgradeConfirmationToast,
    reallocationErrorToast,
    networkErrorToast,
    serverErrorToast,
    validationErrorToast,
    webSocketConnectedToast,
    webSocketDisconnectedToast,
    actionToasts
};

export default notificationModule;
