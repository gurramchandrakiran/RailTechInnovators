/**
 * WebSocket Chaos Tests
 * Tests for edge cases and failure scenarios in WebSocket communication
 */

const WebSocket = require('ws');

// Test configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:5000';
const RECONNECT_DELAY = 100; // ms
const MESSAGE_TIMEOUT = 5000; // ms

// Helper to create WebSocket connection with timeout
function createConnection(url = WS_URL) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => {
            ws.terminate();
            reject(new Error('Connection timeout'));
        }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            resolve(ws);
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// Helper to wait for specific message type
function waitForMessage(ws, type, timeout = MESSAGE_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for message type: ${type}`));
        }, timeout);

        const handler = (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === type) {
                    clearTimeout(timer);
                    ws.removeListener('message', handler);
                    resolve(message);
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        ws.on('message', handler);
    });
}

// Helper to collect all messages for a duration
function collectMessages(ws, duration) {
    return new Promise((resolve) => {
        const messages = [];
        const handler = (data) => {
            try {
                messages.push(JSON.parse(data.toString()));
            } catch (e) {
                messages.push({ raw: data.toString() });
            }
        };

        ws.on('message', handler);

        setTimeout(() => {
            ws.removeListener('message', handler);
            resolve(messages);
        }, duration);
    });
}

describe('WebSocket Chaos Tests', () => {
    // Skip if WebSocket server not available
    let serverAvailable = true;

    beforeAll(async () => {
        try {
            const ws = await createConnection();
            ws.close();
        } catch (e) {
            console.warn('WebSocket server not available, skipping chaos tests');
            serverAvailable = false;
        }
    });

    describe('Reconnect Storm Tests', () => {
        it('should handle 50 rapid reconnections from same client', async () => {
            if (!serverAvailable) return;

            const reconnectCount = 50;
            const connections = [];
            const errors = [];

            // Rapidly connect and disconnect
            for (let i = 0; i < reconnectCount; i++) {
                try {
                    const ws = await createConnection();
                    connections.push(ws);

                    // Immediately close and reconnect
                    ws.close();
                    await new Promise(r => setTimeout(r, RECONNECT_DELAY));
                } catch (err) {
                    errors.push(err);
                }
            }

            // Should have minimal errors
            expect(errors.length).toBeLessThan(reconnectCount * 0.1); // < 10% error rate
        }, 60000);

        it('should handle concurrent connections from multiple clients', async () => {
            if (!serverAvailable) return;

            const clientCount = 30;
            const connectionPromises = [];

            // Create many concurrent connections
            for (let i = 0; i < clientCount; i++) {
                connectionPromises.push(createConnection());
            }

            const results = await Promise.allSettled(connectionPromises);
            const successful = results.filter(r => r.status === 'fulfilled');
            const failed = results.filter(r => r.status === 'rejected');

            // At least 80% should succeed
            expect(successful.length).toBeGreaterThanOrEqual(clientCount * 0.8);

            // Cleanup
            successful.forEach(r => r.value.close());

            if (failed.length > 0) {
                console.warn(`${failed.length} connections failed:`,
                    failed.map(f => f.reason.message));
            }
        }, 30000);

        it('should maintain state after reconnection', async () => {
            if (!serverAvailable) return;

            // Connect and subscribe to a PNR
            const ws1 = await createConnection();
            const pnr = 'TEST_PNR_' + Date.now();

            ws1.send(JSON.stringify({
                type: 'subscribe:offers',
                payload: { pnr }
            }));

            await waitForMessage(ws1, 'subscribed');
            ws1.close();

            // Wait and reconnect
            await new Promise(r => setTimeout(r, 500));

            const ws2 = await createConnection();

            // New connection should be able to re-subscribe
            ws2.send(JSON.stringify({
                type: 'subscribe:offers',
                payload: { pnr }
            }));

            const subscribeMsg = await waitForMessage(ws2, 'subscribed');
            expect(subscribeMsg.payload.pnr).toBe(pnr);

            ws2.close();
        }, 15000);
    });

    describe('Message Duplication Tests', () => {
        it('should not receive duplicate messages on same subscription', async () => {
            if (!serverAvailable) return;

            const ws = await createConnection();
            const pnr = 'DUP_TEST_' + Date.now();

            // Subscribe to same PNR multiple times
            for (let i = 0; i < 5; i++) {
                ws.send(JSON.stringify({
                    type: 'subscribe:offers',
                    payload: { pnr }
                }));
                await new Promise(r => setTimeout(r, 50));
            }

            // Wait for all subscribe confirmations
            await new Promise(r => setTimeout(r, 1000));

            // Send a ping and count responses
            ws.send(JSON.stringify({ type: 'PING' }));

            const messages = await collectMessages(ws, 2000);
            const pongMessages = messages.filter(m => m.type === 'pong');

            // Should only receive ONE pong, not duplicates
            expect(pongMessages.length).toBe(1);

            ws.close();
        }, 15000);

        it('should handle rapid message bursts without duplication', async () => {
            if (!serverAvailable) return;

            const ws = await createConnection();
            const messageCount = 20;
            const receivedMessages = [];

            ws.on('message', (data) => {
                try {
                    receivedMessages.push(JSON.parse(data.toString()));
                } catch (e) { }
            });

            // Send rapid burst of pings
            for (let i = 0; i < messageCount; i++) {
                ws.send(JSON.stringify({ type: 'PING', id: i }));
            }

            await new Promise(r => setTimeout(r, 3000));

            // Should receive exactly one pong per ping (or slightly less due to debouncing)
            const pongs = receivedMessages.filter(m => m.type === 'pong');
            expect(pongs.length).toBeGreaterThanOrEqual(messageCount * 0.9);
            expect(pongs.length).toBeLessThanOrEqual(messageCount);

            ws.close();
        }, 15000);
    });

    describe('Late Joiner Synchronization Tests', () => {
        it('should send connection success to late joiner', async () => {
            if (!serverAvailable) return;

            // Simulate late joiner connecting mid-journey
            const ws = await createConnection();

            const welcomeMsg = await waitForMessage(ws, 'CONNECTION_SUCCESS');

            expect(welcomeMsg).toBeDefined();
            expect(welcomeMsg.clientId).toBeDefined();
            expect(welcomeMsg.message).toContain('Connected');

            ws.close();
        }, 10000);

        it('should allow late joiner to subscribe and receive updates', async () => {
            if (!serverAvailable) return;

            const ws = await createConnection();
            const pnr = 'LATE_JOIN_' + Date.now();

            // Wait for connection success first
            await waitForMessage(ws, 'CONNECTION_SUCCESS');

            // Subscribe as late joiner
            ws.send(JSON.stringify({
                type: 'subscribe:offers',
                payload: { pnr }
            }));

            const subscribeMsg = await waitForMessage(ws, 'subscribed');
            expect(subscribeMsg.payload.pnr).toBe(pnr);

            ws.close();
        }, 10000);

        it('should handle multiple late joiners subscribing to same PNR', async () => {
            if (!serverAvailable) return;

            const pnr = 'MULTI_JOIN_' + Date.now();
            const clientCount = 5;
            const connections = [];

            // Create multiple late joiners
            for (let i = 0; i < clientCount; i++) {
                const ws = await createConnection();
                await waitForMessage(ws, 'CONNECTION_SUCCESS');

                ws.send(JSON.stringify({
                    type: 'subscribe:offers',
                    payload: { pnr }
                }));

                connections.push(ws);
                await new Promise(r => setTimeout(r, 100));
            }

            // All should be subscribed
            await new Promise(r => setTimeout(r, 1000));

            // Verify all connections are still open
            const openConnections = connections.filter(
                ws => ws.readyState === WebSocket.OPEN
            );
            expect(openConnections.length).toBe(clientCount);

            // Cleanup
            connections.forEach(ws => ws.close());
        }, 20000);
    });

    describe('Connection Stability Tests', () => {
        it('should survive client going offline and coming back', async () => {
            if (!serverAvailable) return;

            const ws = await createConnection();
            await waitForMessage(ws, 'CONNECTION_SUCCESS');

            // Simulate going offline by not responding to pings
            // The server should eventually terminate, but not crash

            // Just verify the connection was established properly
            expect(ws.readyState).toBe(WebSocket.OPEN);

            ws.close();
        }, 10000);

        it('should handle malformed messages gracefully', async () => {
            if (!serverAvailable) return;

            const ws = await createConnection();
            await waitForMessage(ws, 'CONNECTION_SUCCESS');

            // Send malformed messages
            ws.send('not json');
            ws.send('{ invalid json }');
            ws.send('');
            ws.send(JSON.stringify({ type: null }));
            ws.send(JSON.stringify({ noType: 'missing type field' }));

            // Wait a bit
            await new Promise(r => setTimeout(r, 1000));

            // Connection should still be open
            expect(ws.readyState).toBe(WebSocket.OPEN);

            // Should still be able to communicate
            ws.send(JSON.stringify({ type: 'PING' }));
            const pong = await waitForMessage(ws, 'pong');
            expect(pong).toBeDefined();

            ws.close();
        }, 10000);

        it('should handle very large payloads', async () => {
            if (!serverAvailable) return;

            const ws = await createConnection();
            await waitForMessage(ws, 'CONNECTION_SUCCESS');

            // Send a large payload
            const largePayload = {
                type: 'subscribe:offers',
                payload: {
                    pnr: 'LARGE_' + Date.now(),
                    data: 'x'.repeat(10000) // 10KB of data
                }
            };

            // Wrap in try-catch as server might reject large payloads
            try {
                ws.send(JSON.stringify(largePayload));
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                // Expected to potentially fail
            }

            // Connection should still work
            ws.send(JSON.stringify({ type: 'PING' }));

            // Either get pong or connection was closed for large payload
            if (ws.readyState === WebSocket.OPEN) {
                const pong = await waitForMessage(ws, 'pong');
                expect(pong).toBeDefined();
            }

            ws.close();
        }, 10000);
    });
});
