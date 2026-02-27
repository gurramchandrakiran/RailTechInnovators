// admin-portal/src/services/StateStore.ts
// IndexedDB-based state persistence for browser refresh survival

const DB_NAME = 'RACAdminState';
const DB_VERSION = 1;
const STORE_NAME = 'appState';
const STATE_KEY_PREFIX = 'currentState';
const getStateKey = (trainNo?: string) => trainNo ? `${STATE_KEY_PREFIX}_${trainNo}` : STATE_KEY_PREFIX;

// State interface
export interface PersistedState {
    currentPage: string;
    journeyStarted: boolean;
    autoInitAttempted: boolean;
    timestamp: number;
}

// Open IndexedDB connection
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[StateStore] Failed to open IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                console.log('[StateStore] Created object store:', STORE_NAME);
            }
        };
    });
};

// Debounce timers per train — prevents cross-train cancel
const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 500;

/**
 * Save app state to IndexedDB (debounced per train to avoid excessive writes)
 */
export const saveAppState = async (state: Omit<PersistedState, 'timestamp'>, trainNo?: string): Promise<void> => {
    const key = getStateKey(trainNo);

    // Clear previous pending save for THIS train only
    const existing = saveTimeouts.get(key);
    if (existing) {
        clearTimeout(existing);
    }

    // Debounce the save per train
    const timeout = setTimeout(async () => {
        saveTimeouts.delete(key);
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            const stateToSave: PersistedState & { key: string } = {
                key,
                ...state,
                timestamp: Date.now()
            };

            store.put(stateToSave);

            tx.oncomplete = () => {
                console.log('[StateStore] State saved:', state.currentPage, '| journeyStarted:', state.journeyStarted);
                db.close();
            };

            tx.onerror = () => {
                console.error('[StateStore] Save failed:', tx.error);
                db.close();
            };
        } catch (error) {
            console.error('[StateStore] Failed to save state:', error);
        }
    }, DEBOUNCE_MS);

    saveTimeouts.set(key, timeout);
};

/**
 * Load app state from IndexedDB
 */
export const loadAppState = async (trainNo?: string): Promise<PersistedState | null> => {
    try {
        const db = await openDB();

        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(getStateKey(trainNo));

            request.onsuccess = () => {
                const result = request.result;
                db.close();

                if (result) {
                    // Check if state is stale (older than 24 hours)
                    const ageMs = Date.now() - (result.timestamp || 0);
                    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

                    if (ageMs > maxAgeMs) {
                        console.log('[StateStore] State expired, clearing...');
                        clearAppState();
                        resolve(null);
                        return;
                    }

                    console.log('[StateStore] State restored:', result.currentPage, '| journeyStarted:', result.journeyStarted);
                    resolve(result as PersistedState);
                } else {
                    console.log('[StateStore] No saved state found');
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('[StateStore] Load failed:', request.error);
                db.close();
                resolve(null);
            };
        });
    } catch (error) {
        console.error('[StateStore] Failed to load state:', error);
        return null;
    }
};

/**
 * Clear persisted state (call on logout/reset)
 */
export const clearAppState = async (trainNo?: string): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(getStateKey(trainNo));

        tx.oncomplete = () => {
            console.log('[StateStore] State cleared');
            db.close();
        };

        tx.onerror = () => {
            console.error('[StateStore] Clear failed:', tx.error);
            db.close();
        };
    } catch (error) {
        console.error('[StateStore] Failed to clear state:', error);
    }
};
