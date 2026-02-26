import axios from 'axios';

import { SERVER_CONFIG } from './config.js';

export const externalApi = axios.create({
  baseURL: SERVER_CONFIG.externalApiBase,
  timeout: 10_000,
});

export async function fetchExternal<T = unknown>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const { data } = await externalApi.get<T>(endpoint, { params });
  return data;
}
