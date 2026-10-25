import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, FlaskConical, RefreshCw, Send } from 'lucide-react';
import { SettlementException } from '@/components/SettlementException';
import { SettlementEvidence } from '@/components/SettlementEvidence';
import { Button } from '@/components/ui/button';
import { useFreighter } from '@/hooks/use-freighter';
import { useStore } from '@/lib/use-store';
import { fmt } from '@/lib/netting';
import { inputCls } from '@/lib/ui-classes';
import { DEFAULT_ISSUER } from '@/lib/stellar';
import { testPaymentSession } from '@/lib/test-payment-session';
import { DEFAULT_SCALE, SETTLEMENT_SCALES, generateFingerprintedInstruction, scaledNet, settlementLifecycle, snapshotUnchanged, usdcAmount, verifyScaledInstruction, type ScaledInstruction, type SettlementScale } from '@/lib/scaled-settlement';
import { loadWalletBalances, type WalletBalances } from '@/lib/wallet-balances';
import { classifyRecovery, isWalletRejection, paymentState, readinessChecks, readyToPay, type Recovery } from '@/lib/settlement-readiness';
import { prepareScaledPayment, submitScaledPayment, readScaledPayment, paymentError, type PreparedScaledPayment, type ConfirmedScaledPayment } from '@/lib/scaled-payment';

