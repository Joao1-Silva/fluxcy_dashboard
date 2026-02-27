import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { WelltechTrialWindow } from '@/lib/auth/server-auth';

type PersistedTrialPayload = {
  trialStart: string;
  trialEnd: string;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_STATE_FILE = path.join(process.cwd(), '.runtime', 'welltech-trial-state.json');

function getStateFilePath(): string {
  const configured = process.env.WELLTECH_TRIAL_STATE_FILE?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_STATE_FILE;
}

function parseIso(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidWindow(value: unknown): value is WelltechTrialWindow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.trialStart !== 'string' || typeof candidate.trialEnd !== 'string') {
    return false;
  }

  return parseIso(candidate.trialStart) !== null && parseIso(candidate.trialEnd) !== null;
}

export async function readPersistedWelltechTrial(): Promise<WelltechTrialWindow | null> {
  const filePath = getStateFilePath();
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidWindow(parsed)) {
      return null;
    }

    return {
      trialStart: parsed.trialStart,
      trialEnd: parsed.trialEnd,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function writePersistedWelltechTrial(window: WelltechTrialWindow): Promise<void> {
  const filePath = getStateFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });

  const nowIso = new Date().toISOString();
  let createdAt = nowIso;
  try {
    const current = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(current) as Partial<PersistedTrialPayload>;
    if (typeof parsed.createdAt === 'string' && parseIso(parsed.createdAt) !== null) {
      createdAt = parsed.createdAt;
    }
  } catch {
    // Keep createdAt = now when file does not exist or is invalid.
  }

  const payload: PersistedTrialPayload = {
    trialStart: window.trialStart,
    trialEnd: window.trialEnd,
    createdAt,
    updatedAt: nowIso,
  };

  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}
