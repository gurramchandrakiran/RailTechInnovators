// passenger-portal/src/utils/helpers.ts

import { VALIDATION, DATE_FORMATS } from '../constants';

// Extend Window interface for webkitAudioContext
declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

/**
 * Format PNR number with proper spacing
 */
export const formatPNR = (pnr: string | null | undefined): string => {
    if (!pnr) return '';
    const cleaned = pnr.replace(/\s/g, '');
    return cleaned.toUpperCase();
};

/**
 * Validate PNR format
 */
export const isValidPNR = (pnr: string | null | undefined): boolean => {
    if (!pnr) return false;
    const cleaned = pnr.replace(/\s/g, '');
    return VALIDATION.PNR.PATTERN.test(cleaned);
};

/**
 * Format date to readable string
 */
export const formatDate = (date: string | Date | null | undefined, format: string = DATE_FORMATS.DISPLAY): string => {
    if (!date) return '';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en', { month: 'short' });
    const year = d.getFullYear();
    const hours = String(d.getHours() % 12 || 12).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM';

    switch (format) {
        case DATE_FORMATS.DISPLAY:
            return `${day} ${month} ${year}`;
        case DATE_FORMATS.DISPLAY_WITH_TIME:
            return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
        case DATE_FORMATS.TIME_ONLY:
            return `${hours}:${minutes} ${ampm}`;
        default:
            return d.toLocaleDateString();
    }
};

/**
 * Format time string (HH:MM)
 */
export const formatTime = (time: string | null | undefined): string => {
    if (!time) return '';

    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return time;

    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * Get time remaining in human-readable format
 */
export const getTimeRemaining = (milliseconds: number): string => {
    if (milliseconds <= 0) return 'Expired';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
};

/**
 * Calculate countdown timer
 */
export const calculateTimeRemaining = (expiryTime: Date | string | number): number => {
    const expiry = typeof expiryTime === 'number' ? expiryTime : new Date(expiryTime).getTime();
    const now = Date.now();
    return Math.max(0, expiry - now);
};

/**
 * Check if offer is expiring soon
 */
export const isExpiringSoon = (timeRemaining: number, threshold: number = 15000): boolean => {
    return timeRemaining > 0 && timeRemaining <= threshold;
};

/**
 * Sanitize input string
 */
export const sanitizeInput = (input: string | null | undefined): string => {
    if (!input) return '';
    return input.trim().replace(/[<>]/g, '');
};

/**
 * Get status display text
 */
export const getStatusDisplayText = (status: string): string => {
    const statusMap: Record<string, string> = {
        'CNF': 'Confirmed',
        'RAC': 'RAC',
        'WL': 'Waiting List',
        'CAN': 'Cancelled',
        'PENDING': 'Pending',
        'ACCEPTED': 'Accepted',
        'DENIED': 'Denied',
        'EXPIRED': 'Expired',
        'CONFIRMED': 'Confirmed',
        'REJECTED': 'Rejected'
    };

    return statusMap[status] || status;
};

/**
 * Get berth type display name
 */
export const getBerthTypeDisplayName = (berthType: string): string => {
    const berthMap: Record<string, string> = {
        'LB': 'Lower Berth',
        'MB': 'Middle Berth',
        'UB': 'Upper Berth',
        'SL': 'Side Lower',
        'SU': 'Side Upper'
    };

    return berthMap[berthType] || berthType;
};

/**
 * Get coach class display name
 */
export const getCoachClassDisplayName = (coachClass: string): string => {
    const classMap: Record<string, string> = {
        'SL': 'Sleeper',
        'AC_3_Tier': '3-Tier AC',
        '2A': '2-Tier AC',
        '1A': 'First AC'
    };

    return classMap[coachClass] || coachClass;
};

interface ParsedBerth {
    coach: string;
    berth: string;
}

/**
 * Parse berth notation (e.g., "S1-45" to coach S1, berth 45)
 */
export const parseBerthNotation = (berthNotation: string | null | undefined): ParsedBerth => {
    if (!berthNotation) return { coach: '', berth: '' };

    const match = berthNotation.match(/([A-Z]+\d+)-(\d+)/);
    if (match) {
        return {
            coach: match[1],
            berth: match[2]
        };
    }

    return { coach: berthNotation, berth: '' };
};

/**
 * Format berth notation
 */
export const formatBerthNotation = (coach: string | null | undefined, berth: number | string | null | undefined): string => {
    if (!coach || !berth) return '';
    return `${coach}-${berth}`;
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(func: T, wait: number = 300): ((...args: Parameters<T>) => void) => {
    let timeout: ReturnType<typeof setTimeout>;
    return function executedFunction(...args: Parameters<T>): void {
        const later = (): void => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(func: T, limit: number = 300): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return function (this: unknown, ...args: Parameters<T>): void {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Deep clone object
 */
export const deepClone = <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj) as unknown as T;
    if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as unknown as T;

    const clonedObj: Record<string, unknown> = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clonedObj[key] = deepClone((obj as Record<string, unknown>)[key]);
        }
    }
    return clonedObj as T;
};

/**
 * Generate unique ID
 */
export const generateUniqueId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if object is empty
 */
export const isEmptyObject = (obj: object): boolean => {
    return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
};

interface StorageHelper {
    get: <T>(key: string, defaultValue?: T | null) => T | null;
    set: (key: string, value: unknown) => boolean;
    remove: (key: string) => boolean;
    clear: () => boolean;
}

/**
 * Local storage helpers with error handling
 */
export const storage: StorageHelper = {
    get: <T>(key: string, defaultValue: T | null = null): T | null => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Error reading from localStorage: ${key}`, error);
            return defaultValue;
        }
    },

    set: (key: string, value: unknown): boolean => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing to localStorage: ${key}`, error);
            return false;
        }
    },

    remove: (key: string): boolean => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing from localStorage: ${key}`, error);
            return false;
        }
    },

    clear: (): boolean => {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing localStorage', error);
            return false;
        }
    }
};

interface SessionStorageHelper {
    get: <T>(key: string, defaultValue?: T | null) => T | null;
    set: (key: string, value: unknown) => boolean;
    remove: (key: string) => boolean;
}

/**
 * Session storage helpers
 */
export const sessionStorageHelper: SessionStorageHelper = {
    get: <T>(key: string, defaultValue: T | null = null): T | null => {
        try {
            const item = window.sessionStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Error reading from sessionStorage: ${key}`, error);
            return defaultValue;
        }
    },

    set: (key: string, value: unknown): boolean => {
        try {
            window.sessionStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing to sessionStorage: ${key}`, error);
            return false;
        }
    },

    remove: (key: string): boolean => {
        try {
            window.sessionStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing from sessionStorage: ${key}`, error);
            return false;
        }
    }
};

