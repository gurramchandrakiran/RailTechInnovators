// tte-portal/src/hooks/useTteSocket.ts

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

interface LastUpdate {
    type: string;
    payload: any;
    timestamp: Date;
}

interface Stats {
    total?: number;
    boarded?: number;
    noShow?: number;
    [key: string]: any;
}

interface PendingUpgrade {
    pnr: string;
    name?: string;
    berth?: string;
    [key: string]: any;
}

interface WebSocketMessage {
    type: string;
    payload?: any;
    data?: any;
    eventType?: string;
}

type EventCallback = (payload: any) => void;

interface UseTteSocketReturn {
    isConnected: boolean;
    lastUpdate: LastUpdate | null;
    pendingUpgrades: PendingUpgrade[];
    stats: Stats | null;
    connect: () => void;
    disconnect: () => void;
    on: (eventType: string, callback: EventCallback) => () => void;
    send: (type: string, payload?: any) => void;
}

/**
 * WebSocket hook for TTE Portal
 * Subscribes to train-wide updates and real-time events
 */
const useTteSocket = (): UseTteSocketReturn => {
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [lastUpdate, setLastUpdate] = useState<LastUpdate | null>(null);
    const [pendingUpgrades, setPendingUpgrades] = useState<PendingUpgrade[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);

    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());

    /**
     * Handle incoming messages
     * Backend sends: { type, data?, eventType?, timestamp }
     * - broadcast() sends flat objects with type + data fields
     * - broadcastTrainUpdate() sends { type: 'TRAIN_UPDATE', eventType, data }
     * - broadcastStatsUpdate() sends { type: 'STATS_UPDATE', data: { stats } }
     */
    const handleMessage = useCallback((msg: WebSocketMessage): void => {
        const { type, data, eventType } = msg;

        // Multi-train filter: only process events for this TTE's assigned train
        const assignedTrainNo = localStorage.getItem('trainAssigned');
        if ((msg as any).trainNo && assignedTrainNo && String((msg as any).trainNo) !== String(assignedTrainNo)) {
            return; // Ignore events for other trains
        }

        setLastUpdate({ type, payload: data, timestamp: new Date() });

        // Handle specific event types
        switch (type) {
            case 'TRAIN_UPDATE':
                // broadcastTrainUpdate sends { type: 'TRAIN_UPDATE', eventType, data }
                // Dispatch to eventType-specific listeners first, then TRAIN_UPDATE listeners
                if (eventType) {
                    const eventListeners = listenersRef.current.get(eventType);
                    if (eventListeners) {
                        eventListeners.forEach(listener => listener(data));
                    }
                }
                const trainListeners = listenersRef.current.get(type);
                if (trainListeners) {
                    trainListeners.forEach(listener => listener(data));
                }
                break;

            case 'NO_SHOW':
                console.log('📋 No-show event:', data);
                break;

            case 'RAC_UPGRADE_ACCEPTED':
                console.log('✅ Passenger accepted upgrade:', data);
                if (data) {
                    setPendingUpgrades(prev => [...prev, data]);
                }
                break;

            case 'STATS_UPDATE':
                // broadcastStatsUpdate sends { type: 'STATS_UPDATE', data: { stats } }
                if (data?.stats) {
                    setStats(data.stats);
                }
                break;

            case 'PASSENGER_BOARDED':
                console.log('🎫 Passenger boarded:', data);
                break;

            case 'PASSENGER_DEBOARDED':
                console.log('👋 Passenger deboarded:', data);
                break;

            default:
                // Pass to generic listeners (e.g. PENDING_REALLOCATIONS, RAC_UPGRADED, etc.)
                const genericListeners = listenersRef.current.get(type);
                if (genericListeners) {
                    genericListeners.forEach(listener => listener(data));
                }
        }
    }, []);

    /**
     * Connect to WebSocket
     */
    const connect = useCallback((): void => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            const ws = new WebSocket(WS_URL);

            ws.onopen = (): void => {
                console.log('✅ TTE WebSocket connected');
                setIsConnected(true);

                // Subscribe to general updates + identify as TTE
                ws.send(JSON.stringify({ type: 'SUBSCRIBE' }));
                ws.send(JSON.stringify({ type: 'IDENTIFY', role: 'TTE' }));
            };

            ws.onmessage = (event: MessageEvent): void => {
                try {
                    const data = JSON.parse(event.data);
                    handleMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.onclose = (): void => {
                console.log('❌ TTE WebSocket disconnected');
                setIsConnected(false);

                // Attempt reconnect after 3 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, 3000);
            };

            ws.onerror = (error: Event): void => {
                console.error('WebSocket error:', error);
            };

            socketRef.current = ws;
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
        }
    }, [handleMessage]);

    /**
     * Disconnect from WebSocket and cleanup
     */
    const disconnect = useCallback((): void => {
        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        // Close and cleanup socket
        if (socketRef.current) {
            try {
                // Remove all event listeners
                socketRef.current.onopen = null;
                socketRef.current.onmessage = null;
                socketRef.current.onclose = null;
                socketRef.current.onerror = null;

                // Close connection
                if (socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.close(1000, 'Component unmount');
                }
            } catch (error) {
                console.error('Error disconnecting socket:', error);
            } finally {
                socketRef.current = null;
            }
        }

        // Clear listeners map
        listenersRef.current.clear();
        setIsConnected(false);
    }, []);

    /**
     * Subscribe to event
     */
    const on = useCallback((eventType: string, callback: EventCallback): (() => void) => {
        if (!listenersRef.current.has(eventType)) {
            listenersRef.current.set(eventType, new Set());
        }
        listenersRef.current.get(eventType)!.add(callback);

        // Return unsubscribe function
        return () => {
            const listeners = listenersRef.current.get(eventType);
            if (listeners) {
                listeners.delete(callback);
            }
        };
    }, []);

    /**
     * Send message
     */
    const send = useCallback((type: string, payload?: any): void => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type, payload }));
        }
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        isConnected,
        lastUpdate,
        pendingUpgrades,
        stats,
        connect,
        disconnect,
        on,
        send
    };
};

export default useTteSocket;
