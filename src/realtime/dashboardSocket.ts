import { io, type Socket } from 'socket.io-client';
import {
  buildRealtimeUpdateFromLatest,
  type RealtimeBootstrapPayload,
  type RealtimeLatestMeasurement,
} from '../api/dashboardApi';
import { env } from '../config/env';
import { buildDemoUpdate } from '../lib/dashboardData';
import type { DashboardUpdate } from '../types/dashboard';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface SocketParams {
  token: string;
  bootstrap: RealtimeBootstrapPayload | null;
  onUpdate: (update: DashboardUpdate) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onError: (message: string) => void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const looksLikeRealtimeLatest = (value: unknown): boolean => {
  if (!isObject(value)) {
    return false;
  }

  return (
    'timestamp_hmi' in value ||
    'qm_liq' in value ||
    'qm_gas' in value ||
    'pres_f_liq' in value ||
    'pres_f_gas' in value
  );
};

const resolveUpdatePayload = (payload: unknown): DashboardUpdate | null => {
  if (!isObject(payload)) {
    return null;
  }

  if (looksLikeRealtimeLatest(payload.latest)) {
    return buildRealtimeUpdateFromLatest(payload.latest as RealtimeLatestMeasurement);
  }

  if (looksLikeRealtimeLatest(payload)) {
    return buildRealtimeUpdateFromLatest(payload as RealtimeLatestMeasurement);
  }

  if (isObject(payload.update)) {
    return payload.update as DashboardUpdate;
  }

  if (isObject(payload.data)) {
    return payload.data as DashboardUpdate;
  }

  return payload as DashboardUpdate;
};

const resolveSocketBaseUrl = (bootstrap: RealtimeBootstrapPayload | null): string => {
  if (bootstrap?.socket?.origin) {
    return bootstrap.socket.origin;
  }

  return env.socketUrl;
};

const resolveSocketPath = (bootstrap: RealtimeBootstrapPayload | null): string => {
  return bootstrap?.socket?.path || env.socketPath;
};

const resolveSocketUpdateEvent = (bootstrap: RealtimeBootstrapPayload | null): string => {
  return bootstrap?.socket?.events?.stream_all || env.socketUpdateEvent;
};

const resolveSocketSubscribeEvent = (
  bootstrap: RealtimeBootstrapPayload | null,
): string => {
  return bootstrap?.socket?.events?.subscribe || env.socketConnectEvent;
};

const resolveSocketTransports = (bootstrap: RealtimeBootstrapPayload | null): string[] => {
  if (Array.isArray(bootstrap?.socket?.transports) && bootstrap.socket.transports.length) {
    return bootstrap.socket.transports;
  }

  return ['websocket', 'polling'];
};

const buildSocketUrl = (bootstrap: RealtimeBootstrapPayload | null): string => {
  const base = resolveSocketBaseUrl(bootstrap);

  if (env.socketNamespace === '/' || env.socketNamespace === '') {
    return base;
  }

  const sanitizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const sanitizedNamespace = env.socketNamespace.startsWith('/')
    ? env.socketNamespace
    : `/${env.socketNamespace}`;

  return `${sanitizedBase}${sanitizedNamespace}`;
};

export const connectDashboardSocket = ({
  token,
  bootstrap,
  onUpdate,
  onStatusChange,
  onError,
}: SocketParams): (() => void) => {
  if (env.enableDemoMode) {
    let tick = 0;
    onStatusChange('connected');

    const timer = window.setInterval(() => {
      tick += 1;
      onUpdate(buildDemoUpdate(tick));
    }, 2500);

    return () => {
      window.clearInterval(timer);
      onStatusChange('disconnected');
    };
  }

  onStatusChange('connecting');

  const socket: Socket = io(buildSocketUrl(bootstrap), {
    path: resolveSocketPath(bootstrap),
    transports: resolveSocketTransports(bootstrap),
    reconnection: true,
    reconnectionAttempts: Infinity,
    withCredentials: env.socketWithCredentials,
    auth: {
      token,
    },
  });

  socket.on('connect', () => {
    onStatusChange('connected');

    const subscribeEvent = resolveSocketSubscribeEvent(bootstrap);
    const pozo = env.socketSubscribePozo;

    if (subscribeEvent && pozo) {
      socket.emit(subscribeEvent, { pozo });
    }
  });

  socket.on('disconnect', () => {
    onStatusChange('disconnected');
  });

  socket.on('connect_error', (error: Error) => {
    onStatusChange('error');
    onError(error.message || 'No se pudo conectar el socket');
  });

  socket.on(resolveSocketUpdateEvent(bootstrap), (payload: unknown) => {
    const update = resolveUpdatePayload(payload);
    if (!update) {
      return;
    }

    onUpdate(update);
  });

  return () => {
    socket.disconnect();
  };
};
