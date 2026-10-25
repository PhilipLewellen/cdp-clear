import { useEffect, useRef, useState } from 'react';
import { FlaskConical, RefreshCw, Send } from 'lucide-react';
import { SettlementException } from '@/components/SettlementException';
import { Button } from '@/components/ui/button';
import { useFreighter } from '@/hooks/use-freighter';
import { useStore } from '@/lib/use-store';
import { fmt } from '@/lib/netting';
import { inputCls } from '@/lib/ui-classes';
import { DEFAULT_ISSUER } from '@/lib/stellar';
import { testPaymentSession } from '@/lib/test-payment-session';
import { DEFAULT_SCALE, SETTLEMENT_SCALES, generateScaledInstruction, reconcileScaled, scaledNet, snapshotUnchanged, usdcAmount, verifyScaledInstruction, type ScaledInstruction, type SettlementScale } from '@/lib/scaled-settlement';
import { prepareScaledPayment, submitScaledPayment, readScaledPayment, paymentError, type PreparedScaledPayment, type ConfirmedScaledPayment } from '@/lib/scaled-payment';

const PENDING_KEY = 'cdp-clear-scaled-payment-pending';
interface PendingScaled { instructionId: string; hash: string; payment: Omit<PreparedScaledPayment, 'xdr'>; }

function useAllocatedHashes(excludeId?: string): string[] {
  const { history, testSettlement } = useStore();
  const hashes = history.filter(i => i.status === 'Reconciled' && i.id !== excludeId && i.txHash).map(i => i.txHash);
  if (testSettlement?.hash) hashes.push(testSettlement.hash);
  return hashes;
}

function statusTone(status: ScaledInstruction['status']) {
  if (status === 'Reconciled' || status === 'Payment Confirmed') return 'text-success';
  if (status === 'Failed' || status === 'Exception — Mismatch') return 'text-destructive';
  return 'text-warning';
}

