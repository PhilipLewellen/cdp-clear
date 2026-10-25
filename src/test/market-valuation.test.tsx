import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useH100 } from '@/hooks/use-h100';
import { marketScenario } from '@/lib/h100';
import { SAMPLE_OBLIGATIONS } from '@/lib/netting';
import { StoreProvider } from '@/lib/store';
import { useStore } from '@/lib/use-store';
import { ScaledSettlementCalc } from '@/components/ScaledSettlement';
import { webcrypto } from 'node:crypto';

function Probe() {
  const market = useH100();
  const { trades, scaledInstruction } = useStore();
  return <><output data-testid="valuation">{market.observation ? marketScenario(trades, market.observation.value).net : 'unavailable'}</output><output data-testid="loading">{String(market.loading)}</output><output data-testid="error">{market.error}</output><output data-testid="cached">{String(market.cached)}</output><output data-testid="instruction">{JSON.stringify(scaledInstruction)}</output><button onClick={market.refresh}>Refresh</button></>;
}
const payload = (value: number) => ({ gpus: { H100: { value, date: '2026-10-25', final: false } }, updated: '2026-10-25T12:00:00Z' });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Automatic indicative valuation', () => {
  it('reports loading without inventing financial results before the request finishes', () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})));
    render(<StoreProvider><Probe /></StoreProvider>);
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('valuation').textContent).toBe('unavailable');
  });
  it('loads immediately and refreshes valuation without modifying booked state or a saved instruction', async () => {
    const instruction = { id: 'SI-saved', status: 'Reconciled', snapshot: 'original', usdcAmount: '1.5000000', financialFingerprint: 'saved-hash', txHash: 'a'.repeat(64) };
    localStorage.setItem('cdp-clear-v1', JSON.stringify({ trades: SAMPLE_OBLIGATIONS, scaledInstruction: instruction }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(payload(3.712949)))).mockResolvedValueOnce(new Response(JSON.stringify(payload(2.85)))));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId('valuation').textContent).toBe('812.01'));
    const saved = localStorage.getItem('cdp-clear-v1');
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() => expect(screen.getByTestId('valuation').textContent).toBe('655'));
    expect(localStorage.getItem('cdp-clear-v1')).toBe(saved);
    expect(JSON.parse(saved ?? '{}').scaledInstruction.financialFingerprint).toBe('saved-hash');
  });
  it('does not show the original example as current valuation when retrieval fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Offline'));
    expect(screen.getByTestId('valuation').textContent).toBe('unavailable');
  });
  it('labels the last retrieved observation as cached after a failed refresh', async () => {
    sessionStorage.setItem('cdp-clear-h100-cache', JSON.stringify({ value: 2.85, date: '2026-10-23', final: false }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('valuation').textContent).toBe('655');
    expect(screen.getByTestId('cached').textContent).toBe('true');
  });
  it('requires explicit booked-calculation confirmation and invalidates it after a scale change', async () => {
    render(<StoreProvider><ScaledSettlementCalc requireConfirmation /></StoreProvider>);
    const generate = screen.getByRole('button', { name: 'Generate Settlement Instruction' });
    expect(generate).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Illustrative Settlement Calculation' }));
    expect(generate).not.toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /One-hundredth/ }));
    expect(generate).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Illustrative Settlement Calculation' }));
    fireEvent.click(generate);
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cdp-clear-v1') ?? '{}').scaledInstruction?.usdcAmount).toBe('15.0000000'));
    expect(JSON.parse(localStorage.getItem('cdp-clear-v1') ?? '{}').trades).toEqual(SAMPLE_OBLIGATIONS);
  });
  it('retains the generated 1.5000000 USDC instruction and fingerprint when its scale selector changes', async () => {
    render(<StoreProvider><ScaledSettlementCalc requireConfirmation /></StoreProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Illustrative Settlement Calculation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate Settlement Instruction' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cdp-clear-v1') ?? '{}').scaledInstruction?.usdcAmount).toBe('1.5000000'));
    const original = JSON.parse(localStorage.getItem('cdp-clear-v1') ?? '{}').scaledInstruction;
    expect(original.financialFingerprint).toMatch(/^[a-f0-9]{64}$/);
    fireEvent.click(screen.getByRole('radio', { name: /One-hundredth/ }));
    expect(JSON.parse(localStorage.getItem('cdp-clear-v1') ?? '{}').scaledInstruction).toEqual(original);
  });
});