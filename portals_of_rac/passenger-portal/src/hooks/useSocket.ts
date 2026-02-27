// passenger-portal/src/hooks/useSocket.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import SOCKET_CONFIG from '../config/socketConfig';
import { WS_EVENTS } from '../constants';

interface SocketOptions {
    autoConnect?: boolean;
    onConnect?: () => void;
    onDisconnect?: (event: CloseEvent) => void;
    onError?: (error: Error) => void;
    onMessage?: (data: WebSocketMessage) => void;
}

interface WebSocketMessage {
    type: string;
    payload?: unknown;
}

interface UseSocketReturn {
    isConnected: boolean;
    isConnecting: boolean;
    error: Error | null;
    reconnectAttempts: number;
    connect: () => void;
    disconnect: () => void;
    send: (type: string, payload?: unknown) => void;
    emit: (eventType: string, payload?: unknown) => void;
    on: (eventType: string, callback: (payload: unknown) => void) => () => void;
    off: (eventType: string, callback: (payload: unknown) => void) => void;
    socket: WebSocket | null;
}

type ListenerCallback = (payload: unknown) => void;

/**
 * Custom hook for WebSocket connection management
 * Handles connection, reconnection, and event subscriptions
 */
const useSocket = (pnr: string | null | undefined, options: SocketOptions = {}): UseSocketReturn => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const listenersRef = useRef<Map<string, Set<ListenerCallback>>>(new Map());

    const {
        autoConnect = true,
        onConnect,
        onDisconnect,
        onError,
        onMessage
    } = options;

    /**
     * Calculate reconnection delay with exponential backoff
     */
    const getReconnectDelay = useCallback(() => {
        const { delay, maxDelay, backoffMultiplier } = SOCKET_CONFIG.reconnection;
        const exponentialDelay = delay * Math.pow(backoffMultiplier, reconnectAttempts);
        return Math.min(exponentialDelay, maxDelay);
    }, [reconnectAttempts]);

    /**
     * Start heartbeat/ping mechanism
     */
    const startHeartbeat = useCallback(() => {
        if (!SOCKET_CONFIG.heartbeat.enabled) return;

        heartbeatIntervalRef.current = setInterval(() => {
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                try {
                    socketRef.current.send(JSON.stringify({ type: WS_EVENTS.PING }));
                } catch (err) {
                    console.error('Failed to send heartbeat:', err);
                }
            }
        }, SOCKET_CONFIG.heartbeat.interval);
    }, []);

    /**
     * Stop heartbeat
     */
    const stopHeartbeat = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    }, []);

    /**
     * Handle incoming WebSocket messages
     */
    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const data: WebSocketMessage = JSON.parse(event.data);
            const { type, payload } = data;

            // Multi-train filter: passengers only process events for their train
            const passengerTrainNo = localStorage.getItem('trainNo');
            if ((data as any).trainNo && passengerTrainNo && String((data as any).trainNo) !== String(passengerTrainNo)) {
                return; // Ignore events for other trains
            }

            // Call global message handler
            if (onMessage) {
                onMessage(data);
            }

            // Call specific event listeners
            const listeners = listenersRef.current.get(type);
            if (listeners) {
                listeners.forEach(listener => listener(payload));
            }

            // Handle pong response
            if (type === WS_EVENTS.PONG) {
                // Update last pong time if needed
            }
        } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
        }
    }, [onMessage]);

    /**
     * Handle WebSocket connection open
     */
    const handleOpen = useCallback(() => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        setReconnectAttempts(0);

        // Subscribe to offers for this PNR
        if (pnr && socketRef.current) {
            try {
                socketRef.current.send(JSON.stringify({
                    type: WS_EVENTS.SUBSCRIBE_OFFERS,
                    payload: { pnr }
                }));
            } catch (err) {
                console.error('Failed to subscribe to offers:', err);
            }
        }

        // Start heartbeat
        startHeartbeat();

        // Call user's onConnect handler
        if (onConnect) {
            onConnect();
        }
    }, [pnr, onConnect, startHeartbeat]);

    /**
     * Handle WebSocket connection close
     */
    const handleClose = useCallback((event: CloseEvent) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);

        // Stop heartbeat
        stopHeartbeat();

        // Call user's onDisconnect handler
        if (onDisconnect) {
            onDisconnect(event);
        }

        // Attempt reconnection if enabled
        if (SOCKET_CONFIG.reconnection.enabled &&
            reconnectAttempts < SOCKET_CONFIG.reconnection.maxAttempts) {

            const delay = getReconnectDelay();
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${SOCKET_CONFIG.reconnection.maxAttempts})`);

            reconnectTimeoutRef.current = setTimeout(() => {
                setReconnectAttempts(prev => prev + 1);
                connect();
            }, delay);
        } else if (reconnectAttempts >= SOCKET_CONFIG.reconnection.maxAttempts) {
            setError(new Error('Max reconnection attempts reached'));
        }
    }, [reconnectAttempts, onDisconnect, stopHeartbeat, getReconnectDelay]);

    /**
     * Handle WebSocket errors
     */
    const handleError = useCallback((_event: Event) => {
        console.error('WebSocket error');
        const error = new Error('WebSocket connection error');
        setError(error);

        if (onError) {
            onError(error);
        }
    }, [onError]);

    /**
     * Connect to WebSocket server
     */
    const connect = useCallback(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN ||
            socketRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const ws = new WebSocket(SOCKET_CONFIG.url);

            ws.onopen = handleOpen;
            ws.onclose = handleClose;
            ws.onerror = handleError;
            ws.onmessage = handleMessage;

            socketRef.current = ws;
        } catch (err) {
            console.error('Failed to create WebSocket:', err);
            setError(err as Error);
            setIsConnecting(false);
        }
    }, [handleOpen, handleClose, handleError, handleMessage]);

    /**
     * Disconnect from WebSocket server
     */
    const disconnect = useCallback(() => {
        // Clear reconnection timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        // Stop heartbeat
        stopHeartbeat();

        // Close socket and cleanup
        if (socketRef.current) {
            try {
                // Unsubscribe from offers
                if (pnr) {
                    try {
                        socketRef.current.send(JSON.stringify({
                            type: WS_EVENTS.UNSUBSCRIBE_OFFERS,
                            payload: { pnr }
                        }));
                    } catch (err) {
                        // Ignore errors when unsubscribing
                    }
                }

                // Remove all event listeners
                socketRef.current.onopen = null;
                socketRef.current.onclose = null;
                socketRef.current.onerror = null;
                socketRef.current.onmessage = null;

                // Close connection
                if (socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.close(1000, 'Client disconnect');
                }
            } catch (err) {
                console.error('Error during disconnect:', err);
            } finally {
                socketRef.current = null;
            }
        }

        // Clear listeners
        listenersRef.current.clear();

        setIsConnected(false);
        setIsConnecting(false);
        setReconnectAttempts(0);
    }, [pnr, stopHeartbeat]);

    /**
     * Send message through WebSocket
     */
    const send = useCallback((type: string, payload?: unknown) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        try {
            socketRef.current.send(JSON.stringify({ type, payload }));
        } catch (err) {
            console.error('Failed to send message:', err);
            throw err;
        }
    }, []);

    /**
     * Subscribe to specific event
     */
    const on = useCallback((eventType: string, callback: ListenerCallback): (() => void) => {
        if (!listenersRef.current.has(eventType)) {
            listenersRef.current.set(eventType, new Set());
        }
        listenersRef.current.get(eventType)!.add(callback);

        // Return unsubscribe function
        return () => {
            const listeners = listenersRef.current.get(eventType);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    listenersRef.current.delete(eventType);
                }
            }
        };
    }, []);

    /**
     * Unsubscribe from specific event
     */
    const off = useCallback((eventType: string, callback: ListenerCallback) => {
        const listeners = listenersRef.current.get(eventType);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                listenersRef.current.delete(eventType);
            }
        }
    }, []);

    /**
     * Emit event (alias for send)
     */
    const emit = useCallback((eventType: string, payload?: unknown) => {
        send(eventType, payload);
    }, [send]);

    // Auto-connect on mount if enabled
    useEffect(() => {
        if (autoConnect && pnr) {
            connect();
        }

        // Cleanup on unmount
        return () => {
            disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pnr]); // Only reconnect if PNR changes

    return {
        // State
        isConnected,
        isConnecting,
        error,
        reconnectAttempts,

        // Methods
        connect,
        disconnect,
        send,
        emit,
        on,
        off,

        // WebSocket instance (for advanced use)
        socket: socketRef.current
    };
};

export default useSocket;
