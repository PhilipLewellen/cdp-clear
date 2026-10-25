import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_OBLIGATIONS } from '@/lib/netting';
import { obligationSnapshot, reconcileInstruction, type Instruction } from '@/lib/settlement';
import { DEFAULT_ISSUER, TESTNET_PASSPHRASE, verifyTestnetPayment, verifyTestnetAsset } from '@/lib/stellar';

const hash = 'a'.repeat(64);
const instruction: Instruction = { id: 'SI-1', createdAt: '2026-10-25', assetCode: 'USDC', assetIssuer: DEFAULT_ISSUER, source: 'G' + 'A'.repeat(55), destination: 'G' + 'B'.repeat(55), currency: 'USD', payer: 'B', beneficiary: 'A', amount: 1500, obligationSnapshot: obligationSnapshot(SAMPLE_OBLIGATIONS), status: 'Confirmed', txHash: hash, issuerVerifiedAt: '2026-10-25' };
const success = { ok: true, confirmed: true, reasons: [], ledger: 123, createdAt: '2026-10-25' };
function network({ successful = true, from = instruction.source, to = instruction.destination, amount = '1500.0000000', asset_code = 'USDC', asset_issuer = DEFAULT_ISSUER, passphrase = TESTNET_PASSPHRASE, transaction_hash = hash, transaction_successful = true } = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ network_passphrase: passphrase }))).mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { records: [{ asset_code: 'USDC', asset_issuer: DEFAULT_ISSUER }] } }))).mockResolvedValueOnce(new Response(JSON.stringify({ hash, successful, ledger: 123, created_at: '2026-10-25' }))).mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { records: [{ id: '123-1', transaction_hash, transaction_successful, type: 'payment', from, to, amount, asset_code, asset_issuer }] } }))));
}
afterEach(() => vi.unstubAllGlobals());
describe('cash-leg verification and reconciliation', () => {
  it('independently confirms a successful matching testnet payment', async () => {
    network(); expect(await verifyTestnetPayment({ ...instruction, hash })).toMatchObject({ ...success, payment: { id: '123-1', transactionHash: hash, amount: '1500.0000000' } });
  });
  it('never confirms failed network execution', async () => {
    network({ successful: false }); const result = await verifyTestnetPayment({ ...instruction, hash });
    expect(result.confirmed).not.toBe(true); expect(result.failed).toBe(true);
    expect(reconcileInstruction(instruction, result, SAMPLE_OBLIGATIONS, []).status).toBe('Failed');
  });
  it('rejects a payment belonging to another transaction', async () => {
    network({ transaction_hash: 'b'.repeat(64) });
    expect((await verifyTestnetPayment({ ...instruction, hash })).ok).toBe(false);
  });
  it('rejects an unsuccessful operation even in a successful transaction response', async () => {
    network({ transaction_successful: false });
    expect((await verifyTestnetPayment({ ...instruction, hash })).ok).toBe(false);
  });
  it.each([
    ['asset code', { asset_code: 'OTHER' }], ['issuer', { asset_issuer: 'wrong' }], ['amount', { amount: '1499.0000000' }], ['payer', { from: 'wrong' }], ['beneficiary', { to: 'wrong' }],
  ])('never reconciles an unmatched %s', async (_rule, patch) => {
    network(patch); const result = await verifyTestnetPayment({ ...instruction, hash });
    expect(result.confirmed).toBe(true); expect(result.ok).toBe(false);
    expect(reconcileInstruction(instruction, result, SAMPLE_OBLIGATIONS, []).status).toBe('Exception');
  });
  it('reconciles only successful matching confirmation', () => {
    expect(reconcileInstruction(instruction, success, SAMPLE_OBLIGATIONS, []).status).toBe('Reconciled');
  });
  it('rejects duplicate transaction allocation', () => {
    const previous = { ...instruction, id: 'SI-0', status: 'Reconciled' as const };
    expect(reconcileInstruction(instruction, success, SAMPLE_OBLIGATIONS, [previous]).status).toBe('Exception');
  });
  it('rejects changed netting obligations', () => {
    expect(reconcileInstruction(instruction, success, SAMPLE_OBLIGATIONS.map(o => ({ ...o, amount: 0 })), []).status).toBe('Exception');
  });
  it('rejects a second payment for an already reconciled obligation snapshot', () => {
    const previous = { ...instruction, id: 'SI-0', status: 'Reconciled' as const, txHash: 'b'.repeat(64) };
    expect(reconcileInstruction(instruction, success, SAMPLE_OBLIGATIONS, [previous]).status).toBe('Exception');
  });
  it('rejects reconciliation without issuer validation', () => {
    expect(reconcileInstruction({ ...instruction, issuerVerifiedAt: undefined }, success, SAMPLE_OBLIGATIONS, []).status).toBe('Exception');
  });
  it('rejects the wrong network', async () => {
    network({ passphrase: 'Public Global Stellar Network ; September 2015' });
    await expect(verifyTestnetAsset(DEFAULT_ISSUER)).rejects.toThrow('Stellar Testnet network');
  });
  it('does not confirm during a network outage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unavailable')));
    await expect(verifyTestnetPayment({ ...instruction, hash })).rejects.toThrow('unavailable');
    expect(reconcileInstruction(instruction, { ok: false, reasons: ['unavailable'] }, SAMPLE_OBLIGATIONS, []).status).toBe('Exception');
  });
});