// passenger-portal/src/utils/idempotency.ts

import { generateUniqueId } from './helpers';
import { STORAGE_KEYS } from '../constants';

interface RequestMetadata {
    timestamp: number;
    action?: string;
    params?: unknown;
}

interface CompletedRequest {
    timestamp: number;
    result: unknown;
    success: boolean;
}

interface CanExecuteResult {
    canExecute: boolean;
    reason: string;
    result?: unknown;
}

/**
 * Idempotency manager to prevent duplicate requests
 * Tracks requests by a unique key and prevents duplicate submissions
 */
class IdempotencyManager {
    private pendingRequests: Map<string, RequestMetadata>;
    private completedRequests: Map<string, CompletedRequest>;
    private maxCompletedRequests: number;

    constructor() {
        this.pendingRequests = new Map();
        this.completedRequests = new Map();
        this.maxCompletedRequests = 100; // Keep last 100 completed requests
    }

    /**
     * Generate idempotency key for a request
     */
    generateKey(action: string, params: unknown): string {
        const paramsString = JSON.stringify(params);
        return `${action}:${paramsString}`;
    }

    /**
     * Check if request is already pending
     */
    isPending(key: string): boolean {
        return this.pendingRequests.has(key);
    }

    /**
     * Check if request was already completed
     */
    isCompleted(key: string, ttl: number = 300000): boolean {
        const completed = this.completedRequests.get(key);
        if (!completed) return false;

        const now = Date.now();
        if (now - completed.timestamp > ttl) {
            // Remove expired completed request
            this.completedRequests.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Check if request can be executed
     */
    canExecute(key: string): CanExecuteResult {
        if (this.isPending(key)) {
            return {
                canExecute: false,
                reason: 'Request is already in progress'
            };
        }

        if (this.isCompleted(key)) {
            const completed = this.completedRequests.get(key);
            return {
                canExecute: false,
                reason: 'Request was already processed',
                result: completed?.result
            };
        }

        return {
            canExecute: true,
            reason: 'Request can be executed'
        };
    }

    /**
     * Mark request as pending
     */
    markPending(key: string, metadata: Partial<RequestMetadata> = {}): void {
        this.pendingRequests.set(key, {
            timestamp: Date.now(),
            ...metadata
        });
    }

    /**
     * Mark request as completed
     */
    markCompleted(key: string, result: unknown, success: boolean = true): void {
        // Remove from pending
        this.pendingRequests.delete(key);

        // Add to completed
        this.completedRequests.set(key, {
            timestamp: Date.now(),
            result,
            success
        });

        // Cleanup old completed requests
        this.cleanupCompletedRequests();
    }

    /**
     * Mark request as failed
     */
    markFailed(key: string, _error: Error): void {
        this.pendingRequests.delete(key);
        // Don't add to completed for failures - allow retry
    }

    /**
     * Clear specific request
     */
    clear(key: string): void {
        this.pendingRequests.delete(key);
        this.completedRequests.delete(key);
    }

    /**
     * Clear all requests
     */
    clearAll(): void {
        this.pendingRequests.clear();
        this.completedRequests.clear();
    }

    /**
     * Cleanup old completed requests
     */
    private cleanupCompletedRequests(): void {
        if (this.completedRequests.size <= this.maxCompletedRequests) {
            return;
        }

        // Convert to array and sort by timestamp
        const entries = Array.from(this.completedRequests.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest entries
        const toRemove = entries.slice(0, entries.length - this.maxCompletedRequests);
        toRemove.forEach(([key]) => this.completedRequests.delete(key));
    }

    /**
     * Get pending request info
     */
    getPendingInfo(key: string): RequestMetadata | null {
        return this.pendingRequests.get(key) || null;
    }

    /**
     * Get completed request info
     */
    getCompletedInfo(key: string): CompletedRequest | null {
        return this.completedRequests.get(key) || null;
    }
}

// Create singleton instance
const idempotencyManager = new IdempotencyManager();

/**
 * Execute request with idempotency protection
 */
export const executeIdempotentRequest = async <T>(
    action: string,
    params: unknown,
    requestFn: () => Promise<T>
): Promise<T> => {
    const key = idempotencyManager.generateKey(action, params);

    // Check if request can be executed
    const check = idempotencyManager.canExecute(key);
    if (!check.canExecute) {
        if (check.result) {
            // Return cached result
            return check.result as T;
        }
        throw new Error(check.reason);
    }

    // Mark as pending
    idempotencyManager.markPending(key, { action, params });

    try {
        // Execute request
        const result = await requestFn();

        // Mark as completed
        idempotencyManager.markCompleted(key, result, true);

        return result;
    } catch (error) {
        // Mark as failed (allows retry)
        idempotencyManager.markFailed(key, error as Error);
        throw error;
    }
};

/**
 * Create idempotency token for request
 */
export const createIdempotencyToken = (): string => {
    return generateUniqueId();
};

interface StoredToken {
    token: string;
    timestamp: number;
}

/**
 * Store idempotency token in storage
 */
export const storeIdempotencyToken = (action: string, token: string): void => {
    try {
        const key = `${STORAGE_KEYS.RETRY_QUEUE}:tokens`;
        const stored: Record<string, StoredToken> = JSON.parse(localStorage.getItem(key) || '{}');
        stored[action] = {
            token,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(stored));
    } catch (error) {
        console.error('Failed to store idempotency token', error);
    }
};

/**
 * Get idempotency token from storage
 */
export const getIdempotencyToken = (action: string): string | null => {
    try {
        const key = `${STORAGE_KEYS.RETRY_QUEUE}:tokens`;
        const stored: Record<string, StoredToken> = JSON.parse(localStorage.getItem(key) || '{}');
        const entry = stored[action];

        if (!entry) return null;

        // Check if token is still valid (within 5 minutes)
        const now = Date.now();
        if (now - entry.timestamp > 300000) {
            // Token expired, remove it
            delete stored[action];
            localStorage.setItem(key, JSON.stringify(stored));
            return null;
        }

        return entry.token;
    } catch (error) {
        console.error('Failed to get idempotency token', error);
        return null;
    }
};

/**
 * Clear idempotency token from storage
 */
export const clearIdempotencyToken = (action: string): void => {
    try {
        const key = `${STORAGE_KEYS.RETRY_QUEUE}:tokens`;
        const stored: Record<string, StoredToken> = JSON.parse(localStorage.getItem(key) || '{}');
        delete stored[action];
        localStorage.setItem(key, JSON.stringify(stored));
    } catch (error) {
        console.error('Failed to clear idempotency token', error);
    }
};

/**
 * Cleanup expired idempotency tokens
 */
export const cleanupExpiredTokens = (): void => {
    try {
        const key = `${STORAGE_KEYS.RETRY_QUEUE}:tokens`;
        const stored: Record<string, StoredToken> = JSON.parse(localStorage.getItem(key) || '{}');
        const now = Date.now();

        const cleaned = Object.entries(stored)
            .filter(([, entry]) => now - entry.timestamp <= 300000)
            .reduce((acc: Record<string, StoredToken>, [action, entry]) => {
                acc[action] = entry;
                return acc;
            }, {});

        localStorage.setItem(key, JSON.stringify(cleaned));
    } catch (error) {
        console.error('Failed to cleanup expired tokens', error);
    }
};

export {
    idempotencyManager,
    IdempotencyManager
};

export default {
    executeIdempotentRequest,
    createIdempotencyToken,
    storeIdempotencyToken,
    getIdempotencyToken,
    clearIdempotencyToken,
    cleanupExpiredTokens,
    idempotencyManager
};
