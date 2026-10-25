import { DEFAULT_ISSUER } from '@/lib/stellar';
import { STELLAR_CONFIG } from '@/lib/stellar-config';

// Exact testnet configuration, never an asset-code-only lookup. No signing/submission here.
export const USDC_ASSET = { code: 'USDC', issuer: DEFAULT_ISSUER } as const;
interface BalanceRow {
  asset_type: string; asset_code?: string; asset_issuer?: string;
  balance: string; selling_liabilities?: string; buying_liabilities?: string;
  limit?: string; is_authorized?: boolean; is_authorized_to_maintain_liabilities?: boolean;
}
interface AccountData {
  account_id: string; balances: BalanceRow[]; subentry_count: number;
  num_sponsoring?: number; num_sponsored?: number;
}
export interface AccountBalances {
  address: string; xlm: string; availableXlm: string; reserveXlm: string;
  usdc: string | null; spendableUsdc: string | null;
  trustline: boolean; authorised: boolean; receiveCapacity: string | null;
}
export interface WalletBalances {
  payer: AccountBalances | null; beneficiary: AccountBalances | null;
  payerError: string | null; beneficiaryError: string | null;
  feeXlm: string; checkedAt: string;
}
const SCALE = 10_000_000n;
export function stroops(value: string): bigint {
  if (!/^\d+(\.\d{1,7})?$/.test(value)) throw new Error('Invalid balance returned by Testnet.');
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(7, '0'));
}
export function decimal(value: bigint): string {
  return `${value / SCALE}.${(value % SCALE).toString().padStart(7, '0')}`;
}
const positive = (value: bigint) => value > 0n ? value : 0n;
export function accountBalances(account: AccountData, baseReserve: bigint): AccountBalances {
  const native = account.balances.find(row => row.asset_type === 'native');
  if (!native) throw new Error('Testnet account returned no XLM balance.');
  const reserve = BigInt(Math.max(0, 2 + account.subentry_count + (account.num_sponsoring ?? 0) - (account.num_sponsored ?? 0))) * baseReserve;
  const asset = account.balances.find(row => (row.asset_type === 'credit_alphanum4' || row.asset_type === 'credit_alphanum12') && row.asset_code === USDC_ASSET.code && row.asset_issuer === USDC_ASSET.issuer);
  const authorised = asset?.is_authorized === true;
  return {
    address: account.account_id, xlm: decimal(stroops(native.balance)), reserveXlm: decimal(reserve),
    availableXlm: decimal(positive(stroops(native.balance) - reserve - stroops(native.selling_liabilities ?? '0'))),
    usdc: asset ? decimal(stroops(asset.balance)) : null,
    spendableUsdc: asset ? decimal(authorised ? positive(stroops(asset.balance) - stroops(asset.selling_liabilities ?? '0')) : 0n) : null,
    trustline: Boolean(asset), authorised,
    receiveCapacity: asset?.limit ? decimal(authorised ? positive(stroops(asset.limit) - stroops(asset.balance) - stroops(asset.buying_liabilities ?? '0')) : 0n) : null,
  };
}

export async function loadWalletBalances(source: string, destination: string): Promise<WalletBalances> {
  const { Horizon, StrKey } = await import('@stellar/stellar-sdk');
  if (!StrKey.isValidEd25519PublicKey(source)) throw new Error('Connect a valid payer public wallet.');
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const root = await server.root();
  if (root.network_passphrase !== STELLAR_CONFIG.networkPassphrase) throw new Error('Stellar Testnet network could not be verified.');
  const ledgerPage = await server.ledgers().order('desc').limit(1).call();
  const ledger = ledgerPage.records[0];
  if (!ledger) throw new Error('Testnet reserve and fee information unavailable.');
  const baseReserve = BigInt(ledger.base_reserve_in_stroops);
  const feeXlm = decimal(BigInt(ledger.base_fee_in_stroops));
  async function load(address: string): Promise<{ account: AccountBalances | null; error: string | null }> {
    try {
      const account = await server.loadAccount(address);
      if (account.account_id !== address) throw new Error('Returned account does not match the requested public address.');
      return { account: accountBalances(account, baseReserve), error: null };
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      return { account: null, error: status === 404 ? 'Account does not exist on Stellar Testnet. Fund it with Testnet XLM first.' : 'Testnet account lookup unavailable. Refresh to retry.' };
    }
  }
  const [payer, beneficiary] = await Promise.all([
    load(source),
    destination && StrKey.isValidEd25519PublicKey(destination) ? load(destination) : Promise.resolve({ account: null, error: destination ? 'Enter a valid beneficiary public G-address.' : 'Enter a beneficiary public address.' }),
  ]);
  return { payer: payer.account, beneficiary: beneficiary.account, payerError: payer.error, beneficiaryError: beneficiary.error, feeXlm, checkedAt: new Date().toISOString() };
}

export function fundingChecks(data: WalletBalances, amount: number, source: string, destination: string, issuer: string): string[] {
  const reasons: string[] = [];
  if (issuer !== USDC_ASSET.issuer) reasons.push('Instruction issuer differs from the configured Testnet USDC issuer.');
  if (!Number.isFinite(amount) || amount <= 0) reasons.push('A positive settlement amount is required.');
  if (source === destination) reasons.push('Payer and beneficiary must be different accounts.');
  if (data.payerError) reasons.push(`Payer: ${data.payerError}`);
  if (data.beneficiaryError) reasons.push(`Beneficiary: ${data.beneficiaryError}`);
  const required = Number.isFinite(amount) && amount > 0 ? stroops(amount.toFixed(7)) : 0n;
  if (!data.payer && !data.payerError) reasons.push('Payer balances are unavailable.');
  if (!data.beneficiary && !data.beneficiaryError) reasons.push('Beneficiary balances are unavailable.');
  if (data.payer) {
    if (data.payer.address !== source) reasons.push('Connected wallet does not match the instruction payer wallet.');
    if (!data.payer.trustline) reasons.push('Payer is missing the exact USDC trustline.');
    else if (!data.payer.authorised) reasons.push('Payer USDC trustline is not authorised to send.');
    else if (data.payer.spendableUsdc === null || stroops(data.payer.spendableUsdc) < required) reasons.push('Settlement amount exceeds spendable Testnet USDC.');
    if (stroops(data.payer.availableXlm) < stroops(data.feeXlm)) reasons.push('Insufficient spendable XLM for a single-payment base fee after reserves and liabilities.');
  }
  if (data.beneficiary) {
    if (data.beneficiary.address !== destination) reasons.push('Beneficiary lookup does not match the selected address.');
    if (!data.beneficiary.trustline) reasons.push('Beneficiary is missing the exact USDC trustline.');
    else if (!data.beneficiary.authorised) reasons.push('Beneficiary USDC trustline is not authorised to receive.');
    else if (data.beneficiary.receiveCapacity === null || stroops(data.beneficiary.receiveCapacity) < required) reasons.push('Beneficiary USDC trustline has insufficient receiving capacity.');
  }
  return reasons;
}