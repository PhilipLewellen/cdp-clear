import { deriveObligation, netObligations, type NetResult, type Obligation } from './netting';

export const H100_API_URL = 'https://computescreener.com/data/index.json';
export const H100_SOURCE_URL = 'https://computescreener.com/';
export const H100_METHODOLOGY_URL = 'https://computescreener.com/methodology';
const CACHE_KEY = 'cdp-clear-h100-cache';
const TIMEOUT_MS = 10000;

export interface H100Observation {
  value: number;
  date: string | null;
  final: boolean;
  benchmark: string | null;
  terms: string | null;
  chg1d: number | null;
  chg7d: number | null;
  updated: string | null;
  methodologyVersion: string | null;
  fetchedAt: string;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
const change = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Parse the Compute Screener index file; null when H100 data is missing or invalid. */
export function parseH100(payload: unknown): H100Observation | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const gpus = root.gpus as Record<string, unknown> | undefined;
  const h100 = gpus?.H100 as Record<string, unknown> | undefined;
  const value = h100?.['value'];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return {
    value,
    date: text(h100?.['date']),
    final: h100?.['final'] === true,
    benchmark: text(h100?.['benchmark']),
    terms: text(h100?.['terms']),
    chg1d: change(h100?.['chg_1d']),
    chg7d: change(h100?.['chg_7d']),
    updated: text(root['updated']),
    methodologyVersion: text(root['methodology_version']),
    fetchedAt: new Date().toISOString(),
  };
}

/** Fetch the latest published H100 index observation; throws on network, timeout or invalid data. */
export async function fetchH100(fetcher: typeof fetch = fetch): Promise<H100Observation> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(H100_API_URL, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Compute Screener responded with HTTP ${response.status}.`);
    const observation = parseH100(await response.json());
    if (!observation) throw new Error('H100 observation is missing or not a valid positive price.');
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(observation)); } catch { /* cache unavailable */ }
    return observation;
  } finally {
    clearTimeout(timer);
  }
}

/** Last successful observation from this browser session, if any. */
export function cachedH100(): H100Observation | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as H100Observation;
    return typeof parsed?.value === 'number' && Number.isFinite(parsed.value) && parsed.value > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** True when the observation date is more than 24 hours before `now`. */
export function isStale(observation: H100Observation, now = Date.now()): boolean {
  const stamp = observation.date ?? observation.updated;
  if (!stamp) return false;
  const time = Date.parse(stamp);
  return Number.isFinite(time) && now - time > 24 * 60 * 60 * 1000;
}

/**
 * Indicative scenario: apply one common external H100 fixing to copies of the
 * booked trades. Never writes to booked trades, instructions or settlement records.
 */
export function marketScenario(trades: Obligation[], fixing: number): NetResult {
  if (!Number.isFinite(fixing) || fixing <= 0)
    return { ...netObligations([]), ok: false, error: 'A valid positive H100 price is required before running the market scenario.' };
  if (trades.some(trade => !trade.economics))
    return { ...netObligations([]), ok: false, error: 'GPU-forward economics are required for each scenario trade.' };
  return netObligations(trades.map(trade => {
    if (!trade.economics) return trade;
    return deriveObligation({ ...trade, economics: { ...trade.economics, fixing } });
  }));
}
