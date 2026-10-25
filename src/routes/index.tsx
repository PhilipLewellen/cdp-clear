import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, Tag, Term, inputCls } from "@/components/Shell";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { type Party } from "@/lib/netting";
import { obligationSnapshot } from '@/lib/settlement';

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trade Capture & Lifecycle — CDP Clear" },
      { name: "description", content: "Illustrative contractual cash obligations and lifecycle metadata for CP-A and CP-B." },
      { property: "og:title", content: "Trade Capture & Lifecycle — CDP Clear" },
      { property: "og:description", content: "Illustrative contractual cash obligations and lifecycle metadata for CP-A and CP-B." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Trades,
});

function Trades() {
  const { trades, setTrades, instruction } = useStore();
  const settlementStatus = instruction?.obligationSnapshot === obligationSnapshot(trades) ? instruction.status : 'Uninstructed';
  const update = (i: number, patch: Partial<(typeof trades)[number]>) =>
    setTrades(trades.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Shell title="Bilateral Obligations Blotter" intro="Trade capture / NS-AB-001 · Tokenised compute derivatives">
      <section className="border-y border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
          <h2>Contractual cash obligations <span className="ml-2 font-mono text-xs text-muted-foreground">{trades.length} records</span></h2>
          <span className="text-[10px] text-muted-foreground">Illustrative valuation inputs · not trade notionals</span>
        </div>
        <div className="overflow-x-auto">
          <table className="workspace-table">
            <thead><tr><th>Trade Reference</th><th>Netting Set</th><th>Payer</th><th>Beneficiary</th><th>Currency</th><th className="text-right">Gross Obligation</th><th>Settlement Date</th><th>Lifecycle Status</th><th /></tr></thead>
            <tbody>{trades.map((t, i) => <tr key={t.id}>
              <td className="font-mono">{t.id}</td><td className="font-mono text-muted-foreground">NS-AB-001</td><td className="font-mono">CP-{t.receiver === "A" ? "B" : "A"}</td>
              <td><select aria-label={`${t.id} beneficiary`} className={inputCls + " min-w-20"} value={t.receiver} onChange={e => update(i, { receiver: e.target.value as Party })}><option value="A">CP-A</option><option value="B">CP-B</option></select></td>
              <td><input aria-label={`${t.id} currency`} className={inputCls + " w-20"} value={t.currency} onChange={e => update(i, { currency: e.target.value.toUpperCase() })} /></td>
              <td><input aria-label={`${t.id} gross obligation`} type="number" min={0} step="0.01" className={inputCls + " w-28 text-right"} value={t.amount} onChange={e => update(i, { amount: parseFloat(e.target.value) || 0 })} /></td>
              <td><input aria-label={`${t.id} settlement date`} type="date" className={inputCls + " w-36"} value={t.settlementDate ?? "2026-10-26"} onChange={e => update(i, { settlementDate: e.target.value })} /></td>
              <td><Tag tone={settlementStatus === 'Reconciled' ? 'success' : 'muted'}>{settlementStatus === 'Uninstructed' ? t.lifecycle ?? 'Validated' : settlementStatus}</Tag></td>
              <td><Button variant="ghost" size="icon" aria-label={`Remove ${t.id}`} title={`Remove ${t.id}`} onClick={() => setTrades(trades.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Button></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-between gap-3 px-3 py-3">
          <Button variant="outline" onClick={() => setTrades([...trades, { id: `T-${String(Math.max(0, ...trades.map(t => Number(t.id.replace("T-", "")) || 0)) + 1).padStart(3, "0")}`, receiver: "A", amount: 0, currency: "USD", settlementDate: trades[0]?.settlementDate ?? "2026-10-26", lifecycle: "Captured", eligible: true }])}><Plus className="size-3.5" />Add obligation</Button>
          <Button asChild><Link to="/netting">Determine Net Settlement Obligation<ArrowRight className="size-3.5" /></Link></Button>
        </div>
      </section>
      <section className="grid border-y border-border bg-card md:grid-cols-[1fr_1.3fr]">
        <div className="border-b border-border p-4 md:border-b-0 md:border-r">
          <h2 className="mb-4">Trade metadata</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><dt className="text-muted-foreground">Counterparty pair</dt><dd className="font-mono">CP-A / CP-B</dd><dt className="text-muted-foreground">Netting set</dt><dd className="font-mono">NS-AB-001</dd><dt className="text-muted-foreground">Settlement date</dt><dd className="font-mono">{new Set(trades.map(t => t.settlementDate)).size > 1 ? 'Multiple dates' : trades[0]?.settlementDate ?? '—'}</dd><dt className="text-muted-foreground">Settlement state</dt><dd><Tag>{settlementStatus}</Tag></dd></dl>
        </div>
        <div className="p-4"><div className="mb-2"><Term label="Netting eligibility" meaning="All obligations must be eligible and share counterparties, netting set, currency and settlement date. An enforceable netting agreement is assumed." /></div>
          <div className="flex flex-wrap gap-4">{trades.map((t, i) => <label key={t.id} className="flex items-center gap-2 border-b border-border py-2 text-xs"><input aria-label={`${t.id} eligibility`} type="checkbox" checked={t.eligible !== false} onChange={e => update(i, { eligible: e.target.checked })} /><span className="font-mono">{t.id}</span><span className="text-muted-foreground">{t.eligible !== false ? 'Eligible' : 'Excluded'}</span></label>)}</div>
        </div>
      </section>
    </Shell>
  );
}
