// admin-portal/src/services/websocket.ts

type EventCallback = (data?: any) => void;

interface WebSocketMessage {
    type: string;
    data?: any;
    [key: string]: any;
}

class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 3000;
    private listeners: { [event: string]: EventCallback[] } = {};
    private connected: boolean = false;
    private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

    /**
     * Connect to WebSocket server
     */
    connect(url: string = (import.meta.env.VITE_WS_URL || 'ws://localhost:5000')): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        console.log(` Connecting to WebSocket: ${url}`);

        this.ws = new WebSocket(url);

        this.ws.onopen = (): void => {
            console.log('✅ WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');

            this.send({ type: 'SUBSCRIBE' });
            this.send({ type: 'IDENTIFY', role: 'ADMIN' });
        };

        this.ws.onmessage = (event: MessageEvent): void => {
            try {
                const data: WebSocketMessage = JSON.parse(event.data);
                console.log(' WebSocket message:', data.type);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onerror = (error: Event): void => {
            console.error('❌ WebSocket error:', error);
            this.emit('error', error);
        };

        this.ws.onclose = (): void => {
            console.log(' WebSocket disconnected');
            this.connected = false;
            this.emit('disconnected');

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`🔄 Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.reconnectTimeoutId = setTimeout(() => this.connect(url), this.reconnectDelay);
            } else {
                console.error('❌ Max reconnection attempts reached');
                this.emit('max_reconnect_reached');
                this.ws = null;
            }
        };
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(data: WebSocketMessage): void {
        switch (data.type) {
            case 'CONNECTION_SUCCESS':
                this.emit('connection_success', data);
                break;
            case 'TRAIN_UPDATE':
                this.emit('train_update', data);
                break;
            case 'STATION_ARRIVAL':
                this.emit('station_arrival', data);
                break;
            case 'RAC_REALLOCATION':
                this.emit('rac_reallocation', data);
                break;
            case 'NO_SHOW':
                this.emit('no_show', data);
                break;
            case 'STATS_UPDATE':
                this.emit('stats_update', data);
                break;
            case 'SUBSCRIBED':
                console.log('✅ Subscribed to updates');
                break;
            case 'PONG':
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    /**
     * Send message to server
     */
    send(data: WebSocketMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket is not connected');
        }
    }

    /**
     * Subscribe to event
     */
    on(event: string, callback: EventCallback): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Unsubscribe from event
     */
    off(event: string, callback: EventCallback): void {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Emit event to listeners
     */
    private emit(event: string, data?: any): void {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Send ping (keep-alive)
     */
    ping(): void {
        this.send({ type: 'PING' });
    }

    /**
     * Disconnect from WebSocket and cleanup
     */
    disconnect(): void {
        if (this.ws) {
            try {
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.send({ type: 'UNSUBSCRIBE' });
                    this.ws.close(1000, 'Client disconnect');
                }
            } catch (error) {
                console.error('Error during WebSocket disconnect:', error);
            } finally {
                this.ws = null;
                this.connected = false;
                this.listeners = {};

                if (this.reconnectTimeoutId) {
                    clearTimeout(this.reconnectTimeoutId);
                    this.reconnectTimeoutId = null;
                }
            }
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.connected;
    }
}

const wsService = new WebSocketService();
export default wsService;
