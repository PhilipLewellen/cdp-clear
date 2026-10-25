import { createContext } from 'react';
import type { WalletState } from '@/hooks/use-freighter';

export interface WalletConnection extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  checkConnection: () => Promise<string>;
  signTransaction: (xdr: string) => Promise<string | undefined>;
}
export const WalletContext = createContext<WalletConnection | null>(null);