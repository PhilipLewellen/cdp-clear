import { useEffect, useState, type ReactNode } from "react";
import { SAMPLE_OBLIGATIONS, deriveObligation, upgradeObligation, type Obligation } from "./netting";
import { LIFECYCLE, type Instruction } from './settlement';
import { instructionActivity, type ActivityEvent } from './activity';
import { StoreContext } from './store-context';
const KEY = "cdp-clear-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [trades, updateTrades] = useState<Obligation[]>(SAMPLE_OBLIGATIONS);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const recordActivity = (event: Omit<ActivityEvent, 'id' | 'at'>) => setActivity(previous => [...previous, { ...event, id: crypto.randomUUID(), at: new Date().toISOString() }]);
  const setTrades = (rows: Obligation[]) => {
    const next = rows.map(deriveObligation);
    next.filter(row => !trades.some(old => old.id === row.id)).forEach(row => recordActivity({ category: 'Demo operation', action: 'Obligation created', reference: row.id, detail: `${row.currency} ${row.amount.toFixed(2)} · Illustrative obligation` }));
    next.filter(row => trades.some(old => old.id === row.id && JSON.stringify(old) !== JSON.stringify(row))).forEach(row => recordActivity({ category: 'Demo operation', action: 'Trade edited', reference: row.id, detail: `${row.currency} ${row.amount.toFixed(2)} · Derived from simulated GPU-forward economics`, lifecycle: row.lifecycle }));
    if (next.length < trades.length) recordActivity({ category: 'Demo operation', action: 'Obligation removed', reference: 'NS-AB-001', detail: `${trades.length - next.length} record(s) removed` });
    updateTrades(next);
  };
  const [instruction, updateInstruction] = useState<Instruction | null>(null);
  const [history, setHistory] = useState<Instruction[]>([]);
  const setInstruction = (i: Instruction | null) => {
    const event = instructionActivity(instruction, i);
    if (event) recordActivity(event);
    updateInstruction(i);
    if (i?.status === 'Reconciled') setHistory(previous => [...previous.filter(row => row.id !== i.id), i]);
  };
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(s?.trades)) updateTrades(s.trades.map((t: Obligation) => upgradeObligation({ settlementDate: '2026-10-26', lifecycle: 'Validated', eligible: true, ...t })));
      if (s?.instruction) updateInstruction(LIFECYCLE.includes(s.instruction.status) && s.instruction.obligationSnapshot ? s.instruction : { ...s.instruction, status: 'Exception', verifiedNote: 'Legacy instruction requires fresh issuer validation and independent network verification.' });
      if (Array.isArray(s?.history)) setHistory(s.history);
      if (Array.isArray(s?.activity)) setActivity(s.activity);
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ trades, instruction, history, activity }));
  }, [trades, instruction, history, activity, loaded]);
  const reset = () => {
    updateTrades(SAMPLE_OBLIGATIONS);
    updateInstruction(null);
    setHistory([]);
    setActivity([]);
    recordActivity({ category: 'Demo operation', action: 'Demo reset', reference: 'NS-AB-001', detail: 'Three valid eligible sample obligations restored' });
  };
  return <StoreContext.Provider value={{ trades, setTrades, instruction, history, setInstruction, reset, activity, recordActivity }}>{children}</StoreContext.Provider>;
}
