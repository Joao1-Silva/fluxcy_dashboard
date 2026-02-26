import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchDashboardSnapshot,
  type RealtimeBootstrapPayload,
} from '../api/dashboardApi';
import { createEmptySnapshot, mergeSnapshot } from '../lib/dashboardData';
import {
  connectDashboardSocket,
  type ConnectionStatus,
} from '../realtime/dashboardSocket';
import type { DashboardSnapshot, DashboardUpdate } from '../types/dashboard';
import type { ChartTimeRange } from '../types/timeRange';

interface DashboardState {
  snapshot: DashboardSnapshot;
  isLoading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  refreshSnapshot: () => Promise<void>;
}

export const useDashboardData = (
  token: string | null,
  timeRange: ChartTimeRange,
): DashboardState => {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(createEmptySnapshot());
  const [bootstrap, setBootstrap] = useState<RealtimeBootstrapPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const applyUpdate = useCallback((update: DashboardUpdate) => {
    setSnapshot((current) => mergeSnapshot(current, update));
  }, []);

  const refreshSnapshot = useCallback(async () => {
    if (!token) {
      setSnapshot(createEmptySnapshot());
      setBootstrap(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const result = await fetchDashboardSnapshot({ token, timeRange });
      setSnapshot(result.snapshot);
      setBootstrap(result.bootstrap);
      setError(null);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'No fue posible cargar el dashboard.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, token]);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!token) {
      setConnectionStatus('disconnected');
      return undefined;
    }

    const disconnect = connectDashboardSocket({
      token,
      bootstrap,
      onUpdate: applyUpdate,
      onStatusChange: setConnectionStatus,
      onError: setError,
    });

    return () => {
      disconnect();
    };
  }, [applyUpdate, bootstrap, token]);

  return useMemo(
    () => ({
      snapshot,
      isLoading,
      error,
      connectionStatus,
      refreshSnapshot,
    }),
    [connectionStatus, error, isLoading, refreshSnapshot, snapshot],
  );
};
