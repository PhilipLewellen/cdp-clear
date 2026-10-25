import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, Tag, Term } from "@/components/Shell";
import { inputCls } from "@/lib/ui-classes";
import { useStore } from "@/lib/use-store";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { fmt, netObligations, type Obligation } from "@/lib/netting";
import { obligationSnapshot, settledSnapshot } from '@/lib/settlement';
import { TradeEconomics } from '@/components/TradeEconomics';

export const Route = createFileRoute("/obligations")({
  head: () => ({
    meta: [
      { title: "Settlement Obligations | CDP Clear" },
      { name: "description", content: "Illustrative contractual cash obligations and lifecycle metadata for CP-A and CP-B." },
      { property: "og:title", content: "Settlement Obligations | CDP Clear" },
      { property: "og:description", content: "Illustrative contractual cash obligations and lifecycle metadata for CP-A and CP-B." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Trades,
});

function Trades() {
  const { trades, setTrades, instruction, history, recordActivity, reset } = useStore();
  const settlementStatus = settledSnapshot(trades, history) ? 'Reconciled' : instruction?.obligationSnapshot === obligationSnapshot(trades) ? instruction.status : 'Uninstructed';
  const update = (i: number, patch: Partial<(typeof trades)[number]>) =>
    setTrades(trades.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const r = netObligations(trades);
  const contextDate = trades[0]?.settlementDate ?? '2026-10-26';
  const calculate = () => recordActivity({ category: 'Demo operation', action: 'Netting calculated', reference: 'NS-AB-001', detail: r.ok ? `${fmt(r.gross, r.currency)} gross / ${fmt(r.net, r.currency)} net · CP-${r.payer ?? '—'} → CP-${r.payee ?? '—'}` : r.error ?? 'Netting rejected' });
  return <Shell title="Settlement Obligations" intro={`NS-AB-001 / CP-A–CP-B / ${trades[0]?.currency ?? 'USD'} / ${contextDate === '2026-10-26' ? '26 Oct 2026' : contextDate}`}>
    <section className="border border-border rounded bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <span className="text-xs text-muted-foreground">{trades.length} obligations · GPU forwards · Simulated fixings</span>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setTrades([...trades, { id: `T-${String(Math.max(0, ...trades.map(t => Number(t.id.replace('T-', '')) || 0)) + 1).padStart(3, '0')}`, receiver: 'A', amount: 0, currency: 'USD', settlementDate: contextDate, lifecycle: 'Captured', eligible: true, economics: { instrument: 'GPU compute forward', longParty: 'A', quantity: 100, strike: 3, fixing: 3 } }])}><Plus className="size-3.5" />Add Obligation</Button><Button asChild><Link to="/netting" onClick={calculate}>Calculate Net<ArrowRight className="size-3.5" /></Link></Button></div>
      </div>
      {trades.length ? <div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Ref</th><th>Payer</th><th>Beneficiary</th><th>Currency</th><th className="text-right">Amount</th><th>Status</th><th>Trade economics</th><th>Actions</th></tr></thead><tbody>{trades.map((t,i) => <tr id={t.id} key={t.id}>
        <td className="font-mono">{t.id}</td><td className="font-mono">CP-{t.receiver === 'A' ? 'B' : 'A'}</td><td className="font-mono">{t.amount === 0 ? '—' : `CP-${t.receiver}`}</td>
        <td><input aria-label={`${t.id} currency`} className={inputCls + ' w-20'} value={t.currency} onChange={e => update(i,{currency:e.target.value.toUpperCase()})} /></td>
        <td className="text-right font-mono">{Number.isFinite(t.amount) ? fmt(t.amount,t.currency) : 'Invalid economics'}</td>
        <td><Tag tone={t.eligible === false ? 'warning' : settlementStatus === 'Reconciled' ? 'success' : 'muted'}>{t.eligible === false ? 'Ineligible' : settlementStatus === 'Uninstructed' ? t.lifecycle === 'Captured' ? 'Captured' : 'Valid · Eligible' : settlementStatus}</Tag></td>
        <td><TradeEconomics trade={t} onChange={(row: Obligation) => setTrades(trades.map((old,j) => j === i ? row : old))} onValidated={() => recordActivity({ category: 'Demo operation', action: 'Validation completed', reference: t.id, lifecycle: 'Validated', detail: 'GPU-forward economics validated locally; fixing remains simulated' })} /></td><td><Button variant="ghost" size="icon" aria-label={`Remove ${t.id}`} title={`Remove ${t.id}`} onClick={() => setTrades(trades.filter((_,j) => j !== i))}><Trash2 className="size-3.5" /></Button></td>
      </tr>)}</tbody></table></div> : <div className="p-6"><p className="mb-4 text-sm text-muted-foreground">No obligations in this netting set.</p><Button variant="outline" onClick={reset}>Restore sample obligations</Button></div>}
      <div className="flex flex-wrap justify-between gap-3 border-t border-border px-4 py-3 text-xs"><span className="text-muted-foreground">Aggregate gross <b className="ml-2 font-mono font-normal text-foreground">{fmt(trades.reduce((sum,t) => sum+t.amount,0), trades[0]?.currency ?? 'USD')}</b></span><span className="text-muted-foreground">Settlement state <Tag>{settlementStatus}</Tag></span></div>
    </section>
    <details className="border-y border-border p-4"><summary>Netting metadata & eligibility</summary><div className="mt-4 grid gap-6 md:grid-cols-2"><div><Term label="Contractual netting assumptions" meaning="Same counterparties, currency, netting set and settlement date; eligible obligations and an enforceable agreement. No novation or CCP guarantees." /><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><dt className="text-muted-foreground">Counterparties</dt><dd className="font-mono">CP-A / CP-B</dd><dt className="text-muted-foreground">Netting set</dt><dd className="font-mono">NS-AB-001</dd></dl></div><div className="space-y-2">{trades.map((t,i) => <div key={t.id} className="flex flex-wrap items-center gap-3"><span className="font-mono text-xs">{t.id}</span><input aria-label={`${t.id} settlement date`} type="date" className={inputCls + ' max-w-40'} value={t.settlementDate ?? '2026-10-26'} onChange={e => update(i,{settlementDate:e.target.value})} /><label className="flex items-center gap-2 text-xs"><input aria-label={`${t.id} eligibility`} type="checkbox" checked={t.eligible !== false} onChange={e => update(i,{eligible:e.target.checked})} />Eligible</label></div>)}</div></div></details>
  </Shell>;
}
