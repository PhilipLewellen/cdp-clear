import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState, type ReactNode } from 'react';
import { Card, Shell, Tag, Term, inputCls } from '@/components/Shell';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, FilePlus2, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useStore, type Instruction } from '@/lib/store';
import { fmt, netObligations } from '@/lib/netting';
import { DEFAULT_ISSUER, NETWORK, verifyTestnetAsset, verifyTestnetPayment, type VerifyResult } from '@/lib/stellar';
import { LIFECYCLE, obligationSnapshot, publicAddress, reconcileInstruction } from '@/lib/settlement';

export const Route = createFileRoute('/settlement')({
  head: () => ({ meta: [
    { title: 'Cash-Leg Settlement & Reconciliation — CDP Clear' },
    { name: 'description', content: 'USDC cash-leg instruction lifecycle, independent Stellar Testnet confirmation and obligation reconciliation.' },
    { property: 'og:title', content: 'Cash-Leg Settlement & Reconciliation — CDP Clear' },
    { property: 'og:description', content: 'USDC cash-leg instruction lifecycle, independent Stellar Testnet confirmation and obligation reconciliation.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Settlement,
});

function Settlement() {
  const { trades, instruction, history, setInstruction } = useStore();
  const r = netObligations(trades);
  const [form, setForm] = useState({ assetIssuer: DEFAULT_ISSUER, source: '', destination: '' });
  const [hash, setHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<VerifyResult | null>(null);
  const [manualAck, setManualAck] = useState(false);
  const current = useRef({ trades, instruction, history });
  current.current = { trades, instruction, history };
  const canCreate = r.ok && r.net > 0 && r.payer && r.payee && publicAddress(form.source) && publicAddress(form.destination) && form.source.trim() !== form.destination.trim() && publicAddress(form.assetIssuer);
  const unchanged = instruction?.obligationSnapshot === obligationSnapshot(trades);
  const create = () => {
    if (!canCreate || !r.payer || !r.payee) return;
    setInstruction({
      id: `SI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString(),
      assetCode: 'USDC', assetIssuer: form.assetIssuer.trim(), source: form.source.trim(), destination: form.destination.trim(),
      amount: r.net, currency: r.currency, payer: r.payer, beneficiary: r.payee,
      obligationSnapshot: obligationSnapshot(trades), status: 'Draft', txHash: '',
    });
    setMsg(null); setEvidence(null); setHash(''); setManualAck(false);
  };
  const validate = async () => {
    if (!instruction || !unchanged) return;
    setBusy(true); setMsg(null);
    try {
      const verifiedAt = await verifyTestnetAsset(instruction.assetIssuer);
      if (current.current.instruction?.id !== instruction.id) return;
      if (current.current.instruction.obligationSnapshot !== obligationSnapshot(current.current.trades)) {
        setInstruction({ ...instruction, status: 'Exception', verifiedNote: 'Netting set changed during validation.' }); return;
      }
      setInstruction({ ...instruction, status: 'Validated', issuerVerifiedAt: verifiedAt });
      setMsg('Stellar Testnet and exact USDC asset issuer verified. This does not establish Circle authenticity, reserve backing or redemption rights.');
    } catch (error) { setMsg(error instanceof Error ? error.message : 'Asset validation unavailable.'); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    if (!instruction || !/^[0-9a-fA-F]{64}$/.test(hash.trim())) return;
    const txHash = hash.trim().toLowerCase();
    if (history.some(row => row.txHash === txHash && row.id !== instruction.id)) {
      setInstruction({ ...instruction, status: 'Exception', verifiedNote: 'Transaction already allocated to a reconciled instruction.' });
      setMsg('Duplicate settlement rejected. Use a new payment transaction.'); return;
    }
    setBusy(true); setMsg(null); setEvidence(null);
    const submitted: Instruction = { ...instruction, txHash, status: 'Submitted', confirmedAt: undefined, reconciledAt: undefined, ledger: undefined };
    setInstruction(submitted);
    try {
      const result = await verifyTestnetPayment({ ...submitted, hash: txHash });
      if (current.current.instruction?.id !== instruction.id) return;
      setEvidence(result);
      setInstruction(result.confirmed
        ? { ...submitted, status: 'Confirmed', confirmedAt: result.createdAt, ledger: result.ledger, verifiedNote: result.ok ? 'Successful network transaction independently verified. Reconciliation pending.' : result.reasons.join(' ') }
        : { ...submitted, status: result.failed ? 'Failed' : 'Exception', verifiedNote: result.reasons.join(' ') });
      setMsg(result.confirmed ? 'Successful network transaction confirmed; reconcile against the contractual obligation.' : result.reasons.join(' '));
    } catch (error) {
      if (current.current.instruction?.id === instruction.id) setInstruction({ ...submitted, status: 'Exception', verifiedNote: 'Independent network verification unavailable. No confirmation or reconciliation recorded.' });
      setMsg(error instanceof Error ? error.message : 'Horizon Testnet unavailable.');
    } finally { setBusy(false); }
  };
  const reconcile = () => {
    if (!instruction || !evidence) return;
    setInstruction(reconcileInstruction(instruction, evidence, trades, history));
    setMsg(null);
  };
  const clear = () => { setInstruction(null); setHash(''); setMsg(null); setEvidence(null); setManualAck(false); };
  const displayedAmount = instruction?.amount ?? r.net;
  const currency = instruction?.currency ?? r.currency;
  const rows = instruction ? [...history.filter(row => row.id !== instruction.id), instruction] : history;
  return <Shell title="Tokenised Cash Settlement & Reconciliation" intro="USDC cash-leg operations · Stellar Testnet · Simulation / Testnet Verification">
    <div className="flex flex-wrap gap-2"><Tag tone="warning">Payment sending: not implemented</Tag><Tag tone="warning">Wallet signing: not implemented</Tag><Tag tone="primary">Read-only independent network verification</Tag></div>
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold">Settlement Instruction Register</h2>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th>Instruction Reference</th><th>Net Payer</th><th>Net Beneficiary</th><th className="text-right">Cash-Leg Amount</th><th>Lifecycle State</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-border"><td className="py-3 font-mono">{row.id}</td><td>CP-{row.payer ?? '—'}</td><td>CP-{row.beneficiary ?? '—'}</td><td className="text-right font-mono">{row.amount.toFixed(2)} USDC</td><td><Tag tone={row.status === 'Reconciled' ? 'success' : 'warning'}>{row.status}</Tag></td></tr>)}{rows.length === 0 && <tr><td colSpan={5} className="py-4 text-muted-foreground">No settlement instructions</td></tr>}</tbody></table></div>
      <div className="mt-3 flex flex-wrap gap-2">{LIFECYCLE.map(status => <Tag key={status} tone={instruction?.status === status ? (status === 'Reconciled' ? 'success' : 'primary') : 'muted'}>{status}</Tag>)}</div>
    </section>
    <Card><h2 className="font-display text-lg font-semibold">Settlement Obligation Details</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3"><div><Term label="Contractual amount" meaning="The net cash obligation in the contractual settlement currency, not derivative notional." /><p className="mt-1 font-mono text-xl">{fmt(displayedAmount, currency)}</p></div><div><Term label="Proposed settlement amount" meaning="Testnet USDC quantity using an illustrative 1:1 conversion. No live FX or token price is applied." /><p className="mt-1 font-mono text-xl">{displayedAmount.toFixed(2)} testnet USDC</p></div><div className="text-sm"><p className="text-muted-foreground">Netting Set NS-AB-001</p><p className="mt-1">CP-{instruction?.payer ?? r.payer ?? '—'} → CP-{instruction?.beneficiary ?? r.payee ?? '—'}</p></div></div>
      <p className="mt-3 text-xs text-warning">Illustrative 1:1 conversion assumption: 1 {currency} = 1 testnet USDC. Test asset only; no real funds or guarantee of value.</p>
      {!r.ok && <p className="mt-2 text-sm text-destructive">{r.error}</p>}
      {r.ok && r.net === 0 && <p className="mt-2 text-sm text-muted-foreground">Zero NSO — no cash-leg settlement instruction required.</p>}
      {instruction && !unchanged && <p className="mt-2 text-sm text-destructive">Netting set changed. This instruction cannot be reconciled; discard it and create a new instruction.</p>}
    </Card>
    {!instruction ? <>
      <section><h2 className="font-display text-lg font-semibold">Payer / Beneficiary Wallets</h2><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label={`Payer public wallet (CP-${r.payer ?? '—'})`}><input aria-label="Payer public wallet" className={inputCls} placeholder="G… public Stellar Testnet address" value={form.source} onChange={e => { if (!e.target.value.trim().startsWith('S')) setForm({ ...form, source: e.target.value }); else setMsg('Secret keys are not accepted. Enter a public G-address only.'); }} /></Field><Field label={`Beneficiary public wallet (CP-${r.payee ?? '—'})`}><input aria-label="Beneficiary public wallet" className={inputCls} placeholder="G… public Stellar Testnet address" value={form.destination} onChange={e => { if (!e.target.value.trim().startsWith('S')) setForm({ ...form, destination: e.target.value }); else setMsg('Secret keys are not accepted. Enter a public G-address only.'); }} /></Field></div></section>
      <section><h2 className="font-display text-lg font-semibold">Asset Code and Verified Asset Issuer</h2><div className="mt-3 grid gap-4 sm:grid-cols-[100px_1fr]"><Field label="Asset code"><input aria-label="Asset code" className={inputCls} value="USDC" readOnly /></Field><Field label="Proposed testnet issuer · validation required"><input aria-label="Asset issuer" className={inputCls} value={form.assetIssuer} onChange={e => { if (!e.target.value.trim().startsWith('S')) setForm({ ...form, assetIssuer: e.target.value }); else setMsg('Secret keys are not accepted.'); }} /></Field></div><p className="mt-2 text-xs text-muted-foreground">Asset code alone is not an identity. The exact issuer and network must be independently verified; genuine Circle USDC is not assumed.</p></section>
      <Button disabled={!canCreate} onClick={create}><FilePlus2 />Create draft instruction</Button>
    </> : <>
      <Card><h2 className="font-display text-lg font-semibold">Payer / Beneficiary Wallets</h2><dl className="mt-3 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-[190px_1fr]"><Row label="Instruction reference" value={instruction.id} /><Row label="Payer public wallet" value={instruction.source} /><Row label="Beneficiary public wallet" value={instruction.destination} /><Row label="Created" value={instruction.createdAt} /></dl></Card>
      <section><h2 className="font-display text-lg font-semibold">Asset Code and Verified Asset Issuer</h2><dl className="mt-3 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-[190px_1fr]"><Row label="Asset / network" value={`${instruction.assetCode} / ${NETWORK}`} /><Row label="Exact issuer" value={instruction.assetIssuer} /><Row label="Issuer validation" value={instruction.issuerVerifiedAt ? `Verified on testnet · ${instruction.issuerVerifiedAt}` : 'Not independently validated'} /></dl><p className="mt-2 text-xs text-muted-foreground">On-chain issuer matching does not attest Circle identity, reserve backing or redemption rights.</p>{instruction.status === 'Draft' && <Button className="mt-3" onClick={validate} disabled={busy || !unchanged}><ShieldCheck />{busy ? 'Validating…' : 'Validate instruction & issuer'}</Button>}</section>
      <section><h2 className="font-display text-lg font-semibold">Payment Authorisation</h2><p className="mt-2 text-sm text-muted-foreground">Payment authorisation and signing remain external to CDP Clear. No signed payment or authorisation record is created here.</p>{instruction.status === 'Validated' && <Button variant="outline" className="mt-3" onClick={() => setInstruction({ ...instruction, status: 'Pending Authorisation' })}><ArrowRight />Queue for external authorisation</Button>}{instruction.status === 'Pending Authorisation' && <Tag tone="warning">Pending external wallet authorisation</Tag>}</section>
      <section><h2 className="font-display text-lg font-semibold">Stellar Testnet Execution</h2><p className="mt-2 text-sm text-muted-foreground">Payment sending is not implemented. External wallet execution must use the exact instruction fields. Submitted denotes a supplied transaction hash, not submission by this application.</p>{['Pending Authorisation', 'Submitted', 'Failed', 'Exception', 'Confirmed'].includes(instruction.status) && <div className="mt-3"><Field label="External transaction hash"><input aria-label="External transaction hash" className={inputCls} placeholder="64-character transaction hash" value={hash} onChange={e => setHash(e.target.value)} /></Field><Button className="mt-3" onClick={verify} disabled={busy || !instruction.issuerVerifiedAt || !/^[0-9a-fA-F]{64}$/.test(hash.trim()) || !unchanged}><Search />{busy ? 'Verifying testnet…' : 'Verify network transaction'}</Button></div>}</section>
      <section><h2 className="font-display text-lg font-semibold">On-Chain Settlement Confirmation</h2><p className="mt-2 text-sm">{instruction.confirmedAt ? `Independently confirmed · Ledger ${instruction.ledger} · ${instruction.confirmedAt}` : 'No independently verified successful network transaction.'}</p>{instruction.txHash && <><p className="mt-2 break-all font-mono text-xs">{instruction.txHash}</p><a className="mt-2 inline-block text-sm text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${instruction.txHash}`} target="_blank" rel="noreferrer">Inspect on Stellar Expert (testnet) ↗</a></>}</section>
      <Card><h2 className="font-display text-lg font-semibold">Post-Trade Reconciliation</h2><p className="mt-2 text-sm text-muted-foreground">{instruction.verifiedNote ?? 'Pending independent network confirmation and matching of asset, issuer, amount, payer and beneficiary.'}</p>{instruction.status === 'Confirmed' && <Button className="mt-3" onClick={reconcile} disabled={!evidence}><CheckCircle2 />Reconcile cash-leg obligation</Button>}{instruction.status === 'Confirmed' && !evidence && <p className="mt-2 text-xs text-warning">Re-verify the hash after reopening this page before reconciliation.</p>}{instruction.status === 'Exception' && <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted-foreground">Manual operator review (not network confirmation)</summary><label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={manualAck} onChange={e => setManualAck(e.target.checked)} /><span>I reviewed the transaction externally. This acknowledgement does not confirm or reconcile settlement.</span></label><Button variant="outline" className="mt-3" disabled={!manualAck} onClick={() => setInstruction({ ...instruction, status: 'Exception', verifiedNote: 'Manual operator review recorded — NOT independently confirmed or reconciled.' })}>Record manual review</Button></details>}</Card>
      <Button variant="outline" disabled={busy} onClick={clear}>{instruction.status === 'Reconciled' ? <FilePlus2 /> : <Trash2 />}{instruction.status === 'Reconciled' ? 'Start a new instruction' : 'Discard instruction'}</Button>
    </>}
    {msg && <p role="status" className="border-l-2 border-warning pl-3 text-sm text-warning">{msg}</p>}
  </Shell>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs text-muted-foreground"><span className="mb-1 block">{label}</span>{children}</label>; }
function Row({ label, value }: { label: string; value: string }) { return <><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-all font-mono">{value}</dd></>; }
