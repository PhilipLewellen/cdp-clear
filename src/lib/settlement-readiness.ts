import type { Obligation } from './netting';
import { netObligations } from './netting';
import { snapshotUnchanged, type ScaledInstruction } from './scaled-settlement';
import { stroops, USDC_ASSET, type WalletBalances } from './wallet-balances';

// Pure pre-settlement readiness and payment-state rules. Missing network data is never a pass.
export type CheckStatus = 'Passed' | 'Failed' | 'Unable to verify';
export interface ReadinessCheck { id: string; label: string; status: CheckStatus; detail: string; }
export interface ReadinessInput {
  instruction: ScaledInstruction;
  trades: Obligation[];
  wallet: { address: string | null; networkOk: boolean | null; networkError?: string | undefined };
  balances: WalletBalances | null;
  balancesError?: string | undefined;
  unresolvedHash?: string | null | undefined;
}
/** Conservative fee allowance: the payment flow's 0.0100000 XLM maximum fee. */
export const MAX_FEE_XLM = '0.0100000';

const pass = (id: string, label: string, detail: string): ReadinessCheck => ({ id, label, status: 'Passed', detail });
const fail = (id: string, label: string, detail: string): ReadinessCheck => ({ id, label, status: 'Failed', detail });
const unknown = (id: string, label: string, detail: string): ReadinessCheck => ({ id, label, status: 'Unable to verify', detail });

export function readinessChecks(i: ReadinessInput): ReadinessCheck[] {
  const { instruction: ins } = i;
  const checks: ReadinessCheck[] = [];
  checks.push(ins.snapshot && snapshotUnchanged(ins, i.trades)
    ? pass('snapshot', 'Instruction and snapshot', `${ins.id} matches its immutable portfolio snapshot.`)
    : fail('snapshot', 'Instruction and snapshot', 'The portfolio changed after generation. Generate a new instruction.'));
  let amountOk = false;
  try { amountOk = stroops(ins.usdcAmount) > 0n; } catch { amountOk = false; }
  checks.push(amountOk && ins.payer !== ins.beneficiary
    ? pass('direction', 'Net amount and direction', `${ins.usdcAmount} USDC · CP-${ins.payer} pays CP-${ins.beneficiary}.`)
    : fail('direction', 'Net amount and direction', 'The instruction has no positive amount or a valid payer/recipient direction.'));
  const net = netObligations(i.trades);
  checks.push(net.ok && i.trades.every(t => t.eligible !== false)
    ? pass('eligibility', 'Netting eligibility', 'All obligations passed the netting eligibility rules.')
    : fail('eligibility', 'Netting eligibility', net.ok ? 'An obligation is marked ineligible.' : net.error ?? 'Netting rules not met.'));

  const addr = i.wallet.address;
  if (!addr) checks.push(unknown('wallet', 'Freighter on Testnet as payer', 'Connect Freighter to verify the network and payer account.'));
  else if (i.wallet.networkOk === false) checks.push(fail('wallet', 'Freighter on Testnet as payer', i.wallet.networkError ?? 'Freighter is not on Stellar Testnet.'));
  else if (i.wallet.networkOk === null) checks.push(unknown('wallet', 'Freighter on Testnet as payer', 'Freighter network could not be confirmed.'));
  else if (ins.payerAddress && ins.payerAddress !== addr) checks.push(fail('wallet', 'Freighter on Testnet as payer', `Connected account differs from the recorded CP-${ins.payer} payer ${ins.payerAddress}.`));
  else checks.push(pass('wallet', 'Freighter on Testnet as payer', ins.payerAddress ? 'Connected account matches the recorded payer.' : `Testnet confirmed. No payer address was pre-registered; the connected account acts as CP-${ins.payer} and is recorded on submission.`));

  const b = i.balances;
  const required = amountOk ? stroops(ins.usdcAmount) : 0n;
  const noData = i.balancesError ?? 'Run the readiness check to load live Testnet balances.';
  if (!b || !b.payer) checks.push(unknown('usdc', 'Payer USDC balance', b?.payerError ?? noData), unknown('xlm', 'Payer XLM for fee and reserve', b?.payerError ?? noData));
  else {
    if (b.payer.address !== addr) checks.push(fail('usdc', 'Payer USDC balance', 'Balance data belongs to a different account. Re-run the check.'));
    else if (!b.payer.trustline) checks.push(fail('usdc', 'Payer USDC balance', 'Payer has no trustline for the exact USDC issuer.'));
    else if (!b.payer.authorised) checks.push(fail('usdc', 'Payer USDC balance', 'Payer USDC trustline is not authorised.'));
    else if (b.payer.spendableUsdc === null) checks.push(unknown('usdc', 'Payer USDC balance', 'Spendable USDC unavailable.'));
    else if (stroops(b.payer.spendableUsdc) < required) checks.push(fail('usdc', 'Payer USDC balance', `Spendable ${b.payer.spendableUsdc} USDC is below the required ${ins.usdcAmount} USDC.`));
    else checks.push(pass('usdc', 'Payer USDC balance', `${b.payer.spendableUsdc} USDC spendable · ${ins.usdcAmount} required.`));
    checks.push(stroops(b.payer.availableXlm) >= stroops(MAX_FEE_XLM)
      ? pass('xlm', 'Payer XLM for fee and reserve', `${b.payer.availableXlm} XLM available above the ${b.payer.reserveXlm} XLM reserve.`)
      : fail('xlm', 'Payer XLM for fee and reserve', `Only ${b.payer.availableXlm} XLM available above reserve; ${MAX_FEE_XLM} XLM fee allowance needed.`));
  }
  if (!b || !b.beneficiary) checks.push(b?.beneficiaryError?.includes('does not exist') || b?.beneficiaryError?.includes('valid') ? fail('recipient', 'Recipient account and USDC trustline', b.beneficiaryError) : unknown('recipient', 'Recipient account and USDC trustline', b?.beneficiaryError ?? noData));
  else if (!b.beneficiary.trustline) checks.push(fail('recipient', 'Recipient account and USDC trustline', `Recipient has no trustline for ${USDC_ASSET.code} · ${USDC_ASSET.issuer}.`));
  else if (!b.beneficiary.authorised) checks.push(fail('recipient', 'Recipient account and USDC trustline', 'Recipient USDC trustline is not authorised to receive.'));
  else if (b.beneficiary.receiveCapacity === null || stroops(b.beneficiary.receiveCapacity) < required) checks.push(fail('recipient', 'Recipient account and USDC trustline', 'Recipient trustline limit cannot receive this amount.'));
  else checks.push(pass('recipient', 'Recipient account and USDC trustline', 'Recipient exists with an authorised trustline for the exact USDC issuer.'));

  const blocked = ins.status !== 'Instruction Created' || Boolean(ins.txHash) || Boolean(i.unresolvedHash);
  checks.push(blocked
    ? fail('unpaid', 'No prior or unresolved payment', i.unresolvedHash ? 'An earlier submission is unresolved. Check its status before any new payment.' : `Instruction is already ${ins.status}.`)
    : pass('unpaid', 'No prior or unresolved payment', 'Not submitted, confirmed or reconciled; no unresolved attempt.'));
  return checks;
}

