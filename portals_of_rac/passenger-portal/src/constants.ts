// passenger-portal/src/constants.ts

// API Base URL
export const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const WS_BASE_URL: string = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

// PNR Status Types
export const PNR_STATUS = {
    CONFIRMED: 'CNF',
    RAC: 'RAC',
    WAITING_LIST: 'WL',
    CANCELLED: 'CAN'
} as const;

export type PnrStatusType = typeof PNR_STATUS[keyof typeof PNR_STATUS];

// Boarding Status
export const BOARDING_STATUS = {
    BOARDED: 'BOARDED',
    NOT_BOARDED: 'NOT_BOARDED',
    DEBOARDED: 'DEBOARDED',
    NO_SHOW: 'NO_SHOW'
} as const;

export type BoardingStatusType = typeof BOARDING_STATUS[keyof typeof BOARDING_STATUS];

// Online Status
export const ONLINE_STATUS = {
    ONLINE: 'online',
    OFFLINE: 'offline'
} as const;

// Upgrade Offer Status
export const OFFER_STATUS = {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    DENIED: 'DENIED',
    EXPIRED: 'EXPIRED',
    CONFIRMED: 'CONFIRMED',
    REJECTED: 'REJECTED'
} as const;

export type OfferStatusType = typeof OFFER_STATUS[keyof typeof OFFER_STATUS];

// Notification Types
export const NOTIFICATION_TYPE = {
    OFFER: 'OFFER',
    CONFIRMATION: 'CONFIRMATION',
    REJECTION: 'REJECTION',
    EXPIRY: 'EXPIRY',
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR'
} as const;

// Berth Types
export const BERTH_TYPE = {
    LOWER: 'LB',
    MIDDLE: 'MB',
    UPPER: 'UB',
    SIDE_LOWER: 'SL',
    SIDE_UPPER: 'SU'
} as const;

// Coach Classes
export const COACH_CLASS = {
    SLEEPER: 'SL',
    THREE_TIER_AC: 'AC_3_Tier',
    TWO_TIER_AC: '2A',
    FIRST_AC: '1A'
} as const;

// Gender
export const GENDER = {
    MALE: 'M',
    FEMALE: 'F',
    OTHER: 'O'
} as const;

// Quota Types
export const QUOTA = {
    GENERAL: 'GN',
    TATKAL: 'TQ',
    LADIES: 'LD',
    SENIOR_CITIZEN: 'SS',
    LOWER_BERTH: 'LB',
    PHYSICALLY_HANDICAPPED: 'HP'
} as const;

// WebSocket Events
export const WS_EVENTS = {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    RECONNECT: 'reconnect',
    ERROR: 'error',

    // Subscription
    SUBSCRIBE_OFFERS: 'subscribe:offers',
    UNSUBSCRIBE_OFFERS: 'unsubscribe:offers',

    // Upgrade offers
    NEW_OFFER: 'upgrade:offer',
    OFFER_EXPIRED: 'upgrade:expired',
    OFFER_ACCEPTED: 'upgrade:accepted',
    OFFER_DENIED: 'upgrade:denied',
    ALLOCATION_CONFIRMED: 'upgrade:confirmed',
    ALLOCATION_REJECTED: 'upgrade:rejected',

    // Status updates
    BOARDING_STATUS_UPDATE: 'passenger:boarding_status',
    PNR_STATUS_UPDATE: 'passenger:pnr_status',
    TRAIN_UPDATE: 'train:update',
    STATION_ARRIVAL: 'train:station_arrival',

    // Heartbeat
    PING: 'ping',
    PONG: 'pong'
} as const;

// Response Messages
export const RESPONSE_MESSAGES = {
    SUCCESS: {
        OFFER_ACCEPTED: 'Upgrade offer accepted successfully! Waiting for TTE confirmation.',
        OFFER_DENIED: 'Upgrade offer declined.',
        BOOKING_CANCELLED: 'Booking cancelled successfully.',
        DATA_SYNCED: 'Data synchronized successfully.'
    },
    ERROR: {
        PNR_NOT_FOUND: 'PNR not found. Please check and try again.',
        INVALID_PNR: 'Invalid PNR format. Please enter a valid 10-digit PNR.',
        NOT_BOARDED: 'You must be boarded to receive upgrade offers.',
        NETWORK_ERROR: 'Network error. Please check your connection and try again.',
        OFFER_EXPIRED: 'This offer has expired.',
        OFFER_NOT_AVAILABLE: 'This offer is no longer available.',
        SERVER_ERROR: 'Server error. Please try again later.',
        UNAUTHORIZED: 'You are not authorized to perform this action.',
        ALREADY_PROCESSED: 'This offer has already been processed.'
    },
    WARNING: {
        OFFER_EXPIRING_SOON: 'This offer will expire soon!',
        OFFLINE_MODE: 'You are in offline mode. Actions will be synced when online.',
        RECONNECTING: 'Connection lost. Reconnecting...'
    },
    INFO: {
        NO_OFFERS: 'No upgrade offers available at the moment.',
        CHECKING_STATUS: 'Checking your PNR status...',
        WAITING_CONFIRMATION: 'Waiting for TTE confirmation...'
    }
} as const;

