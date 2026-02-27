// admin-portal/src/hooks/useTrainState.ts
// Example custom hook with TypeScript

import { useState, useEffect, useCallback } from 'react';
import { TrainState, ApiResponse } from '../types';

interface UseTrainStateReturn {
    trainState: TrainState | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function useTrainState(): UseTrainStateReturn {
    const [trainState, setTrainState] = useState<TrainState | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTrainState = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE}/train/state`);
            const data: ApiResponse<TrainState> = await response.json();

            if (data.success && data.data) {
                setTrainState(data.data);
            } else {
                setError(data.message || 'Failed to fetch train state');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrainState();
    }, [fetchTrainState]);

    return {
        trainState,
        loading,
        error,
        refresh: fetchTrainState
    };
}

export default useTrainState;
