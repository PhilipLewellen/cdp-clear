import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedH100, fetchH100, isStale, marketScenario, parseH100 } from '@/lib/h100';
import { SAMPLE_OBLIGATIONS } from '@/lib/netting';

const payload = {
  gpus: { H100: { value: 2.85, date: '2026-10-25', final: true, benchmark: 'H100 SXM 80GB', terms: 'On-demand hourly rental', chg_1d: 0.012, chg_7d: -0.034 } },
  updated: '2026-10-25T12:00:00Z',
  methodology_version: '1.4',
};

beforeEach(() => sessionStorage.clear());

describe('H100 observation parsing', () => {
  it('parses documented fields', () => {
    const o = parseH100(payload);
    expect(o).toMatchObject({ value: 2.85, date: '2026-10-25', final: true, benchmark: 'H100 SXM 80GB', terms: 'On-demand hourly rental', chg1d: 0.012, chg7d: -0.034, updated: '2026-10-25T12:00:00Z', methodologyVersion: '1.4' });
  });
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '2.85'])('rejects invalid price %s', value => {
    expect(parseH100({ gpus: { H100: { ...payload.gpus.H100, value } } })).toBeNull();
  });
  it('rejects missing H100 data', () => {
    expect(parseH100({ gpus: {} })).toBeNull();
    expect(parseH100(null)).toBeNull();
  });
  it('treats optional null fields safely and non-final as provisional', () => {
    const o = parseH100({ gpus: { H100: { value: 3, date: null, final: false, benchmark: null, terms: null, chg_1d: null, chg_7d: null } } });
    expect(o).toMatchObject({ value: 3, date: null, final: false, benchmark: null, terms: null, chg1d: null, chg7d: null });
  });
});

describe('H100 fetching and caching', () => {
  it('fetches, parses and caches a valid observation', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    const o = await fetchH100(fetcher as unknown as typeof fetch);
    expect(o.value).toBe(2.85);
    expect(cachedH100()?.value).toBe(2.85);
  });
  it('fails visibly on HTTP errors without inventing a price', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchH100(fetcher as unknown as typeof fetch)).rejects.toThrow('503');
    expect(cachedH100()).toBeNull();
  });
  it('fails on malformed data without caching', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ gpus: { H100: { value: null } } }) });
    await expect(fetchH100(fetcher as unknown as typeof fetch)).rejects.toThrow('valid positive price');
    expect(cachedH100()).toBeNull();
  });
  it('flags observations older than 24 hours as stale', () => {
    const o = parseH100(payload);
    if (!o) throw new Error('Missing observation');
    expect(isStale(o, Date.parse('2026-10-25T12:00:00Z'))).toBe(false);
    expect(isStale(o, Date.parse('2026-10-27T12:00:01Z'))).toBe(true);
  });
});

describe('market scenario on copied economics', () => {
  it('uses the full published price rather than its four-decimal display rounding', () => {
    const r = marketScenario(SAMPLE_OBLIGATIONS, 3.712949);
    expect(r).toMatchObject({ gross: 1041.65, net: 812.01, aReceives: 926.83, bReceives: 114.82, payer: 'B', payee: 'A' });
    expect(r.net).not.toBe(marketScenario(SAMPLE_OBLIGATIONS, 3.7129).net);
  });
  it('applies one common H100 fixing to all three demo contracts', () => {
    // Fixing 2.85: T-001 1000×(2.85−3)=−150 A pays B; T-002 400×(2.85−4)=−460 B receives; T-003 300×(2.85−3)=−45 A pays B.
    const r = marketScenario(SAMPLE_OBLIGATIONS, 2.85);
    expect(r).toMatchObject({ ok: true, gross: 655, aReceives: 0, bReceives: 655, net: 655, payer: 'A', payee: 'B', reduction: 0 });
  });
  it('handles zero obligations when fixing equals strike', () => {
    const r = marketScenario([SAMPLE_OBLIGATIONS[0]!], 3);
    expect(r).toMatchObject({ ok: true, net: 0, payer: null, payee: null });
  });
  it('reverses direction correctly when fixing exceeds all strikes', () => {
    const r = marketScenario(SAMPLE_OBLIGATIONS, 6);
    // T-001 +3000, T-002 +800, T-003 +900 → all to A.
    expect(r).toMatchObject({ ok: true, gross: 4700, net: 4700, payer: 'B', payee: 'A' });
  });
  it('never mutates the booked trades', () => {
    const before = JSON.stringify(SAMPLE_OBLIGATIONS);
    marketScenario(SAMPLE_OBLIGATIONS, 2.85);
    expect(JSON.stringify(SAMPLE_OBLIGATIONS)).toBe(before);
  });
  it.each([0, -2, Number.NaN])('rejects invalid fixing %s', fixing => {
    expect(marketScenario(SAMPLE_OBLIGATIONS, fixing).ok).toBe(false);
  });
});