// Offer TTL (Time to Live) in milliseconds
export const OFFER_TTL: number = 60000; // 60 seconds

// Expiry warning threshold
export const EXPIRY_WARNING_THRESHOLD: number = 15000; // 15 seconds

// Polling intervals (for fallback when WebSocket is unavailable)
export const POLLING_INTERVALS = {
    OFFERS: 10000, // 10 seconds
    STATUS: 30000, // 30 seconds
    BOARDING: 5000  // 5 seconds when near boarding time
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
    USER_SESSION: 'passenger_session',
    LAST_PNR: 'passenger_last_pnr',
    OFFERS: 'passenger_offers',
    BOARDING_STATUS: 'passenger_boarding_status',
    RETRY_QUEUE: 'passenger_retry_queue',
    THEME_PREFERENCE: 'passenger_theme',
    NOTIFICATION_SETTINGS: 'passenger_notifications'
} as const;

// Session Storage Keys
export const SESSION_KEYS = {
    CURRENT_PNR: 'current_pnr',
    SEARCH_HISTORY: 'search_history'
} as const;

// Retry Configuration
export const RETRY_CONFIG = {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000, // 1 second
    MAX_DELAY: 10000, // 10 seconds
    BACKOFF_MULTIPLIER: 2
} as const;

// Pagination
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 50
} as const;

// Validation Rules
export const VALIDATION = {
    PNR: {
        MIN_LENGTH: 10,
        MAX_LENGTH: 10,
        PATTERN: /^[0-9]{10}$/
    },
    NAME: {
        MIN_LENGTH: 2,
        MAX_LENGTH: 50,
        PATTERN: /^[a-zA-Z\s]+$/
    }
} as const;

// Date/Time Formats
export const DATE_FORMATS = {
    DISPLAY: 'DD MMM YYYY',
    DISPLAY_WITH_TIME: 'DD MMM YYYY, hh:mm A',
    TIME_ONLY: 'hh:mm A',
    ISO: 'YYYY-MM-DD',
    ISO_WITH_TIME: 'YYYY-MM-DD HH:mm:ss'
} as const;

// UI Constants
export const UI = {
    DEBOUNCE_DELAY: 300, // milliseconds
    TOAST_DURATION: 3000, // 3 seconds
    MODAL_TRANSITION: 300, // milliseconds
    ANIMATION_DURATION: 200 // milliseconds
} as const;

// Status Colors (for MUI Chip components)
export const STATUS_COLORS: Record<string, string> = {
    [PNR_STATUS.CONFIRMED]: 'success',
    [PNR_STATUS.RAC]: 'warning',
    [PNR_STATUS.WAITING_LIST]: 'error',
    [PNR_STATUS.CANCELLED]: 'default',
    [OFFER_STATUS.PENDING]: 'warning',
    [OFFER_STATUS.ACCEPTED]: 'info',
    [OFFER_STATUS.CONFIRMED]: 'success',
    [OFFER_STATUS.DENIED]: 'default',
    [OFFER_STATUS.REJECTED]: 'error',
    [OFFER_STATUS.EXPIRED]: 'default'
};

// Error Codes
export const ERROR_CODES = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    SERVER_ERROR: 'SERVER_ERROR',
    TIMEOUT: 'TIMEOUT',
    ALREADY_PROCESSED: 'ALREADY_PROCESSED'
} as const;

// Feature Flags (can be controlled via environment variables)
export const FEATURES = {
    WEBSOCKET_ENABLED: true,
    OFFLINE_MODE_ENABLED: true,
    PUSH_NOTIFICATIONS_ENABLED: false,
    SERVICE_WORKER_ENABLED: false,
    AUTO_REFRESH_ENABLED: true
} as const;

// App Metadata
export const APP_INFO = {
    NAME: 'Indian Railways - Passenger Portal',
    VERSION: '1.0.0',
    DESCRIPTION: 'Dynamic RAC Reallocation System - Passenger Portal'
} as const;

export default {
    API_BASE_URL,
    WS_BASE_URL,
    PNR_STATUS,
    BOARDING_STATUS,
    ONLINE_STATUS,
    OFFER_STATUS,
    NOTIFICATION_TYPE,
    BERTH_TYPE,
    COACH_CLASS,
    GENDER,
    QUOTA,
    WS_EVENTS,
    RESPONSE_MESSAGES,
    OFFER_TTL,
    EXPIRY_WARNING_THRESHOLD,
    POLLING_INTERVALS,
    STORAGE_KEYS,
    SESSION_KEYS,
    RETRY_CONFIG,
    PAGINATION,
    VALIDATION,
    DATE_FORMATS,
    UI,
    STATUS_COLORS,
    ERROR_CODES,
    FEATURES,
    APP_INFO
};
