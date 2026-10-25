import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountBalances, fundingChecks, loadWalletBalances, stroops, USDC_ASSET, type WalletBalances } from '@/lib/wallet-balances';
import { TESTNET_PASSPHRASE } from '@/lib/stellar';
import { Horizon, Keypair } from '@stellar/stellar-sdk';

const source = Keypair.random().publicKey();
const destination = Keypair.random().publicKey();
const native = { asset_type: 'native', balance: '10', selling_liabilities: '1' };
const usdc = { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: USDC_ASSET.issuer, balance: '1600', selling_liabilities: '100', buying_liabilities: '0', limit: '10000', is_authorized: true };
const account = (address = source) => ({ account_id: address, subentry_count: 1, balances: [native, usdc] });
const data = (): WalletBalances => ({ payer: accountBalances(account(), 5_000_000n), beneficiary: accountBalances(account(destination), 5_000_000n), payerError: null, beneficiaryError: null, feeXlm: '0.0000100', checkedAt: '2026-10-25' });
const checks = (value: WalletBalances, amount = 1500) => fundingChecks(value, amount, source, destination, USDC_ASSET.issuer);
afterEach(() => vi.restoreAllMocks());
describe('Phase 2 read-only account funding checks', () => {
  it('uses the exact configured Stellar Testnet USDC issuer', () => {
    expect(USDC_ASSET).toEqual({ code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' });
  });
  it('rejects code-only matches from another issuer', () => {
    const row = accountBalances({ ...account(), balances: [native, { ...usdc, asset_issuer: source }] }, 5_000_000n);
    expect(row.trustline).toBe(false); expect(row.usdc).toBeNull();
  });
  it('computes XLM after sponsorship-adjusted reserve and liabilities', () => {
    const row = accountBalances({ ...account(), subentry_count: 4, num_sponsoring: 2, num_sponsored: 1 }, 5_000_000n);
    expect(row.reserveXlm).toBe('3.5000000'); expect(row.availableXlm).toBe('5.5000000');
  });
  it('subtracts selling liabilities from spendable USDC', () => {
    expect(data().payer?.spendableUsdc).toBe('1500.0000000');
    expect(checks(data())).toEqual([]);
    expect(checks(data(), 1500.0000001)).toContain('Settlement amount exceeds spendable Testnet USDC.');
  });
  it('uses exact seven-decimal arithmetic', () => expect(stroops('1500.0000001') - stroops('1500')).toBe(1n));
  it('does not assume missing accounts have balances', () => {
    expect(checks({ ...data(), payer: null, payerError: 'Account does not exist on Stellar Testnet.' })).toContain('Payer: Account does not exist on Stellar Testnet.');
  });
  it('blocks a missing beneficiary trustline', () => {
    const beneficiary = accountBalances({ ...account(destination), balances: [native] }, 5_000_000n);
    expect(checks({ ...data(), beneficiary })).toContain('Beneficiary is missing the exact USDC trustline.');
  });
  it('requires full beneficiary authorisation, not maintain-liabilities-only', () => {
    const beneficiary = accountBalances({ ...account(destination), balances: [native, { ...usdc, is_authorized: false, is_authorized_to_maintain_liabilities: true }] }, 5_000_000n);
    expect(checks({ ...data(), beneficiary })).toContain('Beneficiary USDC trustline is not authorised to receive.');
  });
  it('requires payer authorisation to send', () => {
    const payer = accountBalances({ ...account(), balances: [native, { ...usdc, is_authorized: false }] }, 5_000_000n);
    expect(payer.spendableUsdc).toBe('0.0000000');
    expect(checks({ ...data(), payer })).toContain('Payer USDC trustline is not authorised to send.');
  });
  it('subtracts balance and buying liabilities from beneficiary receiving capacity', () => {
    const beneficiary = accountBalances({ ...account(destination), balances: [native, { ...usdc, limit: '3200', buying_liabilities: '101' }] }, 5_000_000n);
    expect(beneficiary.receiveCapacity).toBe('1499.0000000');
    expect(checks({ ...data(), beneficiary })).toContain('Beneficiary USDC trustline has insufficient receiving capacity.');
  });
  it('requires available XLM to cover the single-payment base fee', () => {
    const payer = accountBalances({ ...account(), balances: [{ ...native, balance: '1.5000000', selling_liabilities: '0' }, usdc] }, 5_000_000n);
    expect(payer.availableXlm).toBe('0.0000000');
    expect(checks({ ...data(), payer })).toContain('Insufficient spendable XLM for a single-payment base fee after reserves and liabilities.');
  });
  it('blocks a connected-wallet/instruction-payer mismatch', () => {
    expect(fundingChecks(data(), 1500, destination, source, USDC_ASSET.issuer)).toContain('Connected wallet does not match the instruction payer wallet.');
  });
  it('blocks an instruction issuer mismatch', () => {
    expect(fundingChecks(data(), 1500, source, destination, source)).toContain('Instruction issuer differs from the configured Testnet USDC issuer.');
  });
  it('blocks equal payer and beneficiary addresses', () => {
    expect(fundingChecks(data(), 1500, source, source, USDC_ASSET.issuer)).toContain('Payer and beneficiary must be different accounts.');
  });
  it('checks the Testnet network before loading accounts', async () => {
    vi.spyOn(Horizon.Server.prototype, 'root').mockResolvedValue({ network_passphrase: 'Public Global Stellar Network ; September 2015' } as Awaited<ReturnType<Horizon.Server['root']>>);
    const load = vi.spyOn(Horizon.Server.prototype, 'loadAccount');
    await expect(loadWalletBalances(source, destination)).rejects.toThrow('Stellar Testnet network');
    expect(load).not.toHaveBeenCalled();
  });
  it('loads both accounts through SDK loadAccount and reports 404 without fabricated balances', async () => {
    vi.spyOn(Horizon.Server.prototype, 'root').mockResolvedValue({ network_passphrase: TESTNET_PASSPHRASE } as Awaited<ReturnType<Horizon.Server['root']>>);
    vi.spyOn(Horizon.Server.prototype, 'ledgers').mockReturnValue({ order: () => ({ limit: () => ({ call: async () => ({ records: [{ base_reserve_in_stroops: 5000000, base_fee_in_stroops: 100 }] }) }) }) } as unknown as ReturnType<Horizon.Server['ledgers']>);
    const load = vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockImplementation(async address => {
      if (address === destination) throw { response: { status: 404 } };
      return account(address) as Awaited<ReturnType<Horizon.Server['loadAccount']>>;
    });
    const result = await loadWalletBalances(source, destination);
    expect(load).toHaveBeenCalledWith(source); expect(load).toHaveBeenCalledWith(destination);
    expect(result.payer?.usdc).toBe('1600.0000000'); expect(result.beneficiary).toBeNull();
    expect(result.beneficiaryError).toContain('Account does not exist');
  });
});