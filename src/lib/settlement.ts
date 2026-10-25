import { netObligations, type Obligation, type Party } from './netting';
import type { VerifyResult } from './stellar';

export const LIFECYCLE = ['Draft', 'Validated', 'Pending Authorisation', 'Submitted', 'Confirmed', 'Reconciled', 'Failed', 'Exception'] as const;
export type SettleStatus = (typeof LIFECYCLE)[number];
export interface Instruction {
  id: string;
  createdAt: string;
  assetCode: string;
  assetIssuer: string;
  source: string;
  destination: string;
  amount: number;
  currency: string;
  payer: Party;
  beneficiary: Party;
  obligationSnapshot: string;
  status: SettleStatus;
  txHash: string;
  issuerVerifiedAt?: string | undefined;
  confirmedAt?: string | undefined;
  reconciledAt?: string | undefined;
  ledger?: number | undefined;
  verifiedNote?: string;
}
export const publicAddress = (s: string) => /^G[A-Z2-7]{55}$/.test(s.trim());
export const obligationSnapshot = (trades: Obligation[]) => JSON.stringify(trades);
export function reconcileInstruction(instruction: Instruction, result: VerifyResult, trades: Obligation[], history: Instruction[]): Instruction {
  const duplicate = history.some(i => i.id !== instruction.id && i.status === 'Reconciled' && i.txHash === instruction.txHash);
  const net = netObligations(trades);
  const unchanged = net.ok && net.net > 0 && net.net === instruction.amount && net.currency === instruction.currency && net.payer === instruction.payer && net.payee === instruction.beneficiary && obligationSnapshot(trades) === instruction.obligationSnapshot;
  if (!result.confirmed) return { ...instruction, status: result.failed ? 'Failed' : 'Exception', verifiedNote: result.reasons.join(' ') };
  const confirmed = { ...instruction, confirmedAt: result.createdAt, ledger: result.ledger };
  if (duplicate || !unchanged || !result.ok || !instruction.issuerVerifiedAt) {
    return { ...confirmed, status: 'Exception', verifiedNote: duplicate ? 'Transaction already allocated to a reconciled instruction.' : !unchanged ? 'Netting set changed; create a new instruction.' : !instruction.issuerVerifiedAt ? 'Asset issuer requires testnet validation.' : result.reasons.join(' ') };
  }
  return { ...confirmed, status: 'Reconciled', reconciledAt: new Date().toISOString(), verifiedNote: 'Asset, issuer, amount, payer and beneficiary match the snapshotted net settlement obligation.' };
}