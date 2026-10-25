import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider } from '@/lib/store';
import { TestSettlementReconciliation } from '@/components/TestSettlementReconciliation';
import { createTestSettlement, verifyExistingTestPayment } from '@/lib/test-reconciliation';
import { DEFAULT_ISSUER } from '@/lib/stellar';
vi.mock('@/lib/test-reconciliation', async original => ({ ...await original<typeof import('@/lib/test-reconciliation')>(), verifyExistingTestPayment: vi.fn() }));
const hash = 'd'.repeat(64), source = 'G' + 'A'.repeat(55), destination = 'G' + 'B'.repeat(55);
function mount() { render(<StoreProvider><TestSettlementReconciliation /></StoreProvider>); }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);
describe('existing-payment record and read-only audit', () => {
  it('starts with blank missing inputs instead of inventing payment data', async () => {
    mount(); expect(await screen.findByLabelText('Expected sender public address')).toHaveValue('');
    expect(screen.getByLabelText('Existing payment transaction hash')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Reconcile Existing Payment' })).toBeDisabled();
  });
  it('loads saved Phase 3 public references without considering them reconciled', async () => {
    localStorage.setItem('cdp-clear-test-payment-confirmed', JSON.stringify({ source, destination, hash }));
    mount(); expect(await screen.findByLabelText('Existing payment transaction hash')).toHaveValue(hash);
    expect(screen.getByRole('status')).toHaveTextContent('Awaiting verification');
    expect(verifyExistingTestPayment).not.toHaveBeenCalled();
  });
  it('persists independently matched results and genuine separate audit times, then verifies again', async () => {
    const record = createTestSettlement(source, destination, hash);
    localStorage.setItem('cdp-clear-v1', JSON.stringify({ testSettlement: record }));
    vi.mocked(verifyExistingTestPayment).mockResolvedValue({ status: 'Reconciled', reasons: [], checks: { sender: true, recipient: true, amount: true, asset: true, confirmed: true, membership: true }, operationId: '42', confirmedAt: '2026-10-25T15:00:00Z', checkedAt: '2026-10-25T15:20:00Z', payments: [{ id: '42', type: 'payment', transaction_hash: hash, transaction_successful: true, from: source, to: destination, amount: '1.0000000', asset_code: 'USDC', asset_issuer: DEFAULT_ISSUER }] });
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Reconcile Existing Payment' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Reconciled'));
    expect(screen.getByRole('link')).toHaveAttribute('href', `https://stellar.expert/explorer/testnet/tx/${hash}`);
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cdp-clear-v1') || '{}').testSettlement.result.status).toBe('Reconciled'));
    const saved = JSON.parse(localStorage.getItem('cdp-clear-v1') || '{}');
    expect(saved.testSettlement.audit.find((e: { action: string }) => e.action === 'Transaction confirmed on Stellar').at).toBe('2026-10-25T15:00:00Z');
    expect(saved.testSettlement.audit.find((e: { action: string }) => e.action === 'Reconciliation completed').at).toBe('2026-10-25T15:20:00Z');
    cleanup(); mount(); await screen.findByRole('button', { name: 'Verify Again' });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Again' }));
    await waitFor(() => expect(verifyExistingTestPayment).toHaveBeenCalledTimes(2));
    expect(saved.instruction).toBeNull(); expect(saved.trades.map((row: { amount: number }) => row.amount)).toEqual([2000, 800, 300]);
  });
});