import { afterEach, describe, expect, it, vi } from 'vitest';
import { Account, Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { prepareTestPayment, submitTestPayment, readTestPayment, TEST_PAYMENT_AMOUNT } from '@/lib/test-payment';
import { loadWalletBalances, accountBalances, USDC_ASSET } from '@/lib/wallet-balances';
import { verifyTestnetAsset, verifyTestnetPayment } from '@/lib/stellar';
vi.mock('@/lib/stellar', async original => ({ ...await original<typeof import('@/lib/stellar')>(), verifyTestnetAsset: vi.fn(), verifyTestnetPayment: vi.fn() }));
vi.mock('@/lib/wallet-balances', async original => ({ ...await original<typeof import('@/lib/wallet-balances')>(), loadWalletBalances: vi.fn() }));
// Ephemeral fixture keys never leave this isolated test or enter application code.
const payer = Keypair.random(), recipient = Keypair.random().publicKey();
const source = payer.publicKey();
const balance = (address: string) => accountBalances({ account_id: address, subentry_count: 1, balances: [{ asset_type: 'native', balance: '10' }, { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: USDC_ASSET.issuer, balance: '2', limit: '100', is_authorized: true }] }, 5000000n);
function setup() {
  vi.mocked(verifyTestnetAsset).mockResolvedValue('2026-10-25');
  vi.mocked(loadWalletBalances).mockResolvedValue({ payer: balance(source), beneficiary: balance(recipient), payerError: null, beneficiaryError: null, feeXlm: '0.0000100', checkedAt: '' });
  const account = Object.assign(new Account(source, '123'), { account_id: source, signers: [{ key: source, weight: 1 }], thresholds: { med_threshold: 1 } });
  vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockResolvedValue(account as never);
  vi.spyOn(Horizon.Server.prototype, 'feeStats').mockResolvedValue({ last_ledger_base_fee: '100', fee_charged: { p95: '200' } } as never);
  vi.spyOn(Horizon.Server.prototype, 'root').mockResolvedValue({ network_passphrase: Networks.TESTNET } as never);
}
afterEach(() => vi.restoreAllMocks());
describe('separate Phase 3 Testnet payment', () => {
  it('builds exactly 1.0000000 of the configured USDC, not the 1500 obligation', async () => {
    setup(); const payment = await prepareTestPayment(source, recipient);
    const tx = TransactionBuilder.fromXDR(payment.xdr, Networks.TESTNET);
    expect(TEST_PAYMENT_AMOUNT).toBe('1.0000000'); expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0]).toMatchObject({ type: 'payment', destination: recipient, amount: '1.0000000', asset: new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5') });
    expect(tx.fee).toBe('200'); expect(payment.expiresAt).toBeGreaterThan(Date.now());
  });
  it('rejects blank recipients', async () => { await expect(prepareTestPayment(source, '')).rejects.toThrow('public G-address'); });
  it('rejects insufficient spendable USDC', async () => {
    setup(); const data = await loadWalletBalances(source, recipient); if (data.payer) data.payer.spendableUsdc = '0.9999999';
    await expect(prepareTestPayment(source, recipient)).rejects.toThrow('exceeds spendable');
  });
  it('rejects recipient missing the exact issuer trustline', async () => {
    setup(); const data = await loadWalletBalances(source, recipient); if (data.beneficiary) data.beneficiary.trustline = false;
    await expect(prepareTestPayment(source, recipient)).rejects.toThrow('exact USDC trustline');
  });
  it('rejects fees above the safety ceiling', async () => { setup(); vi.mocked(Horizon.Server.prototype.feeStats).mockResolvedValue({ last_ledger_base_fee: '100', fee_charged: { p95: '100001' } } as never); await expect(prepareTestPayment(source, recipient)).rejects.toThrow('safety limit'); });
  it('rejects altered signed payment before any submission', async () => {
    setup(); const payment = await prepareTestPayment(source, recipient);
    const altered = new TransactionBuilder(new Account(source, '123'), { fee: '200', networkPassphrase: Networks.TESTNET }).addOperation(Operation.payment({ destination: recipient, asset: Asset.native(), amount: '1' })).setTimeout(180).build(); altered.sign(payer);
    const submit = vi.spyOn(Horizon.Server.prototype, 'submitTransaction');
    await expect(submitTestPayment(payment, altered.toXDR(), vi.fn())).rejects.toThrow('altered'); expect(submit).not.toHaveBeenCalled();
  });
  it('submits only a valid payer signature and returns independent matching confirmation', async () => {
    setup(); const payment = await prepareTestPayment(source, recipient); const tx = TransactionBuilder.fromXDR(payment.xdr, Networks.TESTNET); tx.sign(payer);
    const hash = Array.from(tx.hash(), b => b.toString(16).padStart(2, '0')).join('');
    vi.spyOn(Horizon.Server.prototype, 'submitTransaction').mockResolvedValue({ successful: true, hash } as never);
    vi.mocked(verifyTestnetPayment).mockResolvedValue({ ok: true, confirmed: true, ledger: 42, reasons: [] });
    const pending = vi.fn(); expect(await submitTestPayment(payment, tx.toXDR(), pending)).toEqual({ hash, ledger: 42 }); expect(pending).toHaveBeenCalledWith(hash);
    expect(verifyTestnetPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 1, source, destination: recipient, assetIssuer: USDC_ASSET.issuer }));
  });
  it('never reports success for unconfirmed or mismatching transactions', async () => {
    vi.mocked(verifyTestnetPayment).mockResolvedValue({ ok: false, reasons: [] });
    const payment = { source, destination: recipient, xdr: '', expiresAt: 0, feeXlm: '' };
    expect(await readTestPayment('a'.repeat(64), payment)).toBeNull();
    vi.mocked(verifyTestnetPayment).mockResolvedValue({ ok: false, confirmed: true, reasons: [] }); await expect(readTestPayment('a'.repeat(64), payment)).rejects.toThrow('does not match');
  });
});
