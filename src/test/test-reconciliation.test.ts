import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestSettlement, matchTestPayment, verifyExistingTestPayment, type ActualPayment } from '@/lib/test-reconciliation';
import { DEFAULT_ISSUER, TESTNET_PASSPHRASE } from '@/lib/stellar';
import { SAMPLE_OBLIGATIONS, netObligations } from '@/lib/netting';
const hash = 'c'.repeat(64);
const source = 'G' + 'A'.repeat(55), destination = 'G' + 'B'.repeat(55);
const record = createTestSettlement(source, destination, hash);
const tx = { hash, successful: true, created_at: '2026-10-25T15:00:00Z', ledger: 123 };
const op: ActualPayment = { id: 'operation-1', transaction_hash: hash, transaction_successful: true, type: 'payment', from: source, to: destination, amount: '1.0000000', asset_code: 'USDC', asset_issuer: DEFAULT_ISSUER };
const mocks = vi.hoisted(() => ({ root: vi.fn(), tx: vi.fn(), page: vi.fn(), next: vi.fn() }));
vi.mock('@stellar/stellar-sdk', () => ({ StrKey: { isValidEd25519PublicKey: (value: string) => /^G[A-Z2-7]{55}$/.test(value) }, Horizon: { Server: class {
  root = mocks.root;
  transactions() { return { transaction: () => ({ call: mocks.tx }) }; }
  operations() { return { forTransaction: () => ({ limit: () => ({ order: () => ({ call: mocks.page }) }) }) }; }
} } }));
afterEach(() => vi.clearAllMocks());
describe('retrospective exact Testnet reconciliation', () => {
  it('reconciles TEST-SETTLEMENT-001 for exactly one USDC and preserves 3100/1500 netting', () => {
    expect(record.id).toBe('TEST-SETTLEMENT-001');
    expect(matchTestPayment(record, tx, [op], [])).toMatchObject({ status: 'Reconciled', operationId: 'operation-1', confirmedAt: tx.created_at });
    expect(netObligations(SAMPLE_OBLIGATIONS)).toMatchObject({ gross: 3100, net: 1500, reductionPct: expect.any(Number) });
  });
  it.each([
    ['sender', { from: destination }], ['recipient', { to: source }], ['amount', { amount: '1.0000001' }], ['sub-stroop decimal', { amount: '1.00000001' }], ['asset code', { asset_code: 'OTHER' }], ['issuer', { asset_issuer: source }], ['transaction membership', { transaction_hash: 'b'.repeat(64) }], ['operation success', { transaction_successful: false }],
  ])('rejects %s mismatch', (_name, patch) => {
    expect(matchTestPayment(record, tx, [{ ...op, ...patch }], []).status).toBe('Exception — Mismatch');
  });
  it('rejects unsuccessful transactions', () => {
    expect(matchTestPayment(record, { ...tx, successful: false }, [op], []).checks.confirmed).toBe(false);
    expect(matchTestPayment(record, { ...tx, successful: false }, [op], []).status).toBe('Exception — Mismatch');
  });
  it('does not assume the first payment is the matching operation', () => {
    expect(matchTestPayment(record, tx, [{ ...op, id: 'other', amount: '2.0000000' }, op], []).operationId).toBe(op.id);
  });
  it('rejects allocation of a previously reconciled payment operation', () => {
    expect(matchTestPayment(record, tx, [op], [`${hash}:${op.id}`]).status).toBe('Exception — Mismatch');
    expect(matchTestPayment(record, tx, [op], [hash]).status).toBe('Exception — Mismatch');
  });
  it('checks additional operation pages even when the first page is short', async () => {
    mocks.root.mockResolvedValue({ network_passphrase: TESTNET_PASSPHRASE }); mocks.tx.mockResolvedValue(tx);
    mocks.page.mockResolvedValue({ records: [{ ...op, id: 'other', amount: '2' }], next: mocks.next });
    mocks.next.mockResolvedValueOnce({ records: [op], next: mocks.next }).mockResolvedValueOnce({ records: [], next: mocks.next });
    expect((await verifyExistingTestPayment(record, [])).status).toBe('Reconciled');
    expect(mocks.next).toHaveBeenCalledTimes(2);
  });
  it('reports Horizon outages without reconciliation', async () => {
    mocks.root.mockRejectedValue(new Error('Horizon unavailable'));
    expect(await verifyExistingTestPayment(record, [])).toMatchObject({ status: 'Verification unavailable', reasons: ['Horizon unavailable'] });
  });
  it('blocks wrong networks before looking up the transaction', async () => {
    mocks.root.mockResolvedValue({ network_passphrase: 'PUBLIC' });
    expect((await verifyExistingTestPayment(record, [])).status).toBe('Verification unavailable');
    expect(mocks.tx).not.toHaveBeenCalled();
  });
});