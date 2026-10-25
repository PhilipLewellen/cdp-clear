import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { StoreProvider } from '@/lib/store';
import { Shell } from '@/components/Shell';

vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock('@/components/WalletConnect', () => ({ WalletConnect: () => null }));

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(cleanup);

const savedTrades = () => JSON.parse(localStorage.getItem('cdp-clear-v1') ?? '{}').trades;

describe('reset demo data confirmation', () => {
  it('does not reset saved state until the operator confirms', async () => {
    localStorage.setItem('cdp-clear-v1', JSON.stringify({ trades: [], instruction: null, history: [], activity: [] }));
    render(<StoreProvider><Shell title="t" intro="i"><div /></Shell></StoreProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Reset demo data/ }));
    expect(screen.getByText(/Reset all saved demo data/)).toBeTruthy();
    expect(savedTrades()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));
    await waitFor(() => expect(savedTrades()).toHaveLength(3));
  });
  it('leaves saved state untouched when the operator cancels', () => {
    localStorage.setItem('cdp-clear-v1', JSON.stringify({ trades: [], instruction: null, history: [], activity: [] }));
    render(<StoreProvider><Shell title="t" intro="i"><div /></Shell></StoreProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Reset demo data/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(savedTrades()).toEqual([]);
    expect(screen.getByRole('button', { name: /Reset demo data/ })).toBeTruthy();
  });
});
