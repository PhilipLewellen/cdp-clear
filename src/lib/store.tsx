import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SAMPLE_OBLIGATIONS, type Obligation } from "./netting";
import { LIFECYCLE, type Instruction } from './settlement';
export type { Instruction, SettleStatus } from './settlement';

interface Store {
  trades: Obligation[];
  setTrades: (t: Obligation[]) => void;
  instruction: Instruction | null;
  history: Instruction[];
  setInstruction: (i: Instruction | null) => void;
  reset: () => void;
}
const Ctx = createContext<Store | null>(null);
const KEY = "cdp-clear-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Obligation[]>(SAMPLE_OBLIGATIONS);
  const [instruction, updateInstruction] = useState<Instruction | null>(null);
  const [history, setHistory] = useState<Instruction[]>([]);
  const setInstruction = (i: Instruction | null) => {
    updateInstruction(i);
    if (i?.status === 'Reconciled') setHistory(previous => [...previous.filter(row => row.id !== i.id), i]);
  };
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(s?.trades)) setTrades(s.trades.map((t: Obligation) => ({ settlementDate: '2026-10-26', lifecycle: 'Validated', eligible: true, ...t })));
      if (s?.instruction) updateInstruction(LIFECYCLE.includes(s.instruction.status) && s.instruction.obligationSnapshot ? s.instruction : { ...s.instruction, status: 'Exception', verifiedNote: 'Legacy instruction requires fresh issuer validation and independent network verification.' });
      if (Array.isArray(s?.history)) setHistory(s.history);
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ trades, instruction, history }));
  }, [trades, instruction, history, loaded]);
  const reset = () => {
    setTrades(SAMPLE_OBLIGATIONS);
    setInstruction(null);
    setHistory([]);
  };
  return <Ctx.Provider value={{ trades, setTrades, instruction, history, setInstruction, reset }}>{children}</Ctx.Provider>;
}
export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
};
