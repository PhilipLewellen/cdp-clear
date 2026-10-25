import type { ReactNode } from 'react';
import { WalletContext } from '@/lib/wallet-context';
import { useFreighterConnection } from '@/hooks/use-freighter';

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useFreighterConnection();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}