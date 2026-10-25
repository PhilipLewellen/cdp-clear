import { describe, expect, it } from 'vitest';
import { SAMPLE_OBLIGATIONS } from '@/lib/netting';
import { DEFAULT_SCALE, generateScaledInstruction } from '@/lib/scaled-settlement';
import { classifyRecovery, isWalletRejection, paymentState, readinessChecks, readyToPay } from '@/lib/settlement-readiness';
import type { AccountBalances, WalletBalances } from '@/lib/wallet-balances';

// Isolated test doubles only — no Horizon, Freighter or real payment.
const PAYER = 'G' + 'A'.repeat(55), RECIP = 'G' + 'B'.repeat(55);
const acct = (address: string, o: Partial<AccountBalances> = {}): AccountBalances => ({ address, xlm: '10.0000000', availableXlm: '8.0000000', reserveXlm: '2.0000000', usdc: '5.0000000', spendableUsdc: '5.0000000', trustline: true, authorised: true, receiveCapacity: '1000.0000000', ...o });
const bal = (p = acct(PAYER), b: AccountBalances | null = acct(RECIP), beneficiaryError: string | null = null): WalletBalances => ({ payer: p, beneficiary: b, payerError: null, beneficiaryError, feeXlm: '0.0000100', checkedAt: 'now' });
const ins = () => generateScaledInstruction(SAMPLE_OBLIGATIONS, DEFAULT_SCALE);
const run = (o: Partial<Parameters<typeof readinessChecks>[0]> = {}) => readinessChecks({ instruction: ins(), trades: SAMPLE_OBLIGATIONS, wallet: { address: PAYER, networkOk: true }, balances: bal(), ...o });
const status = (c: ReturnType<typeof run>, id: string) => c.find(x => x.id === id)?.status;

describe('settlement readiness', () => {
  it('passes every check for a funded Testnet payer and trustlined recipient', () => { expect(readyToPay(run())).toBe(true); });
  it('fails when payer USDC is below 1.5000000', () => { const c = run({ balances: bal(acct(PAYER, { spendableUsdc: '1.4999999' })) }); expect(status(c, 'usdc')).toBe('Failed'); expect(readyToPay(c)).toBe(false); });
  it('fails when XLM above reserve cannot cover the fee allowance', () => { expect(status(run({ balances: bal(acct(PAYER, { availableXlm: '0.0050000' })) }), 'xlm')).toBe('Failed'); });
  it('fails when the recipient lacks the exact USDC trustline', () => { expect(status(run({ balances: bal(acct(PAYER), acct(RECIP, { trustline: false })) }), 'recipient')).toBe('Failed'); });
  it('treats missing network data as Unable to verify, never Passed', () => { const c = run({ balances: null, balancesError: 'timeout' }); expect(status(c, 'usdc')).toBe('Unable to verify'); expect(readyToPay(c)).toBe(false); });
  it('fails when Freighter is not on Testnet', () => { expect(status(run({ wallet: { address: PAYER, networkOk: false } }), 'wallet')).toBe('Failed'); });
  it('fails when the connected account differs from a recorded payer', () => { expect(status(run({ instruction: { ...ins(), payerAddress: 'G' + 'C'.repeat(55) } }), 'wallet')).toBe('Failed'); });
  it('blocks payment while a submission is unresolved', () => { expect(status(run({ unresolvedHash: 'a'.repeat(64) }), 'unpaid')).toBe('Failed'); });
  it('blocks an already submitted instruction', () => { expect(status(run({ instruction: { ...ins(), status: 'Payment Submitted', txHash: 'a'.repeat(64) } }), 'unpaid')).toBe('Failed'); });
  it('fails when the portfolio changed after generation', () => { const changed = SAMPLE_OBLIGATIONS.map((t, i) => i ? t : { ...t, eligible: false }); expect(status(run({ trades: changed }), 'snapshot')).toBe('Failed'); });
});

describe('payment state and recovery', () => {
  const base = { instruction: ins(), phase: 'idle' as const, unresolvedHash: null, outcome: null };
  it('a wallet rejection is Rejected, not successful', () => { expect(isWalletRejection('User declined access')).toBe(true); expect(paymentState({ ...base, outcome: 'rejected' })).toBe('Rejected'); });
  it('an unresolved hash after a timeout is Confirmation Pending', () => { expect(paymentState({ ...base, unresolvedHash: 'a'.repeat(64) })).toBe('Confirmation Pending'); });
  it('an unreachable Horizon after submission is Verification Unavailable', () => { expect(paymentState({ ...base, unresolvedHash: 'a'.repeat(64), outcome: 'unavailable' })).toBe('Verification Unavailable'); });
  it('a not-yet-found hash within its time bounds stays pending', () => { expect(classifyRecovery({ found: false }, 1_000_000, 1_000_000)).toBe('pending'); });
  it('a hash never found after expiry plus margin is conclusively not applied', () => { expect(classifyRecovery({ found: false }, 1_000_000, 1_061_000)).toBe('expired-not-found'); });
  it('a lookup error is unavailable, not failed', () => { expect(classifyRecovery('error', 0)).toBe('unavailable'); });
  it('a confirmed lookup resumes verification', () => { expect(classifyRecovery({ found: true, confirmed: true }, 0)).toBe('confirmed'); });
});