/**
 * Check network status
 */
export const isOnline = (): boolean => {
    return navigator.onLine;
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    } catch (error) {
        console.error('Failed to copy to clipboard', error);
        return false;
    }
};

/**
 * Play notification sound
 */
export const playNotificationSound = (soundType: 'success' | 'warning' | 'error' = 'success'): void => {
    // Create audio context and play notification sound
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const frequencies: Record<string, number> = {
            success: 800,
            warning: 600,
            error: 400
        };

        oscillator.frequency.value = frequencies[soundType] || 600;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        // Silently fail if audio is not supported
        console.debug('Audio notification not available');
    }
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
};

/**
 * Show browser notification
 */
export const showNotification = (title: string, options: NotificationOptions = {}): void => {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            icon: '/favicon.ico',
            badge: '/badge.png',
            ...options
        });
    }
};

export default {
    formatPNR,
    isValidPNR,
    formatDate,
    formatTime,
    getTimeRemaining,
    calculateTimeRemaining,
    isExpiringSoon,
    sanitizeInput,
    getStatusDisplayText,
    getBerthTypeDisplayName,
    getCoachClassDisplayName,
    parseBerthNotation,
    formatBerthNotation,
    debounce,
    throttle,
    deepClone,
    generateUniqueId,
    isEmptyObject,
    storage,
    sessionStorage: sessionStorageHelper,
    isOnline,
    copyToClipboard,
    playNotificationSound,
    requestNotificationPermission,
    showNotification
};
