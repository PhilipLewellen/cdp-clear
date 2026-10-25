import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestSettlementPayment } from '@/components/TestSettlementPayment';
import { WalletContext, type WalletConnection } from '@/lib/wallet-context';
import { prepareTestPayment, submitTestPayment } from '@/lib/test-payment';
import { testPaymentSession } from '@/lib/test-payment-session';
vi.mock('@/lib/test-payment', async original => ({ ...await original<typeof import('@/lib/test-payment')>(), prepareTestPayment: vi.fn(), submitTestPayment: vi.fn() }));
const source = 'G' + 'A'.repeat(55), destination = 'G' + 'B'.repeat(55);
const payment = { source, destination, xdr: 'unsigned-fixture', expiresAt: Date.now()+180000, feeXlm:'0.0000100' };
const wallet: WalletConnection = { status:'connected', address:source, checkConnection:vi.fn(async()=>source), signTransaction:vi.fn(), connect:vi.fn(), disconnect:vi.fn() };
const refresh = vi.fn();
function mount() { render(<WalletContext.Provider value={wallet}><TestSettlementPayment onSuccess={refresh} /></WalletContext.Provider>); }
beforeEach(()=> { sessionStorage.clear(); testPaymentSession.locked=false; testPaymentSession.pending=null; vi.clearAllMocks(); vi.mocked(prepareTestPayment).mockResolvedValue(payment); });
afterEach(cleanup);
async function review() { fireEvent.change(screen.getByLabelText('Test payment recipient public address'),{ target:{value:destination} }); fireEvent.click(screen.getByRole('button',{name:'Send Test Settlement'})); await screen.findByRole('group',{name:'Confirm test payment'}); }
describe('test payment review and execution state',()=> {
 it('starts without an invented recipient and cannot send',()=> {mount(); expect(screen.getByLabelText('Test payment recipient public address')).toHaveValue(''); expect(screen.getByRole('button',{name:'Send Test Settlement'})).toBeDisabled();});
 it('does not submit or report success when Freighter rejects',async()=> { mount(); await review(); vi.mocked(wallet.signTransaction).mockRejectedValue(new Error('Signature rejected by user.')); fireEvent.click(screen.getByRole('button',{name:'Confirm & sign in Freighter'})); await screen.findByText('Signature rejected by user.'); expect(submitTestPayment).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(screen.queryByRole('link')).toBeNull(); });
 it('prevents duplicate clicks while signing and refreshes only on confirmed success',async()=> {
  mount(); await review(); let resolve: ((value:string)=>void)|undefined;
  vi.mocked(wallet.signTransaction).mockImplementation(()=>new Promise(r=>{resolve=r;}));
  vi.mocked(submitTestPayment).mockResolvedValue({hash:'a'.repeat(64),ledger:42});
  const button=screen.getByRole('button',{name:'Confirm & sign in Freighter'}); fireEvent.click(button); fireEvent.click(button);
  await waitFor(()=>expect(wallet.signTransaction).toHaveBeenCalledTimes(1)); expect(button).toBeDisabled();
  await act(async()=>resolve?.('signed-fixture')); await screen.findByRole('link'); expect(submitTestPayment).toHaveBeenCalledTimes(1); expect(refresh).toHaveBeenCalledTimes(1);
 });
 it('keeps an ambiguous submission blocked without a success link',async()=> {
  mount(); await review(); vi.mocked(wallet.signTransaction).mockResolvedValue('signed-fixture');
  vi.mocked(submitTestPayment).mockImplementation(async(p,_x,remember)=>{remember('b'.repeat(64)); throw new Error('Network timeout.');});
  fireEvent.click(screen.getByRole('button',{name:'Confirm & sign in Freighter'})); await screen.findByRole('button',{name:'Check payment status'});
  expect(screen.queryByRole('button',{name:'Send Test Settlement'})).toBeNull(); expect(screen.queryByRole('link')).toBeNull(); expect(refresh).not.toHaveBeenCalled(); expect(sessionStorage.getItem('cdp-clear-test-payment-pending')).not.toContain('signed-fixture');
 });
});
