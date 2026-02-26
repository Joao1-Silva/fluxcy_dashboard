export const SERVER_CONFIG = {
  externalApiBase: 'http://api-sermaca.lat/api_aguilera/api',
  socketPort: Number(process.env.PORT) || 4000,
  pollingDefaultMs: 30_000,
  socketSnapshotMs: 3_000,
  enableTasksBackend: false,
  basicAuth: {
    enabled: false,
    user: '',
    pass: '',
  },
} as const;
