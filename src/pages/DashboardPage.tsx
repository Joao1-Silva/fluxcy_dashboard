import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { TimeRangeToolbar } from '../components/filters/TimeRangeToolbar';
import { AppShell } from '../components/layout/AppShell';
import { dashboardWidgets } from '../config/dashboardConfig';
import { env } from '../config/env';
import { useAuth } from '../hooks/useAuth';
import { useDashboardData } from '../hooks/useDashboardData';
import { hasSeenIntro } from '../lib/introGate';
import type { ChartTimeRange } from '../types/timeRange';

const defaultRange = (snapshotTimestamp: string): ChartTimeRange => ({
  mode: 'last_6h',
  from: dayjs(snapshotTimestamp).subtract(6, 'hour').format('YYYY-MM-DDTHH:mm'),
  to: dayjs(snapshotTimestamp).format('YYYY-MM-DDTHH:mm'),
});

export const DashboardPage = () => {
  const { token, user, logout, isAuthenticated, isBootstrapping } = useAuth();
  const [chartTimeRange, setChartTimeRange] = useState<ChartTimeRange>(() =>
    defaultRange(new Date().toISOString()),
  );
  const { snapshot, isLoading, error, connectionStatus, refreshSnapshot } =
    useDashboardData(token, chartTimeRange);

  const safeRange = useMemo<ChartTimeRange>(() => {
    if (chartTimeRange.mode !== 'custom') {
      return chartTimeRange;
    }

    return {
      ...chartTimeRange,
      from: chartTimeRange.from || defaultRange(snapshot.timestamp).from,
      to: chartTimeRange.to || dayjs(snapshot.timestamp).format('YYYY-MM-DDTHH:mm'),
    };
  }, [chartTimeRange, snapshot.timestamp]);

  if (isBootstrapping) {
    return <div className="screen-loader">Cargando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasSeenIntro()) {
    return <Navigate to="/intro" replace />;
  }

  return (
    <AppShell
      title={env.appName}
      username={user?.name}
      status={connectionStatus}
      lastUpdated={snapshot.timestamp}
      error={error}
      onRefresh={() => {
        void refreshSnapshot();
      }}
      onLogout={logout}
    >
      <TimeRangeToolbar value={safeRange} onChange={setChartTimeRange} />

      {isLoading ? (
        <div className="screen-loader screen-loader--inline">Cargando datos...</div>
      ) : null}

      <DashboardGrid
        widgets={dashboardWidgets}
        snapshot={snapshot}
        chartTimeRange={safeRange}
      />
    </AppShell>
  );
};
