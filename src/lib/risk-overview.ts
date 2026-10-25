import { deriveObligation, netObligations, type NetResult, type Obligation } from './netting';
import { obligationSnapshot, type Instruction } from './settlement';

/** Scenario-only copies: never writes to booked trades or instruction state. */
export function stressObligations(trades: Obligation[], shock: number): NetResult {
  if (!Number.isFinite(shock) || shock < -30 || shock > 30 || shock % 5 !== 0)
    return { ...netObligations([]), ok: false, error: 'Select a fixing shock from −30% to +30% in 5% steps.' };
  if (trades.some(trade => !trade.economics))
    return { ...netObligations([]), ok: false, error: 'GPU-forward economics are required for each scenario trade.' };
  const base = netObligations(trades);
  if (!base.ok) return base;
  return netObligations(trades.map(trade => {
    if (!trade.economics) return trade;
    return deriveObligation({ ...trade, economics: { ...trade.economics, fixing: trade.economics.fixing * (1 + shock / 100) } });
  }));
}

/** Signed cash balance to CP-A: preserves meaning when the payer reverses. */
export const signedNet = (result: NetResult) => result.payer === 'A' ? -result.net : result.net;

export function overviewSettlement(trades: Obligation[], instruction: Instruction | null, history: Instruction[]) {
  const snapshot = obligationSnapshot(trades);
  const current = history.find(row => row.status === 'Reconciled' && row.obligationSnapshot === snapshot)
    ?? (instruction?.obligationSnapshot === snapshot ? instruction : null);
  const net = netObligations(trades);
  const stale = Boolean(instruction && instruction.obligationSnapshot !== snapshot && !current);
  const verified = Boolean(current?.confirmedAt && current.txHash && current.issuerVerifiedAt);
  const status = current?.status ?? (stale ? 'Changed obligations' : 'Uninstructed');
  const action: { label: string; to: '/' | '/netting' | '/settlement' } = !trades.length || !net.ok
    ? { label: 'Review obligations', to: '/' }
    : !net.net ? { label: 'Review netting · no payment required', to: '/netting' }
    : trades.some(trade => trade.lifecycle === 'Captured') ? { label: 'Validate trades', to: '/' }
    : !current ? { label: 'Calculate Net / Generate Instruction', to: '/netting' }
    : current.status === 'Reconciled' ? { label: 'Review reconciliation', to: '/settlement' }
    : current.status === 'Draft' ? { label: 'Validate instruction', to: '/settlement' }
    : current.status === 'Failed' || current.status === 'Exception' ? { label: 'Review exception / Retry verification', to: '/settlement' }
    : { label: 'Verify Settlement', to: '/settlement' };
  return { current, status, action, stale, verified };
}