const PENDING_KEY = 'cdp-clear-scaled-payment-pending';
// Signed XDR is public, already-authorised transaction data (no key material); kept so a timeout never loses what was submitted.
interface PendingScaled { instructionId: string; hash: string; signedXdr?: string; payment: Omit<PreparedScaledPayment, 'xdr'>; }

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
export function ScaledSettlementCalc({ requireConfirmation = false }: { requireConfirmation?: boolean }) {
  const { trades, scaledInstruction, setScaledInstruction } = useStore();
  const [scale, setScale] = useState<SettlementScale>(DEFAULT_SCALE);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const generationGuard = useRef(false);
  const [confirmedCalculation, setConfirmedCalculation] = useState<string | null>(null);
  const calculationKey = JSON.stringify({ trades, divisor: scale.divisor });
  const originalOk = scaledNet(trades, 1);
  const scaled = scaledNet(trades, scale.divisor);
  const ready = originalOk.ok && scaled.ok && scaled.net > 0 && scaled.payer === originalOk.payer;
  const direction = scaled.payer ? `CP-${scaled.payer} pays CP-${scaled.payee}` : 'Fully offset · no payment needed';
  const generate = async () => {
    if (generationGuard.current || (requireConfirmation && confirmedCalculation !== calculationKey)) return;
    generationGuard.current = true;
    setGenerating(true);
    setError('');
    try { setScaledInstruction(await generateFingerprintedInstruction(trades, scale)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Instruction generation unavailable.'); }
    finally { generationGuard.current = false; setGenerating(false); }
  };
  return <section className="settlement-section mt-6" aria-label="Scaled Stellar Testnet Demonstration">
    <div className="module-heading"><h2>Scaled Stellar Testnet Demonstration</h2><span>1 USD = 1 USDC · illustrative</span></div>
    <p className="mb-4 text-xs text-muted-foreground">For the Testnet demo, we use a smaller illustrative portfolio so we can execute and verify a real blockchain payment with a small amount of test USDC. Scaling reduces all three contract quantities proportionally; agreed forward prices and fixings stay unchanged. This is not a contractual settlement mechanism.</p>
    <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Settlement Scale">
      {SETTLEMENT_SCALES.map(option => <Button key={option.key} variant={option.divisor === scale.divisor ? 'default' : 'ghost'} role="radio" aria-checked={option.divisor === scale.divisor} onClick={() => setScale(option)}>{option.label} <span className="font-mono">{option.ratio}</span></Button>)}
    </div>
    {!scaled.ok ? <p role="alert" className="text-destructive">{scaled.error}</p> : <>
      <div className="demo-net-flow"><div><p className="text-xs text-muted-foreground">Original portfolio · gross / net</p><p className="mt-2 font-mono text-xl">{fmt(scaled.gross * scale.divisor, scaled.currency)} / {fmt(scaled.net * scale.divisor, scaled.currency)}</p></div><div><p className="text-xs text-muted-foreground">Scaled demonstration · gross / net</p><p className="mt-2 font-mono text-xl text-primary">{fmt(scaled.gross, scaled.currency)} / {fmt(scaled.net, scaled.currency)}</p><p className="mt-2 font-mono text-sm">{direction}</p></div></div>
      <dl className="mt-4 grid grid-cols-[180px_minmax(0,1fr)] gap-2 border-y border-border py-3 text-sm">
        <dt className="text-muted-foreground">Original net obligation</dt><dd className="font-mono">{originalOk.ok ? fmt(originalOk.net, originalOk.currency) : '—'}</dd>
        <dt className="text-muted-foreground">Demo portfolio scale</dt><dd className="font-mono">{scale.ratio}</dd>
        <dt className="text-muted-foreground">Scaled net obligation</dt><dd className="font-mono">{fmt(scaled.net, scaled.currency)}</dd>
        <dt className="text-muted-foreground">Expected payment</dt><dd className="font-mono text-primary">{scaled.net > 0 ? usdcAmount(scaled.net) : '0.0000000'} testnet USDC</dd>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">The {scaled.net > 0 ? usdcAmount(scaled.net) : '0'} USDC payment represents the scaled portfolio only; the original {originalOk.ok ? fmt(originalOk.net, originalOk.currency) : ''} obligation is not settled by this transfer. Testnet USDC has no real monetary value.</p>
      {scaled.net <= 0 && <p className="mt-3 text-xs text-warning">Net obligation is zero at this scale; no payment is required.</p>}
      {requireConfirmation && !(scaledInstruction && snapshotUnchanged(scaledInstruction, trades)) && <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">Selected calculation: booked illustrative contract fixings · {scale.ratio} scale · {scaled.net > 0 ? usdcAmount(scaled.net) : '0.0000000'} testnet USDC · {direction}. Published H100 prices are not used for this instruction.</p>
        <Button variant="outline" className="mt-3" disabled={!ready || generating || confirmedCalculation === calculationKey} onClick={() => setConfirmedCalculation(calculationKey)}>{confirmedCalculation === calculationKey ? 'Illustrative calculation confirmed' : 'Confirm Illustrative Settlement Calculation'}</Button>
      </div>}
      {scaledInstruction && snapshotUnchanged(scaledInstruction, trades)
        ? <p className="mt-4 text-xs">Instruction <span className="font-mono">{scaledInstruction.id}</span> already exists · <span className={statusTone(scaledInstruction.status)}>{scaledInstruction.status}</span> — changing the scale never overwrites an existing instruction. Continue to Settle.</p>
        : <Button className="mt-4" disabled={!ready || generating || (requireConfirmation && confirmedCalculation !== calculationKey)} onClick={generate}>{generating ? 'Saving financial snapshot…' : scaledInstruction ? 'Generate New Instruction' : 'Generate Settlement Instruction'}</Button>}
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      {scaledInstruction && !snapshotUnchanged(scaledInstruction, trades) && <p className="mt-3 text-xs">Current instruction <span className="font-mono">{scaledInstruction.id}</span> · <span className={statusTone(scaledInstruction.status)}>{scaledInstruction.status}</span><span className="text-warning"> · Portfolio changed since generation — generate a new instruction.</span></p>}
    </>}
  </section>;
}

/** Step 3 — instruction details, Freighter review and the real scaled USDC payment. */
export function ScaledSettlementPayment({ onSuccess, onViewVerified }: { onSuccess?: () => void; onViewVerified?: () => void }) {
  const { trades, scaledInstruction, setScaledInstruction } = useStore();
  const wallet = useFreighter();
  const [recipient, setRecipient] = useState('');
  const [prepared, setPrepared] = useState<PreparedScaledPayment | null>(null);
  const [pending, setPending] = useState<PendingScaled | null>(null);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [balancesError, setBalancesError] = useState<string | undefined>();
  const [network, setNetwork] = useState<{ ok: boolean | null; error?: string; address: string | null }>({ ok: null, address: null });
  const [outcome, setOutcome] = useState<'rejected' | 'failed' | 'unavailable' | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const stage = useRef<'idle' | 'signing' | 'submitting'>('idle');
  const autoChecked = useRef(false);
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
  useEffect(() => { setBalances(null); setNetwork({ ok: null, address: null }); }, [wallet.address, recipient]);
  // Recovery: after reload, look up a known submitted hash read-only once. Never re-signs or re-sends.
  useEffect(() => { if (pending && instruction && !autoChecked.current) { autoChecked.current = true; void check(); } });

  if (!instruction) return <section className="settlement-section" aria-label="Scaled settlement payment"><div className="module-heading"><h2>Scaled settlement payment</h2><span>Stellar Testnet</span></div><p className="text-sm text-muted-foreground">Generate a scaled settlement instruction in step 2 first. No payment can start without one.</p></section>;

  const remember = (payment: PreparedScaledPayment, hash: string, signedXdr: string) => {
    const record: PendingScaled = { instructionId: instruction.id, hash, signedXdr, payment: { source: payment.source, destination: payment.destination, amount: payment.amount, feeXlm: payment.feeXlm, expiresAt: payment.expiresAt } };
    setPending(record);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(record));
    setScaledInstruction({ ...instruction, status: 'Payment Submitted', txHash: hash, payerAddress: payment.source, recipient: payment.destination });
  };
  const finish = (result: ConfirmedScaledPayment, payment: { source: string; destination: string }) => {
    sessionStorage.removeItem(PENDING_KEY);
    setPending(null);
    setPrepared(null);
    setRecovery(null); setOutcome(null);
    setScaledInstruction({ ...instruction, status: 'Payment Confirmed', txHash: result.hash, ledger: result.ledger, confirmedAt: new Date().toISOString(), payerAddress: payment.source, recipient: payment.destination, verifiedNote: 'Blockchain transaction confirmed; reconciliation runs in step 4.' });
    onSuccess?.();
  };
  const runReadiness = async () => {
    if (guard.current) return;
    guard.current = true; setPhase('Running settlement readiness checks…'); setError(''); setBalancesError(undefined);
    let address: string | null = null;
    try { address = await current.current.checkConnection(); setNetwork({ ok: true, address }); }
    catch (e) { setNetwork({ ok: false, error: paymentError(e), address: current.current.address ?? null }); }
    try { if (address) setBalances(await loadWalletBalances(address, recipient.trim())); }
    catch (e) { setBalances(null); setBalancesError(`${paymentError(e)} Treated as unverified, not passed.`); }
    finally { guard.current = false; setPhase(''); }
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
      setPhase('Awaiting your approval in Freighter…'); stage.current = 'signing';
      const signed = await current.current.signTransaction(fresh.xdr);
      if (!signed) throw new Error('Freighter returned no signature. No payment submitted.');
      if (await current.current.checkConnection() !== fresh.source) throw new Error('Wallet changed after signing. Nothing submitted.');
      setPhase('Submitting and confirming on Stellar Testnet…'); stage.current = 'submitting';
      let submitted = false;
      try {
        const result = await submitScaledPayment(fresh, signed, hash => { submitted = true; remember(fresh, hash, signed); });
        if (result) finish(result, fresh);
        else { setRecovery('pending'); setError('Confirmation is pending. Check status below; do not send another payment.'); }
      } catch (e) {
        if (!submitted) throw e;
        // Outcome uncertain after submission: never assume failure.
        setOutcome('unavailable'); setError(`${paymentError(e)} The payment may still be applied. Check its status read-only; do not resend.`);
      }
    } catch (e) {
      const message = paymentError(e);
      setOutcome(stage.current === 'signing' && isWalletRejection(message) ? 'rejected' : 'failed');
      setError(stage.current === 'signing' && isWalletRejection(message) ? `Signature rejected in Freighter. No payment was submitted. ${message}` : message);
    }
    finally { guard.current = false; testPaymentSession.locked = false; setPhase(''); stage.current = 'idle'; }
  };
  const check = async () => {
    if (!pending || guard.current || testPaymentSession.locked) return;
    guard.current = true; setPhase('Checking submitted transaction…'); setError('');
    try {
      let lookup: Parameters<typeof classifyRecovery>[0];
      let found: ConfirmedScaledPayment | null = null;
      try { found = await readScaledPayment(pending.hash, { ...pending.payment, xdr: '' }); lookup = { found: Boolean(found), confirmed: Boolean(found) }; }
      catch (e) { const m = paymentError(e); lookup = /failed on Stellar/.test(m) ? { found: true, failed: true } : 'error'; if (lookup === 'error') setError(`${m} Do not resend until the transaction outcome is resolved.`); }
      const r = classifyRecovery(lookup, pending.payment.expiresAt);
      setRecovery(r);
      if (r === 'confirmed' && found) finish(found, pending.payment);
      else if (r === 'pending') { setOutcome(null); setError('Not found on Stellar Testnet yet. Confirmation Pending — do not resend; check again later.'); }
      else if (r === 'unavailable') setOutcome('unavailable');
      else if (r === 'failed-on-chain') setError('The transaction failed on Stellar Testnet. No USDC moved.');
      else if (r === 'expired-not-found') setError('The signed transaction expired without reaching the ledger, so it can no longer be applied.');
    }
    finally { guard.current = false; setPhase(''); }
  };

  const discard = () => {
    if (!pending || (recovery !== 'expired-not-found' && recovery !== 'failed-on-chain')) return;
    sessionStorage.removeItem(PENDING_KEY);
    if (instruction.txHash === pending.hash && instruction.status === 'Payment Submitted') setScaledInstruction({ ...instruction, status: 'Instruction Created', txHash: '', verifiedNote: `Earlier attempt ${pending.hash.slice(0, 8)}… resolved as not applied (${recovery === 'failed-on-chain' ? 'failed on-chain' : 'expired, never on ledger'}).` });
    setPending(null); setRecovery(null); setConfirmDiscard(false); setError(''); setOutcome(null);
  };
  const unchanged = snapshotUnchanged(instruction, trades);
  const checks = readinessChecks({ instruction, trades, wallet: { address: network.address ?? wallet.address ?? null, networkOk: network.address === wallet.address ? network.ok : null, networkError: network.error }, balances, balancesError, unresolvedHash: pending?.hash ?? null });
  const allReady = readyToPay(checks);
  const pState = paymentState({ instruction, phase: stage.current === 'idle' ? 'idle' : stage.current, unresolvedHash: pending?.hash ?? null, outcome });
  const lifecycle = settlementLifecycle(instruction, Boolean(prepared) || phase.startsWith('Awaiting'));
  return <section className="settlement-section" aria-label="Scaled settlement payment">
    <div className="module-heading"><h2>Scaled settlement payment</h2><span>{instruction.id} · Stellar Testnet</span></div>
    <p className="mb-4 text-xs text-warning">{instruction.usdcAmount} USDC test tokens settle the scaled portfolio only. The original {fmt(instruction.originalNet, 'USD')} obligation is not discharged.</p>
    <p className="mb-4 text-sm">Settlement status <span className={`ml-2 font-medium ${statusTone(instruction.status)}`}>{lifecycle}</span><span className="ml-3 text-xs text-muted-foreground">Payment state · <span className="font-medium text-foreground" data-testid="payment-state">{pState}</span></span></p>
    <dl className="grid grid-cols-[150px_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-muted-foreground">Instruction ID</dt><dd className="font-mono">{instruction.id}</dd>
      <dt className="text-muted-foreground">Source netting result</dt><dd className="font-mono">NS-AB-001 · {fmt(instruction.originalGross, 'USD')} gross → {fmt(instruction.originalNet, 'USD')} net · CP-{instruction.payer} pays CP-{instruction.beneficiary}</dd>
      <dt className="text-muted-foreground">Original net obligation</dt><dd className="font-mono">{fmt(instruction.originalNet, 'USD')}</dd>
      <dt className="text-muted-foreground">Settlement scale</dt><dd className="font-mono">1:{instruction.divisor.toLocaleString('en-US')}</dd>
      <dt className="text-muted-foreground">Scaled payment</dt><dd className="font-mono text-primary">{instruction.usdcAmount} USDC</dd>
      <dt className="text-muted-foreground">Paying counterparty</dt><dd>CP-{instruction.payer}{instruction.payerAddress ? <> · <span className="break-all font-mono">{instruction.payerAddress}</span></> : ' · connected Freighter account at payment time'}</dd>
      <dt className="text-muted-foreground">Receiving counterparty</dt><dd>CP-{instruction.beneficiary}</dd>
      <dt className="text-muted-foreground">Asset / issuer</dt><dd className="break-all font-mono">{instruction.assetCode} · {instruction.assetIssuer}</dd>
      <dt className="text-muted-foreground">Network</dt><dd>{instruction.network}</dd>
      <dt className="text-muted-foreground">Created</dt><dd className="font-mono">{instruction.createdAt}</dd>
      <dt className="text-muted-foreground">Wallet readiness</dt><dd>{wallet.status === 'connected' ? <>Connected · <span className="break-all font-mono">{wallet.address}</span></> : wallet.status === 'loading' ? 'Connecting…' : 'Not connected — connect Freighter on Stellar Testnet'}</dd>
      <dt className="text-muted-foreground">Status</dt><dd className={statusTone(instruction.status)}>{instruction.status}</dd>
    </dl>
    {!unchanged && <p role="alert" className="mt-4 text-xs text-warning">The portfolio changed after this instruction was generated. Payment is blocked; generate a new instruction in step 2.</p>}
    {instruction.status === 'Instruction Created' && unchanged && !pending && <>
      <label className="mt-4 block text-xs text-muted-foreground">Recipient public address (CP-{instruction.beneficiary} wallet)<input aria-label="Scaled settlement recipient public address" placeholder="G… public Stellar Testnet address" className={`${inputCls} mt-2`} value={recipient} disabled={busy} onChange={event => { const value = event.target.value.trim(); if (value.startsWith('S')) { setError('Secret keys are not accepted. Enter a public G-address only.'); return; } setRecipient(value); setPrepared(null); setError(''); }} /></label>
      {wallet.status === 'connected' && <section aria-label="Settlement readiness" className="mt-4 rounded border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Settlement Readiness</h3><span className="text-xs text-muted-foreground">{instruction.usdcAmount} USDC · Stellar Testnet · CP-{instruction.payer} → CP-{instruction.beneficiary}</span></div>
        <ul className="mt-3 grid gap-1.5 text-xs">{checks.map(c => <li key={c.id} className="flex flex-wrap justify-between gap-x-3"><span>{c.label}</span><span className={c.status === 'Passed' ? 'text-success' : c.status === 'Failed' ? 'text-destructive' : 'text-warning'}>{c.status}</span><span className="w-full text-muted-foreground">{c.detail}</span></li>)}</ul>
        <details className="mt-3 text-xs"><summary className="cursor-pointer text-muted-foreground">Technical details</summary><dl className="mt-2 grid grid-cols-[90px_minmax(0,1fr)] gap-1.5"><dt>Payer</dt><dd className="break-all font-mono">{wallet.address}</dd><dt>Recipient</dt><dd className="break-all font-mono">{recipient || '—'}</dd><dt>Asset</dt><dd className="break-all font-mono">{instruction.assetCode} · {instruction.assetIssuer}</dd><dt>Checked</dt><dd className="font-mono">{balances?.checkedAt ?? 'Not yet'}</dd></dl><p className="mt-2 text-muted-foreground">Missing or unavailable network data is shown as Unable to verify and blocks payment.</p></details>
        <p className="mt-3 text-xs">{allReady ? 'All mandatory checks passed. Next: review the payment.' : `${checks.filter(c => c.status !== 'Passed').length} check(s) not passed. Next: ${balances ? 'resolve the blocking items and re-run.' : 'run the readiness check.'}`}</p>
      </section>}
      {wallet.status === 'connected'
        ? (allReady
          ? <Button className="mt-3" disabled={busy || !recipient} onClick={review}><Send className="size-3.5" />Review Payment</Button>
          : <Button className="mt-3" disabled={busy || !recipient} onClick={runReadiness}><RefreshCw className="size-3.5" />Check Settlement Readiness</Button>)
        : <Button className="mt-3" disabled={busy || wallet.status === 'loading'} onClick={wallet.connect}>Connect Wallet</Button>}
      {wallet.status !== 'connected' && <p className="mt-2 text-xs text-muted-foreground">{wallet.error ?? 'Connect Freighter on Stellar Testnet.'} The connected account pays as CP-{instruction.payer}.</p>}
    </>}
    {prepared && !pending && !paid && <div role="group" aria-label="Confirm scaled payment" className="mt-4 border-y border-border py-4">
      <h3 className="mb-3 text-sm font-medium">Confirm Testnet payment</h3>
      <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 text-xs"><dt>Sender</dt><dd className="break-all font-mono">{prepared.source}</dd><dt>Recipient</dt><dd className="break-all font-mono">{prepared.destination}</dd><dt>Asset / amount</dt><dd className="font-mono">{prepared.amount} USDC</dd><dt>Network</dt><dd>Stellar Testnet</dd><dt>Network fee</dt><dd className="font-mono">{prepared.feeXlm} XLM</dd></dl>
      <div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy || wallet.status !== 'connected'} onClick={send}>Approve in Freighter</Button><Button variant="outline" disabled={busy} onClick={() => setPrepared(null)}>Cancel</Button></div>
    </div>}
    {busy && <p role="status" className="mt-3 text-xs text-primary">{phase}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    {pending && !paid && <div className="mt-3 text-xs"><p>Submission outcome unresolved. Another payment is blocked, including after reload in this tab.</p><p className="mt-1 break-all font-mono text-muted-foreground">{pending.hash}</p><Button variant="outline" className="mt-2" disabled={busy || testPaymentSession.locked} onClick={check}><RefreshCw className="size-3.5" />Check payment status (read-only)</Button>
      {(recovery === 'expired-not-found' || recovery === 'failed-on-chain') && (confirmDiscard
        ? <div className="mt-3 flex flex-wrap gap-2"><Button variant="destructive" onClick={discard}>Confirm: close this attempt</Button><Button variant="outline" onClick={() => setConfirmDiscard(false)}>Cancel</Button></div>
        : <Button variant="outline" className="mt-3" onClick={() => setConfirmDiscard(true)}>Close resolved attempt to allow a new payment</Button>)}
      <p className="mt-2 text-[10px] text-muted-foreground">Duplicate protection is browser-local to this tab and session; it is not an institution-wide exactly-once guarantee.</p></div>}
    {paid && <div role="status" className="mt-4 text-xs text-success"><p>Payment {instruction.status === 'Reconciled' ? 'reconciled' : 'submitted'} · transaction recorded on Stellar Testnet{instruction.ledger ? ` · Ledger ${instruction.ledger}` : ''}.</p><p className="mt-2 break-all font-mono">{instruction.txHash}</p><a className="mt-2 inline-block text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${instruction.txHash}`} target="_blank" rel="noreferrer">Inspect transaction on Stellar Expert ↗</a>{onViewVerified && <div><Button className="mt-3" onClick={onViewVerified}>View Confirmed Payment<ArrowRight className="size-3.5" /></Button></div>}</div>}
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
    {instruction.status === 'Reconciled' && <div className="mb-5 rounded border border-border bg-card p-4" role="status" aria-label="Settlement Reconciled">
      <p className="flex items-center gap-2 text-lg font-semibold text-success"><CheckCircle2 className="size-5 shrink-0" />Settlement Reconciled</p>
      <dl className="mt-4 grid grid-cols-[180px_minmax(0,1fr)] gap-2 text-xs">
        <dt className="text-muted-foreground">Expected vs actual amount</dt><dd className="font-mono">{instruction.usdcAmount} USDC · {instruction.usdcAmount} USDC · <span className="text-success">Match</span></dd>
        <dt className="text-muted-foreground">Sender / recipient</dt><dd className="break-all font-mono">{instruction.payerAddress} → {instruction.recipient} · <span className="text-success">Match</span></dd>
        <dt className="text-muted-foreground">Asset / issuer</dt><dd className="break-all font-mono">{instruction.assetCode} · {instruction.assetIssuer} · <span className="text-success">Match</span></dd>
        {instruction.confirmedAt && <><dt className="text-muted-foreground">Confirmed on Stellar</dt><dd className="font-mono">{instruction.confirmedAt}{instruction.ledger ? ` · Ledger ${instruction.ledger}` : ''}</dd></>}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">The original {fmt(instruction.originalNet, 'USD')} obligation remains illustrative and is not discharged by this {instruction.usdcAmount} USDC testnet transfer.</p>
    </div>}
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
      {instruction.status !== 'Reconciled' && <Button variant="outline" disabled={!canVerify || Boolean(phase)} onClick={verify}><RefreshCw className="size-3.5" />Reconcile Payment</Button>}
      {phase && <p role="status" className="text-xs text-primary">{phase}</p>}
    </div>
    <SettlementEvidence />
    {!canVerify && <p className="mt-3 text-xs text-muted-foreground">Verification becomes available after a payment transaction hash, payer wallet and recipient are recorded for this instruction.</p>}
    <div className="mt-6 border-t border-border pt-4">
      <Button variant="outline" disabled={exceptionOpen} onClick={() => setExceptionOpen(true)}><FlaskConical className="size-3.5" />Test a Settlement Exception</Button>
      <p className="mt-2 text-xs text-muted-foreground">Isolated demonstration: reconcile a real confirmed Testnet payment against a deliberately incorrect hypothetical instruction. No records change and no payment is made.</p>
    </div>
    {exceptionOpen && <SettlementException defaultHash={instruction.txHash} onClose={() => setExceptionOpen(false)} />}
  </section>;
}
