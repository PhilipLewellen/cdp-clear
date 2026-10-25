import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletContext, type WalletConnection } from '@/lib/wallet-context';
import { WalletSettlementAsset } from '@/components/WalletSettlementAsset';
import { accountBalances, loadWalletBalances, USDC_ASSET, type WalletBalances } from '@/lib/wallet-balances';

vi.mock('@/lib/wallet-balances', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/wallet-balances')>(), loadWalletBalances: vi.fn() }));
const source = 'G' + 'A'.repeat(55), destination = 'G' + 'B'.repeat(55);
const connection: WalletConnection = { status: 'connected', address: source, connect: vi.fn(), disconnect: vi.fn(), checkConnection: vi.fn(async () => source), signTransaction: vi.fn() };
const account = (address: string) => accountBalances({ account_id: address, subentry_count: 1, balances: [{ asset_type: 'native', balance: '10' }, { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: USDC_ASSET.issuer, balance: '2000', limit: '10000', is_authorized: true }] }, 5000000n);
const data: WalletBalances = { payer: account(source), beneficiary: account(destination), payerError: null, beneficiaryError: null, feeXlm: '0.0000100', checkedAt: '2026-10-25T14:32:00Z' };
const panel = (wallet = connection, beneficiary = destination) => <WalletContext.Provider value={wallet}><WalletSettlementAsset amount={1500} source={source} beneficiary={beneficiary} issuer={USDC_ASSET.issuer} /></WalletContext.Provider>;
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('shared wallet balance state', () => {
  it('loads connected balances and clears them when disconnected', async () => {
    vi.mocked(loadWalletBalances).mockResolvedValue(data);
    const view = render(panel());
    await waitFor(() => expect(loadWalletBalances).toHaveBeenCalledWith(source, destination));
    await screen.findByText('Balance prerequisites met at lookup · execution disabled');
    view.rerender(panel({ ...connection, status: 'disconnected', address: undefined }));
    expect(screen.queryByText('Balance prerequisites met at lookup · execution disabled')).not.toBeInTheDocument();
    expect(screen.getByText('Not checked · connect a Testnet wallet')).toBeInTheDocument();
  });
  it('discards pending results for a previous beneficiary', async () => {
    let finish: ((value: WalletBalances) => void) | undefined;
    vi.mocked(loadWalletBalances).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ...data, beneficiary: null, beneficiaryError: 'Account does not exist on Stellar Testnet.' });
    const view = render(panel());
    await waitFor(() => expect(loadWalletBalances).toHaveBeenCalledTimes(1));
    view.rerender(panel(connection, 'G' + 'C'.repeat(55)));
    await screen.findByText('Prerequisites missing');
    await act(async () => { finish?.(data); });
    expect(screen.queryByText('Balance prerequisites met at lookup · execution disabled')).not.toBeInTheDocument();
  });
  it('removes positive funding while refresh fails', async () => {
    vi.mocked(loadWalletBalances).mockResolvedValueOnce(data).mockRejectedValueOnce(new Error('Testnet unavailable.'));
    render(panel());
    await screen.findByText('Balance prerequisites met at lookup · execution disabled');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Testnet balances' }));
    await screen.findByText('Unavailable · retry lookup');
    expect(screen.queryByText('Balance prerequisites met at lookup · execution disabled')).not.toBeInTheDocument();
  });
});