// passenger-portal/src/config/socketConfig.ts

interface ReconnectionConfig {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

interface HeartbeatConfig {
    enabled: boolean;
    interval: number;
    timeout: number;
}

interface SocketEvents {
    SUBSCRIBE_OFFERS: string;
    UNSUBSCRIBE_OFFERS: string;
    PING: string;
    NEW_OFFER: string;
    OFFER_EXPIRED: string;
    OFFER_ACCEPTED: string;
    OFFER_DENIED: string;
    ALLOCATION_CONFIRMED: string;
    BOARDING_STATUS_UPDATE: string;
    TRAIN_UPDATE: string;
    PONG: string;
    CONNECT: string;
    DISCONNECT: string;
    RECONNECT: string;
    ERROR: string;
}

interface MessageTypes {
    OFFER: string;
    STATUS_UPDATE: string;
    NOTIFICATION: string;
    ERROR: string;
}

interface QueueConfig {
    maxSize: number;
    storageKey: string;
    syncInterval: number;
}

interface StorageKeys {
    OFFERS: string;
    USER_SESSION: string;
    BOARDING_STATUS: string;
    RETRY_QUEUE: string;
}

interface SocketConfig {
    url: string;
    reconnection: ReconnectionConfig;
    timeout: number;
    heartbeat: HeartbeatConfig;
    events: SocketEvents;
    messageTypes: MessageTypes;
    offerTTL: number;
    expiryWarningThreshold: number;
    queue: QueueConfig;
    storageKeys: StorageKeys;
}

const SOCKET_CONFIG: SocketConfig = {
    // WebSocket server URL
    url: import.meta.env.VITE_WS_URL || 'ws://localhost:5000',

    // Reconnection settings
    reconnection: {
        enabled: true,
        maxAttempts: 5,
        delay: 3000, // 3 seconds
        maxDelay: 30000, // 30 seconds
        backoffMultiplier: 1.5
    },

    // Connection timeout
    timeout: 10000, // 10 seconds

    // Heartbeat/ping settings
    heartbeat: {
        enabled: true,
        interval: 30000, // 30 seconds
        timeout: 5000 // 5 seconds
    },

    // Event names
    events: {
        // Client -> Server
        SUBSCRIBE_OFFERS: 'subscribe:offers',
        UNSUBSCRIBE_OFFERS: 'unsubscribe:offers',
        PING: 'ping',

        // Server -> Client
        NEW_OFFER: 'upgrade:offer',
        OFFER_EXPIRED: 'upgrade:expired',
        OFFER_ACCEPTED: 'upgrade:accepted',
        OFFER_DENIED: 'upgrade:denied',
        ALLOCATION_CONFIRMED: 'upgrade:confirmed',
        BOARDING_STATUS_UPDATE: 'passenger:boarding_status',
        TRAIN_UPDATE: 'train:update',
        PONG: 'pong',

        // Connection events
        CONNECT: 'connect',
        DISCONNECT: 'disconnect',
        RECONNECT: 'reconnect',
        ERROR: 'error'
    },

    // Message types
    messageTypes: {
        OFFER: 'OFFER',
        STATUS_UPDATE: 'STATUS_UPDATE',
        NOTIFICATION: 'NOTIFICATION',
        ERROR: 'ERROR'
    },

    // Offer TTL (Time To Live)
    offerTTL: 60000, // 60 seconds

    // Auto-accept timeout warning threshold
    expiryWarningThreshold: 15000, // Show warning when 15 seconds left

    // Queue settings for offline mode
    queue: {
        maxSize: 50,
        storageKey: 'passenger_portal_queue',
        syncInterval: 5000 // Try to sync every 5 seconds when online
    },

    // Storage keys
    storageKeys: {
        OFFERS: 'passenger_offers',
        USER_SESSION: 'passenger_session',
        BOARDING_STATUS: 'passenger_boarding_status',
        RETRY_QUEUE: 'passenger_retry_queue'
    }
};

export default SOCKET_CONFIG;
