import { useEffect, useRef, useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFreighter } from '@/hooks/use-freighter';
import { inputCls } from '@/lib/ui-classes';
import { USDC_ASSET } from '@/lib/wallet-balances';
import { testPaymentSession, type PendingTestPayment } from '@/lib/test-payment-session';
import { prepareTestPayment, submitTestPayment, readTestPayment, paymentError, TEST_PAYMENT_AMOUNT, type PreparedTestPayment, type ConfirmedTestPayment } from '@/lib/test-payment';

export function TestSettlementPayment({ onSuccess }: { onSuccess: () => void }) {
  const wallet = useFreighter();
  const [recipient, setRecipient] = useState('');
  const [prepared, setPrepared] = useState<PreparedTestPayment | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedTestPayment | null>(null);
  const [pending, setPending] = useState<PendingTestPayment | null>(null);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const guard = useRef(false);
  const current = useRef(wallet);
  current.current = wallet;
  const busy = Boolean(phase);
  useEffect(() => {
    const sync = () => setPending(pendingAttempt);
    const stored = sessionStorage.getItem('cdp-clear-test-payment-pending');
    if (stored) {
      try { const saved = JSON.parse(stored); if (/^[a-f0-9]{64}$/.test(saved.hash) && typeof saved.payment?.source === 'string' && typeof saved.payment?.destination === 'string') pendingAttempt = saved; } catch { /* Not payment evidence. */ }
    }
    sync(); window.addEventListener('cdp-clear-payment-update', sync);
    return () => window.removeEventListener('cdp-clear-payment-update', sync);
  }, []);
  const remember = (payment: PreparedTestPayment, hash: string) => {
    pendingAttempt = { payment, hash }; setPending(pendingAttempt);
    // Public addresses and hash only; never persist signed XDR or keys.
    sessionStorage.setItem('cdp-clear-test-payment-pending', JSON.stringify({ hash, payment: { ...payment, xdr: '' } }));
    window.dispatchEvent(new Event('cdp-clear-payment-update'));
  };
  const finish = (result: ConfirmedTestPayment) => {
    setConfirmed(result); setPending(null); pendingAttempt = null;
    sessionStorage.removeItem('cdp-clear-test-payment-pending');
    window.dispatchEvent(new Event('cdp-clear-payment-update'));
    setPrepared(null); onSuccess();
  };
  const review = async () => {
    if (guard.current || executionLocked || pendingAttempt || confirmed) return;
    guard.current = true; setPhase('Checking Testnet prerequisites…'); setError(''); setPrepared(null);
    try {
      const source = await current.current.checkConnection();
      const payment = await prepareTestPayment(source, recipient.trim());
      if (await current.current.checkConnection() !== source) throw new Error('Wallet changed. Review again.');
      setPrepared(payment);
    } catch (e) { setError(paymentError(e)); }
    finally { guard.current = false; setPhase(''); }
  };
  const send = async () => {
    if (!prepared || guard.current || executionLocked || pendingAttempt || confirmed) return;
    guard.current = true; executionLocked = true; setError(''); setPhase('Rechecking funds and Testnet…');
    try {
      if (await current.current.checkConnection() !== prepared.source) throw new Error('Connected payer changed. Review again.');
      const fresh = await prepareTestPayment(prepared.source, prepared.destination);
      if (fresh.feeXlm !== prepared.feeXlm) { setPrepared(fresh); throw new Error('Network fee changed. Review the updated fee and confirm again.'); }
      setPhase('Awaiting your approval in Freighter…');
      const signed = await current.current.signTransaction(fresh.xdr);
      if (!signed) throw new Error('Freighter returned no signature. No payment submitted.');
      if (await current.current.checkConnection() !== fresh.source) throw new Error('Wallet changed after signing. Nothing submitted.');
      setPhase('Submitting and confirming on Stellar Testnet…');
      const result = await submitTestPayment(fresh, signed, hash => remember(fresh, hash));
      if (result) finish(result);
      else setError('Confirmation is pending. Check status below; do not send another payment.');
    } catch (e) { setError(paymentError(e)); }
    finally { guard.current = false; executionLocked = false; setPhase(''); }
  };
  const check = async () => {
    if (!pending || guard.current || executionLocked) return;
    guard.current = true; setPhase('Checking submitted transaction…'); setError('');
    try { const result = await readTestPayment(pending.hash, pending.payment); if (result) finish(result); else setError('Not confirmed yet. Do not resend; check again later.'); }
    catch (e) { setError(`${paymentError(e)} Do not resend until the transaction outcome is resolved.`); }
    finally { guard.current = false; setPhase(''); }
  };
  return <section className="settlement-section" aria-label="Separate Testnet payment">
    <div className="module-heading"><h2>Separate 1 USDC test settlement</h2><span>Phase 3 · Stellar Testnet</span></div>
    <p className="mb-4 text-xs text-warning">{TEST_PAYMENT_AMOUNT} USDC test tokens only. This does not pay the simulated net obligation or reconcile any instruction.</p>
    <dl className="mb-4 grid grid-cols-[100px_minmax(0,1fr)] gap-2 text-xs"><dt className="text-muted-foreground">Sender</dt><dd className="break-all font-mono">{wallet.status === 'connected' ? wallet.address : 'Connect Freighter on Testnet'}</dd><dt className="text-muted-foreground">Asset issuer</dt><dd className="break-all font-mono">{USDC_ASSET.issuer}</dd></dl>
    <label className="block text-xs text-muted-foreground">Test payment recipient public address<input aria-label="Test payment recipient public address" placeholder="G… public Stellar Testnet address" className={`${inputCls} mt-2`} value={recipient} disabled={busy || Boolean(pending) || Boolean(confirmed)} onChange={event => { const value = event.target.value.trim(); if (value.startsWith('S')) { setError('Secret keys are not accepted. Enter a public G-address only.'); return; } setRecipient(value); setPrepared(null); setError(''); }} /></label>
    {!pending && !confirmed && <Button className="mt-3" disabled={busy || wallet.status !== 'connected' || !recipient || executionLocked} onClick={review}><Send className="size-3.5" />Send Test Settlement</Button>}
    {prepared && !pending && !confirmed && <div role="group" aria-label="Confirm test payment" className="mt-4 border-y border-border py-4">
      <h3 className="mb-3 text-sm font-medium">Confirm Testnet payment</h3>
      <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 text-xs"><dt>Sender</dt><dd className="break-all font-mono">{prepared.source}</dd><dt>Recipient</dt><dd className="break-all font-mono">{prepared.destination}</dd><dt>Asset / amount</dt><dd className="font-mono">{TEST_PAYMENT_AMOUNT} USDC</dd><dt>Network</dt><dd>Stellar Testnet</dd><dt>Network fee</dt><dd className="font-mono">{prepared.feeXlm} XLM</dd></dl>
      <div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy || wallet.status !== 'connected'} onClick={send}>Confirm & sign in Freighter</Button><Button variant="outline" disabled={busy} onClick={() => setPrepared(null)}>Cancel</Button></div>
    </div>}
    {busy && <p role="status" className="mt-3 text-xs text-primary">{phase}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    {pending && !confirmed && <div className="mt-3 text-xs"><p>Submission outcome unresolved. Another payment is blocked, including after reload in this tab.</p><Button variant="outline" className="mt-2" disabled={busy || executionLocked} onClick={check}><RefreshCw className="size-3.5" />Check payment status</Button></div>}
    {confirmed && <div role="status" className="mt-4 text-xs text-success"><p>1 USDC test payment independently confirmed{confirmed.ledger ? ` · Ledger ${confirmed.ledger}` : ''}. No obligation reconciled.</p><p className="mt-2 break-all font-mono">{confirmed.hash}</p><a className="mt-2 inline-block text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${confirmed.hash}`} target="_blank" rel="noreferrer">Inspect confirmed test payment on Stellar Expert ↗</a></div>}
    <p className="mt-3 text-[10px] text-muted-foreground">Freighter signs locally. Never enter a seed phrase or private key. Circle-documented Testnet USDC has no financial value or USD backing.</p>
  </section>;
}
