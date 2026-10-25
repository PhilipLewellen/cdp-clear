import { createContext } from 'react';
import type { Obligation } from './netting';
import type { Instruction } from './settlement';
import type { ActivityEvent } from './activity';
import type { TestSettlement } from './test-reconciliation';

export interface Store {
  trades: Obligation[];
  setTrades: (trades: Obligation[]) => void;
  instruction: Instruction | null;
  history: Instruction[];
  setInstruction: (instruction: Instruction | null) => void;
  reset: () => void;
  activity: ActivityEvent[];
  recordActivity: (event: Omit<ActivityEvent, 'id' | 'at'>) => void;
  testSettlement: TestSettlement | null;
  setTestSettlement: (record: TestSettlement) => void;
}

// Keep context identity outside the provider's Fast Refresh boundary.
export const StoreContext = createContext<Store | null>(null);