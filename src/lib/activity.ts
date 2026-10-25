import type { Instruction } from './settlement';

export interface ActivityEvent {
  id: string;
  at: string;
  category: 'Demo operation' | 'Network evidence';
  action: string;
  reference: string;
  detail: string;
  lifecycle?: string;
}

export function instructionActivity(previous: Instruction | null, next: Instruction | null): Omit<ActivityEvent, 'id' | 'at'> | null {
  if (!next || (previous?.id === next.id && previous.status === next.status)) return null;
  const genuinelyConfirmed = ['Confirmed', 'Reconciled'].includes(next.status) && Boolean(next.confirmedAt && next.txHash && next.issuerVerifiedAt);
  return {
    category: genuinelyConfirmed ? 'Network evidence' : 'Demo operation',
    action: next.status === 'Draft' ? 'Instruction generated' : next.status === 'Validated' ? 'Validation completed' : genuinelyConfirmed ? `Transaction ${next.status.toLowerCase()}` : next.status === 'Submitted' ? 'Verification requested' : `Instruction ${next.status.toLowerCase()}`,
    reference: next.id,
    detail: genuinelyConfirmed ? `Stellar Testnet · ${next.txHash}` : `${next.amount.toFixed(2)} testnet USDC · No payment initiated`,
    lifecycle: next.status === 'Submitted' && !genuinelyConfirmed ? 'Verification pending' : next.status,
  };
}