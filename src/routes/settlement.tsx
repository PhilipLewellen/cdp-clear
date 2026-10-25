import { createFileRoute, Link } from '@tanstack/react-router';
import { useRef, useState, type ReactNode } from 'react';
import { Shell, Tag, Term } from '@/components/Shell';
import { ManualSettlement } from '@/components/ManualSettlement';
import { WalletSettlementAsset } from '@/components/WalletSettlementAsset';
import { TestSettlementPayment } from '@/components/TestSettlementPayment';
import { TestSettlementReconciliation } from '@/components/TestSettlementReconciliation';
import { inputCls } from '@/lib/ui-classes';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, FilePlus2, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/use-store';
import { fmt, netObligations } from '@/lib/netting';
import { DEFAULT_ISSUER, NETWORK, verifyTestnetAsset, verifyTestnetPayment, type VerifyResult } from '@/lib/stellar';
import { LIFECYCLE, obligationSnapshot, publicAddress, reconcileInstruction, settledSnapshot, type Instruction } from '@/lib/settlement';

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
  const { trades, instruction, history, setInstruction, recordActivity, testSettlement } = useStore();
  const r = netObligations(trades);
  const [form, setForm] = useState({ assetIssuer: DEFAULT_ISSUER, source: '', destination: '' });
  const [hash, setHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<VerifyResult | null>(null);
  const [manualAck, setManualAck] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = useRef({ trades, instruction, history });
  current.current = { trades, instruction, history };
  const alreadySettled = settledSnapshot(trades, history);
  const canCreate = !alreadySettled && r.currency === 'USD' && r.ok && r.net > 0 && r.payer && r.payee && publicAddress(form.source) && publicAddress(form.destination) && form.source.trim() !== form.destination.trim() && publicAddress(form.assetIssuer);
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
    if (!instruction || busy || instruction.status === 'Reconciled' || !unchanged || !instruction.issuerVerifiedAt || !/^[0-9a-fA-F]{64}$/.test(hash.trim())) return;
    const txHash = hash.trim().toLowerCase();
    if (testSettlement?.allocatedHashes?.includes(txHash) || (testSettlement?.result?.status === 'Reconciled' && testSettlement.hash === txHash) || history.some(row => row.txHash === txHash && row.id !== instruction.id)) {
      setInstruction({ ...instruction, status: 'Exception', verifiedNote: 'Transaction already allocated to a reconciled instruction.' });
      setMsg('Duplicate settlement rejected. Use a new payment transaction.'); return;
    }
    setBusy(true); setMsg(null); setEvidence(null);
    recordActivity({ category: 'Demo operation', action: 'Verification requested', reference: instruction.id, lifecycle: 'Verification pending', detail: `Read-only Horizon Testnet lookup · ${txHash} · No payment initiated` });
    const submitted: Instruction = { ...instruction, txHash, status: 'Pending Authorisation', confirmedAt: undefined, reconciledAt: undefined, ledger: undefined };
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
  const selected = rows.find(row => row.id === selectedId);
  return <Shell title="Settlement & Reconciliation" intro="USDC cash-leg operations / NS-AB-001 · Independent testnet verification">
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-2 text-[10px] text-muted-foreground">
      <span>Separate 1 USDC Test Payment <b className="ml-1 font-normal text-primary">Freighter enabled</b></span><span>Simulated Obligation Payment <b className="ml-1 font-normal text-warning">External only</b></span><span>Testnet Transaction Verification <b className="ml-1 font-normal text-primary">Implemented</b></span>
    </div>
    <div className="settlement-workspace">
      <div className="settlement-side">
      <section className="settlement-section">
        <div className="module-heading"><h2>Settlement instruction register</h2><span>{rows.length} records</span></div>
        <div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Reference</th><th>Payer</th><th>To</th><th className="text-right">Amount</th><th>Asset</th><th>Lifecycle</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={(selectedId ?? instruction?.id) === row.id ? 'selected-row' : ''}><td className="font-mono"><Button variant="ghost" className="!h-auto px-0 font-mono text-xs" onClick={() => setSelectedId(row.id)} aria-label={`Select ${row.id}`}>{row.id}</Button></td><td>CP-{row.payer ?? '—'}</td><td>CP-{row.beneficiary ?? '—'}</td><td className="text-right font-mono">{row.amount.toFixed(2)}</td><td>{row.assetCode}</td><td><Tag tone={row.status === 'Reconciled' ? 'success' : 'warning'}>{row.status}</Tag></td></tr>)}{rows.length === 0 && <tr><td colSpan={6} className="text-muted-foreground">No settlement instructions</td></tr>}</tbody></table></div>
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[10px]">{LIFECYCLE.filter(status => !['Failed', 'Exception'].includes(status)).map((status, i) => <span key={status} className={instruction?.status === status ? 'text-primary' : 'text-muted-foreground'}>{i > 0 && <span className="mr-2 text-muted-foreground">→</span>}{status}</span>)}</div>
        <p className="mt-3 text-[10px] text-muted-foreground">Browser-local register · Failed and Exception states retained</p>
        {instruction && <Button variant="outline" className="mt-5" disabled={busy} onClick={clear}>{instruction.status === 'Reconciled' ? <FilePlus2 className="size-3.5" /> : <Trash2 className="size-3.5" />}{instruction.status === 'Reconciled' ? 'Start a new instruction' : 'Discard instruction'}</Button>}
      </section>
      <section className="settlement-section">
        <div className="module-heading"><h2>Settlement summary</h2></div>
        <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
          <div><Term label="Contractual settlement obligation" meaning="Net cash obligation in the contractual currency; not derivative notional." /><p className="mt-1 font-mono text-base">{fmt(displayedAmount, currency)}</p></div>
          <div><Term label="Proposed tokenised cash settlement" meaning="Illustrative 1:1 conversion to testnet USDC. No live exchange rate or guaranteed value." /><p className="mt-1 font-mono text-base text-primary">{displayedAmount.toFixed(2)} <span className="text-sm">USDC</span></p></div>
        </div>
        <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-4 gap-y-2.5"><Row label="Netting set" value="NS-AB-001" /><Row label="Instruction reference" value={instruction?.id ?? 'Not generated'} /><Row label="Net payer / beneficiary" value={`CP-${instruction?.payer ?? r.payer ?? '—'} → CP-${instruction?.beneficiary ?? r.payee ?? '—'}`} /><Row label="Settlement network" value={NETWORK} /><dt className="text-muted-foreground">Lifecycle state</dt><dd><Tag tone={instruction?.status === 'Reconciled' ? 'success' : 'primary'}>{instruction?.status ?? 'Uninstructed'}</Tag></dd></dl>
        <p className="mt-4 text-xs text-muted-foreground">Illustrative 1:1 assumption: 1 {currency} = 1 testnet USDC. No real funds.</p>
        {!r.ok && <p role="alert" className="mt-3 text-xs text-destructive">{r.error}</p>}
        {alreadySettled && <p className="mt-3 text-xs text-success">This obligation snapshot is already Reconciled. A second instruction is blocked.</p>}
        {!trades.length && <Button asChild variant="outline" className="mt-3"><Link to="/">Add or restore GPU forwards</Link></Button>}
        {r.currency !== 'USD' && <p className="mt-3 text-xs text-warning">USDC proposal requires contractual USD obligations; no currency conversion is implemented.</p>}
        {r.ok && r.net === 0 && <p className="mt-3 text-xs text-muted-foreground">Zero NSO — no cash-leg instruction required.</p>}
        {instruction && !unchanged && <p role="alert" className="mt-3 text-xs text-destructive">Netting set changed. Discard this instruction and create a new one before reconciliation.</p>}
      </section>
      </div>
      <div className="settlement-side">
        <TestSettlementReconciliation />
        <TestSettlementPayment onSuccess={() => setBalanceRefresh(value => value + 1)} />
        <WalletSettlementAsset refreshVersion={balanceRefresh} amount={selected?.amount ?? displayedAmount} source={selected?.source ?? instruction?.source ?? form.source} beneficiary={selected?.destination ?? instruction?.destination ?? form.destination} issuer={selected?.assetIssuer ?? instruction?.assetIssuer ?? form.assetIssuer} {...(!instruction && !selected ? { onBeneficiaryChange: (destination: string) => setForm(value => ({ ...value, destination })), onUsePayer: (source: string) => setForm(value => ({ ...value, source })) } : {})} />
        {selected && selected.id !== instruction?.id ? <section className="settlement-section"><div className="module-heading"><h2>Reconciled instruction</h2><span>{selected.id}</span></div><dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-sm"><Row label="Amount" value={`${selected.amount.toFixed(2)} USDC`} /><Row label="USD obligation" value={fmt(selected.amount, selected.currency)} /><Row label="Exact issuer" value={selected.assetIssuer} /><Row label="Source wallet" value={selected.source} /><Row label="Beneficiary wallet" value={selected.destination} /><Row label="Network" value={NETWORK} /><Row label="State" value={selected.status} /><Row label="Transaction hash" value={selected.txHash} /></dl>{selected.confirmedAt && <a className="mt-4 inline-block text-xs text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${selected.txHash}`} target="_blank" rel="noreferrer">Inspect on Stellar Expert (testnet) ↗</a>}<Button className="mt-4" variant="outline" onClick={() => setSelectedId(null)}>Return to current instruction</Button></section> : <>
      <section className="settlement-section">
        <div className="module-heading"><h2>{instruction ? 'Selected net settlement instruction' : 'Generate net settlement instruction'}</h2><span>{instruction?.id ?? 'New instruction'}</span></div>
        {!instruction ? <>
          <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-3"><Field label="Asset code"><input aria-label="Asset code" className={inputCls} value="USDC" readOnly /></Field><Field label="Proposed testnet issuer · validation required"><input aria-label="Asset issuer" className={inputCls} value={form.assetIssuer} onChange={e => { if (!e.target.value.trim().startsWith('S')) setForm({ ...form, assetIssuer: e.target.value }); else setMsg('Secret keys are not accepted.'); }} />{form.assetIssuer && !publicAddress(form.assetIssuer) && <span className="mt-1 block text-destructive">Enter a valid public G-address.</span>}</Field></div>
          <div className="mt-4"><Field label={`Source Stellar wallet · CP-${r.payer ?? '—'}`}><input aria-label="Payer public wallet" className={inputCls} placeholder="G… public Stellar Testnet address" value={form.source} onChange={e => { if (!e.target.value.trim().startsWith('S')) setForm({ ...form, source: e.target.value }); else setMsg('Secret keys are not accepted. Enter a public G-address only.'); }} />{form.source && !publicAddress(form.source) && <span className="mt-1 block text-destructive">Enter a valid public G-address.</span>}</Field></div>
          <div className="mt-4"><Field label={`Beneficiary Stellar wallet · CP-${r.payee ?? '—'}`}><input aria-label="Beneficiary public wallet" className={inputCls} placeholder="G… public Stellar Testnet address" value={form.destination} onChange={e => { if (!e.target.value.trim().startsWith('S')) setForm({ ...form, destination: e.target.value }); else setMsg('Secret keys are not accepted. Enter a public G-address only.'); }} />{form.destination && !publicAddress(form.destination) && <span className="mt-1 block text-destructive">Enter a valid public G-address.</span>}{form.destination && form.destination === form.source && <span className="mt-1 block text-destructive">Source and beneficiary must be different.</span>}</Field></div>
          <p className="mt-3 text-[10px] text-muted-foreground">Exact issuer validation required. Genuine Circle USDC is not assumed.</p>
          <Button className="mt-4" disabled={!canCreate} onClick={create}><FilePlus2 className="size-3.5" />Create draft instruction</Button>
        </> : <>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-3"><Row label="Instruction ID" value={instruction.id} /><Row label="Payer / beneficiary" value={`CP-${instruction.payer} → CP-${instruction.beneficiary}`} /><Row label="USD obligation" value={fmt(instruction.amount,instruction.currency)} /><Row label="Lifecycle" value={instruction.status} /><Row label="Asset / network" value={`${instruction.assetCode} / ${NETWORK}`} /><Row label="Exact issuer" value={instruction.assetIssuer} /><Row label="Issuer validation" value={instruction.issuerVerifiedAt ? 'Verified on Stellar Testnet' : 'Not independently validated'} /><Row label="Source wallet" value={instruction.source} /><Row label="Beneficiary wallet" value={instruction.destination} /><Row label="Settlement amount" value={`${instruction.amount.toFixed(2)} USDC`} /><Row label="Created" value={instruction.createdAt} /><Row label="Transaction reference" value={instruction.txHash || 'Not supplied'} /></dl>
          <p className="mt-4 text-[10px] text-muted-foreground">Issuer matching does not attest Circle identity, reserves or redemption rights.</p>
          {instruction.status === 'Draft' && <Button className="mt-4" onClick={validate} disabled={busy || !unchanged}><ShieldCheck className="size-3.5" />{busy ? 'Validating…' : 'Validate instruction & issuer'}</Button>}
          {instruction.status === 'Validated' && <Button variant="outline" className="mt-4" onClick={() => setInstruction({ ...instruction, status: 'Pending Authorisation' })}><ArrowRight className="size-3.5" />Queue for external authorisation</Button>}
          {instruction.status === 'Pending Authorisation' && <p className="mt-4 text-xs text-warning">Pending external wallet authorisation</p>}
        </>}
      </section>
      <section className="settlement-section">
        <div className="module-heading"><h2>On-chain confirmation & reconciliation</h2></div>
        
        {instruction ? <>
          {instruction.issuerVerifiedAt && instruction.status !== 'Reconciled' && <ManualSettlement instruction={instruction} />}
          {['Pending Authorisation', 'Submitted', 'Failed', 'Exception', 'Confirmed'].includes(instruction.status) && <><Field label="External transaction hash"><input aria-label="External transaction hash" className={inputCls} placeholder="64-character transaction hash" value={hash} onChange={e => setHash(e.target.value)} />{hash && !/^[0-9a-fA-F]{64}$/.test(hash.trim()) && <span className="mt-1 block text-destructive">Enter exactly 64 hexadecimal characters.</span>}</Field><Button className="mt-3" onClick={verify} disabled={busy || !instruction.issuerVerifiedAt || !/^[0-9a-fA-F]{64}$/.test(hash.trim()) || !unchanged}><Search className="size-3.5" />{busy ? 'Verifying testnet…' : 'Verify network transaction'}</Button></>}
          <div className="mt-4 border-y border-border py-3"><div className="mb-2 text-[10px] text-muted-foreground">NETWORK CONFIRMATION</div><p className="text-xs">{instruction.confirmedAt ? `Independently confirmed · Ledger ${instruction.ledger}` : 'No independently verified successful transaction.'}</p>{instruction.confirmedAt && <><p className="mt-1 font-mono text-[10px] text-muted-foreground">{instruction.confirmedAt}</p><a className="mt-2 inline-block text-xs text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${instruction.txHash}`} target="_blank" rel="noreferrer">Inspect on Stellar Expert (testnet) ↗</a></>}</div>
          <div className="mt-4"><div className="mb-2 text-[10px] text-muted-foreground">POST-TRADE RECONCILIATION</div><p className="text-xs text-muted-foreground">{instruction.verifiedNote ?? 'Pending network confirmation and matching against the obligation.'}</p>{instruction.status === 'Confirmed' && <Button className="mt-3" onClick={reconcile} disabled={!evidence}><CheckCircle2 className="size-3.5" />Reconcile cash-leg obligation</Button>}{instruction.status === 'Confirmed' && !evidence && <p className="mt-2 text-[10px] text-warning">Re-verify the hash after reopening this page before reconciliation.</p>}</div>
          {instruction.status === 'Exception' && <details className="mt-4 text-xs"><summary className="cursor-pointer text-muted-foreground">Manual operator review</summary><label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={manualAck} onChange={e => setManualAck(e.target.checked)} /><span>External review only; does not confirm or reconcile settlement.</span></label><Button variant="outline" className="mt-3" disabled={!manualAck} onClick={() => setInstruction({ ...instruction, status: 'Exception', verifiedNote: 'Manual operator review recorded — NOT independently confirmed or reconciled.' })}>Record manual review</Button></details>}
        </> : <div className="border-y border-border py-5 text-xs text-muted-foreground">Create and validate an instruction above before external payment.</div>}
        
      </section>        </>}
      </div>
    </div>
    <details className="border-y border-border p-4"><summary>System Details</summary><p className="mt-3 text-xs text-muted-foreground">Public Horizon Stellar Testnet verification checks success, exact asset issuer, amount, payer and beneficiary. Simulated-obligation payment remains external; the separate 1 USDC Freighter test payment never changes instruction state; Supplying a hash records only a local verification request; no submission is claimed. Asset matching does not attest Circle authenticity or reserves. Browser-local records are not shared across users.</p></details>
    {msg && <p role="status" className="border-l-2 border-warning pl-3 text-xs text-warning">{msg}</p>}
  </Shell>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-[10px] text-muted-foreground"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function Row({ label, value }: { label: string; value: string }) { return <><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-all font-mono">{value}</dd></>; }