export const readyToPay = (checks: ReadinessCheck[]) => checks.length > 0 && checks.every(c => c.status === 'Passed');

export type PaymentState = 'Ready' | 'Awaiting Signature' | 'Submitting' | 'Confirmation Pending' | 'Confirmed' | 'Reconciled' | 'Rejected' | 'Failed' | 'Verification Unavailable' | 'Exception';
export interface PaymentStateInput { instruction: ScaledInstruction; phase: 'idle' | 'signing' | 'submitting'; unresolvedHash: string | null; outcome: 'rejected' | 'failed' | 'unavailable' | null; }
export function paymentState(i: PaymentStateInput): PaymentState {
  const s = i.instruction.status;
  if (s === 'Reconciled') return 'Reconciled';
  if (s === 'Exception — Mismatch') return 'Exception';
  if (s === 'Payment Confirmed') return 'Confirmed';
  if (s === 'Failed') return 'Failed';
  if (i.phase === 'signing') return 'Awaiting Signature';
  if (i.phase === 'submitting') return 'Submitting';
  if (s === 'Verification unavailable' || (i.unresolvedHash && i.outcome === 'unavailable')) return 'Verification Unavailable';
  if (s === 'Payment Submitted' || i.unresolvedHash) return 'Confirmation Pending';
  if (i.outcome === 'rejected') return 'Rejected';
  if (i.outcome === 'failed') return 'Failed';
  return 'Ready';
}

/** Read-only recovery classification for a known submitted hash. */
export type Recovery = 'confirmed' | 'failed-on-chain' | 'pending' | 'expired-not-found' | 'unavailable';
export function classifyRecovery(lookup: { found: boolean; confirmed?: boolean; failed?: boolean } | 'error', expiresAt: number, now = Date.now()): Recovery {
  if (lookup === 'error') return 'unavailable';
  if (lookup.failed) return 'failed-on-chain';
  if (lookup.found && lookup.confirmed) return 'confirmed';
  // A transaction past its time bounds (plus ledger close margin) that Horizon never saw can no longer be applied.
  if (!lookup.found && expiresAt > 0 && now > expiresAt + 60_000) return 'expired-not-found';
  return 'pending';
}

export function isWalletRejection(message: string): boolean {
  return /reject|declin|denied|cancel|no signature/i.test(message);
}
