import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider, useStore } from '@/lib/store';
import { netObligations } from '@/lib/netting';

let observed: ReturnType<typeof useStore> | null = null;
function Probe() { observed = useStore(); return null; }
beforeEach(() => { localStorage.clear(); observed = null; });
afterEach(cleanup);

describe('Demo initial state and saved edits', () => {
  it('loads the three valid eligible samples with 3100 gross and 1500 payable B to A', async () => {
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(observed?.trades.map(t => t.amount)).toEqual([2000, 800, 300]));
    expect(observed?.trades.every(t => t.eligible && t.lifecycle === 'Validated')).toBe(true);
    expect(netObligations(observed?.trades ?? [])).toMatchObject({ gross: 3100, net: 1500, payer: 'B', payee: 'A' });
  });
  it('preserves an explicitly cleared saved blotter instead of silently reseeding', async () => {
    localStorage.setItem('cdp-clear-v1', JSON.stringify({ trades: [] }));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(observed?.trades).toEqual([]));
  });
  it('preserves saved manual amounts rather than replacing them with defaults', async () => {
    localStorage.setItem('cdp-clear-v1', JSON.stringify({ trades: [{ id: 'T-001', receiver: 'A', amount: 2750, currency: 'USD', eligible: true }] }));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(observed?.trades[0]?.amount).toBe(2750));
  });
});