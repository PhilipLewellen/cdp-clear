import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SAMPLE_OBLIGATIONS, type Obligation } from "./netting";

export type SettleStatus = "Draft" | "Instructed" | "Settled (verified on testnet)" | "Settled (manual verification)";
export interface Instruction {
  id: string;
  createdAt: string;
  assetCode: string;
  assetIssuer: string;
  source: string;
  destination: string;
  amount: number;
  status: SettleStatus;
  txHash: string;
  verifiedNote?: string;
}

interface Store {
  trades: Obligation[];
  setTrades: (t: Obligation[]) => void;
  instruction: Instruction | null;
  setInstruction: (i: Instruction | null) => void;
  reset: () => void;
}
const Ctx = createContext<Store | null>(null);
const KEY = "cdp-clear-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Obligation[]>(SAMPLE_OBLIGATIONS);
  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s?.trades) setTrades(s.trades);
      if (s?.instruction) setInstruction(s.instruction);
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ trades, instruction }));
  }, [trades, instruction, loaded]);
  const reset = () => {
    setTrades(SAMPLE_OBLIGATIONS);
    setInstruction(null);
  };
  return <Ctx.Provider value={{ trades, setTrades, instruction, setInstruction, reset }}>{children}</Ctx.Provider>;
}
export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
};