/** Step 2 — Settlement Scale selector, scaled calculation and instruction generation. */
export function ScaledSettlementCalc() {
  const { trades, scaledInstruction, setScaledInstruction } = useStore();
  const [scale, setScale] = useState<SettlementScale>(DEFAULT_SCALE);
  const [error, setError] = useState('');
  const originalOk = scaledNet(trades, 1);
  const scaled = scaledNet(trades, scale.divisor);
  const ready = originalOk.ok && scaled.ok && scaled.net > 0 && scaled.payer === originalOk.payer;
  const direction = scaled.payer ? `CP-${scaled.payer} pays CP-${scaled.payee}` : 'Fully offset · no payment needed';
  const generate = () => {
    setError('');
    try { setScaledInstruction(generateScaledInstruction(trades, scale)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Instruction generation unavailable.'); }
  };
  return <section className="settlement-section mt-6" aria-label="Scaled Stellar Testnet Demonstration">
    <div className="module-heading"><h2>Scaled Stellar Testnet Demonstration</h2><span>1 USD = 1 USDC · illustrative</span></div>
    <p className="mb-4 text-xs text-muted-foreground">Scales all three contract quantities proportionally; agreed strikes and fixings stay unchanged. Fractional GPU-hours are acceptable for this illustrative portfolio. This is not a contractual settlement mechanism.</p>
    <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Settlement Scale">
      {SETTLEMENT_SCALES.map(option => <Button key={option.key} variant={option.divisor === scale.divisor ? 'default' : 'ghost'} role="radio" aria-checked={option.divisor === scale.divisor} onClick={() => setScale(option)}>{option.label} <span className="font-mono">{option.ratio}</span></Button>)}
    </div>
    {!scaled.ok ? <p role="alert" className="text-destructive">{scaled.error}</p> : <>
      <div className="demo-net-flow"><div><p className="text-xs text-muted-foreground">Original portfolio · gross / net</p><p className="mt-2 font-mono text-xl">{fmt(scaled.gross * scale.divisor, scaled.currency)} / {fmt(scaled.net * scale.divisor, scaled.currency)}</p></div><div><p className="text-xs text-muted-foreground">Scaled demonstration · gross / net</p><p className="mt-2 font-mono text-xl text-primary">{fmt(scaled.gross, scaled.currency)} / {fmt(scaled.net, scaled.currency)}</p><p className="mt-2 font-mono text-sm">{direction}</p></div></div>
      <p className="mt-4 border-y border-border py-3 font-mono text-sm">{originalOk.ok ? fmt(originalOk.net, originalOk.currency) : '—'} ÷ {scale.divisor.toLocaleString('en-US')} = {fmt(scaled.net, scaled.currency)} → {scaled.net > 0 ? usdcAmount(scaled.net) : '0.0000000'} testnet USDC</p>
      <p className="mt-3 text-xs text-muted-foreground">The {scaled.net > 0 ? usdcAmount(scaled.net) : '0'} USDC payment represents the scaled portfolio only; the original {originalOk.ok ? fmt(originalOk.net, originalOk.currency) : ''} obligation is not settled by this transfer. Testnet USDC has no real monetary value.</p>
      {scaled.net <= 0 && <p className="mt-3 text-xs text-warning">Net obligation is zero at this scale; no payment is required.</p>}
      <Button className="mt-4" disabled={!ready} onClick={generate}>Generate Scaled Settlement Instruction</Button>
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      {scaledInstruction && <p className="mt-3 text-xs">Current instruction <span className="font-mono">{scaledInstruction.id}</span> · <span className={statusTone(scaledInstruction.status)}>{scaledInstruction.status}</span>{!snapshotUnchanged(scaledInstruction, trades) && <span className="text-warning"> · Portfolio changed since generation — generate a new instruction.</span>}</p>}
    </>}
  </section>;
}

/** Step 3 — instruction details, Freighter review and the real scaled USDC payment. */
export function ScaledSettlementPayment({ onSuccess }: { onSuccess: () => void }) {
  const { trades, scaledInstruction, setScaledInstruction } = useStore();
  const wallet = useFreighter();
  const [recipient, setRecipient] = useState('');
  const [prepared, setPrepared] = useState<PreparedScaledPayment | null>(null);
  const [pending, setPending] = useState<PendingScaled | null>(null);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const guard = useRef(false);
  const current = useRef(wallet);
  current.current = wallet;
  const busy = Boolean(phase);
  const instruction = scaledInstruction;
  const paid = Boolean(instruction && ['Payment Submitted', 'Payment Confirmed', 'Reconciled'].includes(instruction.status) && instruction.txHash);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
      if (/^[a-f0-9]{64}$/.test(saved?.hash) && typeof saved?.instructionId === 'string') setPending(saved);
    } catch { /* Not payment evidence. */ }
  }, []);
  useEffect(() => { if (instruction?.recipient) setRecipient(instruction.recipient); }, [instruction?.recipient]);

  if (!instruction) return <section className="settlement-section" aria-label="Scaled settlement payment"><div className="module-heading"><h2>Scaled settlement payment</h2><span>Stellar Testnet</span></div><p className="text-sm text-muted-foreground">Generate a scaled settlement instruction in step 2 first. No payment can start without one.</p></section>;

  const remember = (payment: PreparedScaledPayment, hash: string) => {
    const record: PendingScaled = { instructionId: instruction.id, hash, payment: { source: payment.source, destination: payment.destination, amount: payment.amount, feeXlm: payment.feeXlm, expiresAt: payment.expiresAt } };
    setPending(record);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(record));
    setScaledInstruction({ ...instruction, status: 'Payment Submitted', txHash: hash, payerAddress: payment.source, recipient: payment.destination });
  };
  const finish = (result: ConfirmedScaledPayment, payment: { source: string; destination: string }) => {
    sessionStorage.removeItem(PENDING_KEY);
    setPending(null);
    setPrepared(null);
    setScaledInstruction({ ...instruction, status: 'Payment Confirmed', txHash: result.hash, ledger: result.ledger, confirmedAt: new Date().toISOString(), payerAddress: payment.source, recipient: payment.destination, verifiedNote: 'Blockchain transaction confirmed; reconciliation runs in step 4.' });
    onSuccess();
  };
  const review = async () => {
    if (guard.current || testPaymentSession.locked || pending || paid) return;
    guard.current = true; setPhase('Checking Testnet prerequisites…'); setError(''); setPrepared(null);
    try {
      const source = await current.current.checkConnection();
      const payment = await prepareScaledPayment(source, recipient.trim(), instruction.usdcAmount);
      if (await current.current.checkConnection() !== source) throw new Error('Wallet changed. Review again.');
      setPrepared(payment);
    } catch (e) { setError(paymentError(e)); }
    finally { guard.current = false; setPhase(''); }
  };
  const send = async () => {
    if (!prepared || guard.current || testPaymentSession.locked || pending || paid) return;
    guard.current = true; testPaymentSession.locked = true; setError(''); setPhase('Rechecking funds and Testnet…');
    try {
      if (await current.current.checkConnection() !== prepared.source) throw new Error('Connected payer changed. Review again.');
      const fresh = await prepareScaledPayment(prepared.source, prepared.destination, instruction.usdcAmount);
      if (fresh.feeXlm !== prepared.feeXlm) { setPrepared(fresh); throw new Error('Network fee changed. Review the updated fee and confirm again.'); }
      setPhase('Awaiting your approval in Freighter…');
      const signed = await current.current.signTransaction(fresh.xdr);
      if (!signed) throw new Error('Freighter returned no signature. No payment submitted.');
      if (await current.current.checkConnection() !== fresh.source) throw new Error('Wallet changed after signing. Nothing submitted.');
      setPhase('Submitting and confirming on Stellar Testnet…');
      const result = await submitScaledPayment(fresh, signed, hash => remember(fresh, hash));
      if (result) finish(result, fresh);
      else setError('Confirmation is pending. Check status below; do not send another payment.');
    } catch (e) { setError(paymentError(e)); }
    finally { guard.current = false; testPaymentSession.locked = false; setPhase(''); }
  };
  const check = async () => {
    if (!pending || guard.current || testPaymentSession.locked) return;
    guard.current = true; setPhase('Checking submitted transaction…'); setError('');
    try {
      const result = await readScaledPayment(pending.hash, { ...pending.payment, xdr: '' });
      if (result) finish(result, pending.payment);
      else setError('Not confirmed yet. Do not resend; check again later.');
    } catch (e) { setError(`${paymentError(e)} Do not resend until the transaction outcome is resolved.`); }
    finally { guard.current = false; setPhase(''); }
  };

  const unchanged = snapshotUnchanged(instruction, trades);
  return <section className="settlement-section" aria-label="Scaled settlement payment">
    <div className="module-heading"><h2>Scaled settlement payment</h2><span>{instruction.id} · Stellar Testnet</span></div>
    <p className="mb-4 text-xs text-warning">{instruction.usdcAmount} USDC test tokens settle the scaled portfolio only. The original {fmt(instruction.originalNet, 'USD')} obligation is not discharged.</p>
    <dl className="grid grid-cols-[150px_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-muted-foreground">Instruction ID</dt><dd className="font-mono">{instruction.id}</dd>
      <dt className="text-muted-foreground">Original net obligation</dt><dd className="font-mono">{fmt(instruction.originalNet, 'USD')}</dd>
      <dt className="text-muted-foreground">Settlement scale</dt><dd className="font-mono">1:{instruction.divisor.toLocaleString('en-US')}</dd>
      <dt className="text-muted-foreground">Scaled payment</dt><dd className="font-mono text-primary">{instruction.usdcAmount} USDC</dd>
      <dt className="text-muted-foreground">Paying counterparty</dt><dd>CP-{instruction.payer}{instruction.payerAddress ? <> · <span className="break-all font-mono">{instruction.payerAddress}</span></> : ' · connected Freighter account at payment time'}</dd>
      <dt className="text-muted-foreground">Receiving counterparty</dt><dd>CP-{instruction.beneficiary}</dd>
      <dt className="text-muted-foreground">Asset / issuer</dt><dd className="break-all font-mono">{instruction.assetCode} · {instruction.assetIssuer}</dd>
      <dt className="text-muted-foreground">Network</dt><dd>{instruction.network}</dd>
      <dt className="text-muted-foreground">Created</dt><dd className="font-mono">{instruction.createdAt}</dd>
      <dt className="text-muted-foreground">Status</dt><dd className={statusTone(instruction.status)}>{instruction.status}</dd>
    </dl>
    {!unchanged && <p role="alert" className="mt-4 text-xs text-warning">The portfolio changed after this instruction was generated. Payment is blocked; generate a new instruction in step 2.</p>}
    {instruction.status === 'Instruction Created' && unchanged && !pending && <>
      <label className="mt-4 block text-xs text-muted-foreground">Recipient public address (CP-{instruction.beneficiary} wallet)<input aria-label="Scaled settlement recipient public address" placeholder="G… public Stellar Testnet address" className={`${inputCls} mt-2`} value={recipient} disabled={busy} onChange={event => { const value = event.target.value.trim(); if (value.startsWith('S')) { setError('Secret keys are not accepted. Enter a public G-address only.'); return; } setRecipient(value); setPrepared(null); setError(''); }} /></label>
      <Button className="mt-3" disabled={busy || wallet.status !== 'connected' || !recipient} onClick={review}><Send className="size-3.5" />Settle with USDC on Stellar</Button>
      {wallet.status !== 'connected' && <p className="mt-2 text-xs text-muted-foreground">Connect Freighter on Testnet in the header. The connected account pays as CP-{instruction.payer}.</p>}
    </>}
    {prepared && !pending && !paid && <div role="group" aria-label="Confirm scaled payment" className="mt-4 border-y border-border py-4">
      <h3 className="mb-3 text-sm font-medium">Confirm Testnet payment</h3>
      <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 text-xs"><dt>Sender</dt><dd className="break-all font-mono">{prepared.source}</dd><dt>Recipient</dt><dd className="break-all font-mono">{prepared.destination}</dd><dt>Asset / amount</dt><dd className="font-mono">{prepared.amount} USDC</dd><dt>Network</dt><dd>Stellar Testnet</dd><dt>Network fee</dt><dd className="font-mono">{prepared.feeXlm} XLM</dd></dl>
      <div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy || wallet.status !== 'connected'} onClick={send}>Confirm & sign in Freighter</Button><Button variant="outline" disabled={busy} onClick={() => setPrepared(null)}>Cancel</Button></div>
    </div>}
    {busy && <p role="status" className="mt-3 text-xs text-primary">{phase}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    {pending && !paid && <div className="mt-3 text-xs"><p>Submission outcome unresolved. Another payment is blocked, including after reload in this tab.</p><Button variant="outline" className="mt-2" disabled={busy || testPaymentSession.locked} onClick={check}><RefreshCw className="size-3.5" />Check payment status</Button></div>}
    {paid && <div role="status" className="mt-4 text-xs text-success"><p>Payment {instruction.status === 'Reconciled' ? 'reconciled' : 'submitted'} · transaction recorded on Stellar Testnet{instruction.ledger ? ` · Ledger ${instruction.ledger}` : ''}.</p><p className="mt-2 break-all font-mono">{instruction.txHash}</p><a className="mt-2 inline-block text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${instruction.txHash}`} target="_blank" rel="noreferrer">Inspect transaction on Stellar Expert ↗</a></div>}
    <p className="mt-3 text-[10px] text-muted-foreground">Freighter signs locally. Never enter a seed phrase or private key. Payment is never initiated by changing the scale, generating an instruction or refreshing market prices.</p>
  </section>;
}

/** Step 4 — independent Horizon verification of the exact instruction payment. */
export function ScaledSettlementVerify() {
  const { trades, scaledInstruction, setScaledInstruction } = useStore();
  const allocated = useAllocatedHashes(scaledInstruction?.id);
  const [phase, setPhase] = useState('');
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const guard = useRef(false);
  const instruction = scaledInstruction;
  if (!instruction) return <section className="settlement-section" aria-label="Scaled settlement verification">
    <div className="module-heading"><h2>Scaled settlement verification</h2><span>Horizon</span></div>
    <p className="text-sm text-muted-foreground">No scaled settlement instruction exists yet. Generate one in step 2.</p>
    <div className="mt-6 border-t border-border pt-4">
      <Button variant="outline" disabled={exceptionOpen} onClick={() => setExceptionOpen(true)}><FlaskConical className="size-3.5" />Test a Settlement Exception</Button>
      <p className="mt-2 text-xs text-muted-foreground">Isolated demonstration: reconcile a real confirmed Testnet payment against a deliberately incorrect hypothetical instruction. No records change and no payment is made.</p>
    </div>
    {exceptionOpen && <SettlementException defaultHash="" onClose={() => setExceptionOpen(false)} />}
  </section>;
  const verify = async () => {
    if (guard.current || !instruction.txHash || !instruction.payerAddress || !instruction.recipient) return;
    guard.current = true; setPhase('Verifying on Stellar Testnet…');
    try { setScaledInstruction(await verifyScaledInstruction(instruction, trades, allocated)); }
    finally { guard.current = false; setPhase(''); }
  };
  const canVerify = Boolean(instruction.txHash && instruction.payerAddress && instruction.recipient);
  return <section className="settlement-section" aria-label="Scaled settlement verification">
    <div className="module-heading"><h2>Scaled settlement verification</h2><span>{instruction.id}</span></div>
    <p className="mb-4 text-sm">Independent Horizon verification compares the confirmed blockchain payment against instruction {instruction.id}: network, success, sender, recipient, exact {instruction.usdcAmount} USDC amount, asset code and Circle Testnet issuer.</p>
    <dl className="grid grid-cols-[150px_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-muted-foreground">Status</dt><dd className={statusTone(instruction.status)}>{instruction.status}</dd>
      {instruction.txHash && <><dt className="text-muted-foreground">Transaction</dt><dd className="break-all font-mono">{instruction.txHash}</dd></>}
      {instruction.confirmedAt && <><dt className="text-muted-foreground">Confirmed</dt><dd className="font-mono">{instruction.confirmedAt}{instruction.ledger ? ` · Ledger ${instruction.ledger}` : ''}</dd></>}
      {instruction.reconciledAt && <><dt className="text-muted-foreground">Reconciled</dt><dd className="font-mono">{instruction.reconciledAt}</dd></>}
      {instruction.verifiedNote && <><dt className="text-muted-foreground">Verification note</dt><dd>{instruction.verifiedNote}</dd></>}
    </dl>
    {instruction.txHash && <a className="mt-3 inline-block text-xs text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${instruction.txHash}`} target="_blank" rel="noreferrer">Inspect transaction on Stellar Expert ↗</a>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button variant="outline" disabled={!canVerify || Boolean(phase)} onClick={verify}><RefreshCw className="size-3.5" />Verify Again</Button>
      {phase && <p role="status" className="text-xs text-primary">{phase}</p>}
    </div>
    {!canVerify && <p className="mt-3 text-xs text-muted-foreground">Verification becomes available after a payment transaction hash, payer wallet and recipient are recorded for this instruction.</p>}
    {instruction.status === 'Reconciled' && <p className="mt-4 text-sm text-success">Scaled settlement reconciled against instruction {instruction.id}. The original {fmt(instruction.originalNet, 'USD')} obligation remains illustrative and is not discharged by this {instruction.usdcAmount} USDC testnet transfer.</p>}
    <div className="mt-6 border-t border-border pt-4">
      <Button variant="outline" disabled={exceptionOpen} onClick={() => setExceptionOpen(true)}><FlaskConical className="size-3.5" />Test a Settlement Exception</Button>
      <p className="mt-2 text-xs text-muted-foreground">Isolated demonstration: reconcile a real confirmed Testnet payment against a deliberately incorrect hypothetical instruction. No records change and no payment is made.</p>
    </div>
    {exceptionOpen && <SettlementException defaultHash={instruction.txHash} onClose={() => setExceptionOpen(false)} />}
  </section>;
}
