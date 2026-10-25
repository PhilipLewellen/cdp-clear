import { useEffect, useState, type ReactNode } from "react";
import { SAMPLE_OBLIGATIONS, deriveObligation, upgradeObligation, type Obligation } from "./netting";
import { LIFECYCLE, type Instruction } from './settlement';
import { instructionActivity, type ActivityEvent } from './activity';
import { StoreContext } from './store-context';
import { createTestSettlement, TEST_RECORD_ID, type TestSettlement } from './test-reconciliation';
import { savedPayment } from './payment-evidence';
import type { ScaledInstruction } from './scaled-settlement';
const KEY = "cdp-clear-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [trades, updateTrades] = useState<Obligation[]>(SAMPLE_OBLIGATIONS);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const recordActivity = (event: Omit<ActivityEvent, 'id' | 'at'>) => setActivity(previous => [...previous, { ...event, id: crypto.randomUUID(), at: new Date().toISOString() }]);
  const setTrades = (rows: Obligation[]) => {
    const next = rows.map(deriveObligation);
    next.filter(row => !trades.some(old => old.id === row.id)).forEach(row => recordActivity({ category: 'Demo operation', action: 'Obligation created', reference: row.id, detail: `${row.currency} ${row.amount.toFixed(2)} · Illustrative obligation` }));
    next.filter(row => trades.some(old => old.id === row.id && JSON.stringify(old) !== JSON.stringify(row))).forEach(row => recordActivity({ category: 'Demo operation', action: 'Trade edited', reference: row.id, detail: `${row.currency} ${row.amount.toFixed(2)} · Derived from simulated GPU-forward economics`, lifecycle: row.lifecycle ?? 'Captured' }));
    if (next.length < trades.length) recordActivity({ category: 'Demo operation', action: 'Obligation removed', reference: 'NS-AB-001', detail: `${trades.length - next.length} record(s) removed` });
    updateTrades(next);
  };
  const [instruction, updateInstruction] = useState<Instruction | null>(null);
  const [history, setHistory] = useState<Instruction[]>([]);
  const [testSettlement, updateTestSettlement] = useState<TestSettlement | null>(null);
  const setTestSettlement = (record: TestSettlement) => {
    updateTestSettlement(record);
    const added = record.audit.slice(testSettlement?.audit.length ?? 0);
    added.forEach(event => setActivity(previous => [...previous, {
      id: crypto.randomUUID(), at: event.at, category: event.action === 'Transaction confirmed on Stellar' ? 'Network evidence' : 'Demo operation',
      action: event.action, reference: record.id, detail: event.detail, lifecycle: record.result?.status ?? 'Awaiting verification',
    }]));
  };
  const setInstruction = (i: Instruction | null) => {
    const event = instructionActivity(instruction, i);
    if (event) recordActivity(event);
    updateInstruction(i);
    if (i?.status === 'Reconciled') setHistory(previous => [...previous.filter(row => row.id !== i.id), i]);
  };
  const [scaledInstruction, updateScaledInstruction] = useState<ScaledInstruction | null>(null);
  const setScaledInstruction = (next: ScaledInstruction | null) => {
    if (next && next.id !== scaledInstruction?.id) recordActivity({ category: 'Demo operation', action: 'Scaled instruction generated', reference: next.id, detail: `${next.usdcAmount} testnet USDC · 1:${next.divisor.toLocaleString('en-US')} scale · No payment initiated`, lifecycle: next.status });
    else if (next && next.status !== scaledInstruction?.status) recordActivity({ category: next.status === 'Reconciled' && next.confirmedAt && next.txHash ? 'Network evidence' : 'Demo operation', action: next.status === 'Reconciled' ? 'Scaled settlement reconciled' : `Scaled instruction ${next.status.toLowerCase()}`, reference: next.id, detail: next.txHash ? `Stellar Testnet · ${next.txHash}` : (next.verifiedNote ?? ''), lifecycle: next.status });
    updateScaledInstruction(next);
  };
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(s?.trades)) updateTrades(s.trades.map((t: Obligation) => upgradeObligation({ settlementDate: '2026-10-26', lifecycle: 'Validated', eligible: true, ...t })));
      if (s?.instruction) updateInstruction(LIFECYCLE.includes(s.instruction.status) && s.instruction.obligationSnapshot ? s.instruction : { ...s.instruction, status: 'Exception', verifiedNote: 'Legacy instruction requires fresh issuer validation and independent network verification.' });
      if (Array.isArray(s?.history)) setHistory(s.history);
      if (Array.isArray(s?.activity)) setActivity(s.activity);
      if (s?.scaledInstruction?.id && s.scaledInstruction.snapshot && typeof s.scaledInstruction.usdcAmount === 'string') updateScaledInstruction({ payerAddress: '', recipient: '', txHash: '', ...s.scaledInstruction });
      if (s?.testSettlement?.id === TEST_RECORD_ID && Array.isArray(s.testSettlement.audit)) updateTestSettlement(s.testSettlement);
      else {
        const saved = savedPayment();
        updateTestSettlement(createTestSettlement(saved?.source, saved?.destination, saved?.hash));
      }
    } catch { updateTestSettlement(createTestSettlement()); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ trades, instruction, history, activity, testSettlement, scaledInstruction }));
  }, [trades, instruction, history, activity, testSettlement, scaledInstruction, loaded]);
  const reset = () => {
    updateTrades(SAMPLE_OBLIGATIONS);
    updateInstruction(null);
    setHistory([]);
    updateScaledInstruction(null);
    setActivity(previous => previous.filter(event => event.reference === TEST_RECORD_ID));
    recordActivity({ category: 'Demo operation', action: 'Demo reset', reference: 'NS-AB-001', detail: 'Three valid eligible sample obligations restored' });
  };
  return <StoreContext.Provider value={{ trades, setTrades, instruction, history, setInstruction, reset, activity, recordActivity, testSettlement, setTestSettlement, scaledInstruction, setScaledInstruction }}>{children}</StoreContext.Provider>;
}
