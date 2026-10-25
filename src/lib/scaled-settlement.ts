import { deriveObligation, netObligations, type NetResult, type Obligation, type Party } from './netting';
import { DEFAULT_ISSUER, verifyTestnetPayment, type VerifyResult } from './stellar';
import { decimal } from './wallet-balances';

// Scaled Stellar Testnet Demonstration. Illustrative assumption: 1 USD = 1 USDC.
// Scaling never alters booked trades, the historical 1 USDC record or any reconciliation state.
export interface SettlementScale { key: string; label: string; ratio: string; divisor: number; }
export const SETTLEMENT_SCALES: SettlementScale[] = [
  { key: 'full', label: 'Full size', ratio: '1:1', divisor: 1 },
  { key: 'tenth', label: 'One-tenth', ratio: '1:10', divisor: 10 },
  { key: 'hundredth', label: 'One-hundredth', ratio: '1:100', divisor: 100 },
  { key: 'thousandth', label: 'One-thousandth', ratio: '1:1,000', divisor: 1000 },
  { key: 'ten-thousandth', label: 'One-ten-thousandth', ratio: '1:10,000', divisor: 10000 },
];
export const DEFAULT_SCALE = SETTLEMENT_SCALES[3]; // One-thousandth

/** Proportional quantity scaling on copies; prices and fixings stay unchanged. */
export function scaleTrades(trades: Obligation[], divisor: number): Obligation[] {
  if (!Number.isFinite(divisor) || divisor < 1) throw new Error('Settlement scale must be a positive divisor.');
  return trades.map(trade => trade.economics
    ? deriveObligation({ ...trade, economics: { ...trade.economics, quantity: trade.economics.quantity / divisor } })
    : { ...trade, amount: Math.round(trade.amount / divisor * 100) / 100 });
}

export function scaledNet(trades: Obligation[], divisor: number): NetResult {
  return netObligations(scaleTrades(trades, divisor));
}

/** Netting works in exact cents, so seven-decimal Stellar precision is exact here. */
export function usdcAmount(net: number): string {
  if (!Number.isFinite(net) || net <= 0) throw new Error('A positive net obligation is required.');
  return decimal(BigInt(Math.round(net * 100)) * 100_000n);
}

export type ScaledStatus = 'Instruction Created' | 'Payment Submitted' | 'Payment Confirmed' | 'Reconciled' | 'Exception — Mismatch' | 'Verification unavailable' | 'Failed';
export interface ScaledInstruction {
  id: string;
  createdAt: string;
  divisor: number;
  originalGross: number;
  originalNet: number;
  scaledGross: number;
  scaledNet: number;
  payer: Party;
  beneficiary: Party;
  usdcAmount: string;
  assetCode: string;
  assetIssuer: string;
  network: string;
  snapshot: string;
  recipient: string;
  status: ScaledStatus;
  txHash: string;
  ledger?: number | undefined;
  confirmedAt?: string | undefined;
  reconciledAt?: string | undefined;
  verifiedNote?: string | undefined;
}

export function generateScaledInstruction(trades: Obligation[], scale: SettlementScale): ScaledInstruction {
  const original = netObligations(trades);
  if (!original.ok) throw new Error(original.error ?? 'Netting unavailable.');
  if (!original.payer || !original.payee || original.net <= 0) throw new Error('No net obligation to settle at this scale.');
  const scaled = scaledNet(trades, scale.divisor);
  if (!scaled.ok || !scaled.payer || scaled.payer !== original.payer || scaled.payee !== original.payee || scaled.net <= 0)
    throw new Error('Scaled netting is unavailable or changes the payment direction.');
  return {
    id: `SI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    divisor: scale.divisor,
    originalGross: original.gross,
    originalNet: original.net,
    scaledGross: scaled.gross,
    scaledNet: scaled.net,
    payer: original.payer,
    beneficiary: original.payee,
    usdcAmount: usdcAmount(scaled.net),
    assetCode: 'USDC',
    assetIssuer: DEFAULT_ISSUER,
    network: 'Stellar Testnet',
    snapshot: JSON.stringify(scaleTrades(trades, scale.divisor)),
    recipient: '',
    status: 'Instruction Created',
    txHash: '',
  };
}

/** The instruction stays valid only while the booked portfolio still reproduces its snapshot. */
export function snapshotUnchanged(instruction: ScaledInstruction, trades: Obligation[]): boolean {
  return instruction.snapshot === JSON.stringify(scaleTrades(trades, instruction.divisor));
}

export function reconcileScaled(instruction: ScaledInstruction, result: VerifyResult, trades: Obligation[], allocatedHashes: string[]): ScaledInstruction {
  const duplicate = allocatedHashes.includes(instruction.txHash);
  const unchanged = snapshotUnchanged(instruction, trades);
  if (!result.confirmed) return { ...instruction, status: result.failed ? 'Failed' : 'Verification unavailable', verifiedNote: result.reasons.join(' ') };
  const confirmed = { ...instruction, confirmedAt: result.createdAt, ledger: result.ledger };
  if (duplicate || !unchanged || !result.ok) {
    return { ...confirmed, status: 'Exception — Mismatch', verifiedNote: duplicate ? 'Transaction already allocated to another reconciled settlement.' : !unchanged ? 'Portfolio changed since this instruction; generate a new instruction.' : result.reasons.join(' ') };
  }
  return { ...confirmed, status: 'Reconciled', reconciledAt: new Date().toISOString(), verifiedNote: 'Network, sender, recipient, exact USDC amount, asset code and Circle Testnet issuer all match this instruction.' };
}

export async function verifyScaledInstruction(instruction: ScaledInstruction, trades: Obligation[], allocatedHashes: string[]): Promise<ScaledInstruction> {
  try {
    const result = await verifyTestnetPayment({ hash: instruction.txHash, source: instruction.snapshot ? payerAddress(instruction) : '', destination: instruction.recipient, amount: Number(instruction.usdcAmount), assetCode: instruction.assetCode, assetIssuer: instruction.assetIssuer });
    return reconcileScaled(instruction, result, trades, allocatedHashes);
  } catch (error) {
    return { ...instruction, status: 'Verification unavailable', verifiedNote: error instanceof Error ? error.message : 'Horizon verification unavailable.' };
  }
}

/** Payer wallet is recorded on the instruction at payment time, never assumed. */
export function payerAddress(instruction: ScaledInstruction): string {
  return (instruction as ScaledInstruction & { payerAddress?: string }).payerAddress ?? '';
}
