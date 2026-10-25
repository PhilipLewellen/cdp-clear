import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, Term } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useStore } from "@/lib/use-store";
import { fmt, netObligations } from "@/lib/netting";

export const Route = createFileRoute("/netting")({
  head: () => ({
    meta: [
      { title: "Bilateral Payment Netting | CDP Clear" },
      { name: "description", content: "Bilateral netting of gross obligations into one net payment." },
      { property: "og:title", content: "Bilateral Payment Netting | CDP Clear" },
      { property: "og:description", content: "Bilateral netting of gross obligations into one net payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Netting,
});

function Netting() {
  const { trades, recordActivity } = useStore();
  const r = netObligations(trades);
  const affected = trades.filter(t => !netObligations([t]).ok || t.currency.trim().toUpperCase() !== trades[0]?.currency.trim().toUpperCase() || t.settlementDate !== trades[0]?.settlementDate || !Number.isFinite(t.amount) || t.amount < 0);
  return <Shell title="Netting" intro="NS-AB-001 / CP-A–CP-B / Bilateral payment offset">
    {!trades.length && <section className="border-y border-border p-4"><p className="mb-3">No forwards to net.</p><Button asChild variant="outline"><Link to="/obligations">Add or restore sample forwards</Link></Button></section>}
    {!r.ok ? <section className="border-l-2 border-destructive bg-card p-4"><p role="alert" className="text-sm text-destructive">{r.error}</p><div className="mt-3 flex flex-wrap gap-3">{(affected.length ? affected : trades.slice(0,1)).map(t => <Button key={t.id} asChild variant="outline"><Link to="/obligations" hash={t.id}>Review {t.id}</Link></Button>)}</div></section> : <>
      <section className="flex flex-wrap items-center justify-between gap-6 rounded border border-border bg-card p-6">
        <div><div className="mb-2 text-xs text-muted-foreground">Net Obligation</div><div className="flex flex-wrap items-baseline gap-x-6 gap-y-2"><span className="font-mono text-3xl text-primary">{fmt(r.net,r.currency)}</span><span className="font-mono text-sm">{r.payer ? `CP-${r.payer} → CP-${r.payee}` : 'Fully offset · no payment required'}</span></div></div>
        {r.net > 0 ? <Button asChild><Link to="/settlement" onClick={() => recordActivity({ category:'Demo operation',action:'Settlement workspace opened',reference:'NS-AB-001',detail:`${fmt(r.net,r.currency)} obligation · Instruction not yet generated` })}>Create Settlement Instruction<ArrowRight className="size-3.5" /></Link></Button> : <Button asChild variant="outline"><Link to="/obligations">Review obligations</Link></Button>}
      </section>
      <section className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <div className="border-y border-border"><h2 className="py-4">Payment flows</h2><dl className="space-y-0 text-sm">{[['Gross',fmt(r.gross,r.currency)],['CP-B Payable',fmt(r.aReceives,r.currency)],['CP-A Payable',fmt(r.bReceives,r.currency)],['Reduction',`${fmt(r.reduction,r.currency)} (${r.gross ? ((r.reduction/r.gross)*100).toFixed(1) : '0.0'}%)`],['Compression',`${trades.length} gross → ${r.net > 0 ? 1 : 0} net`]].map(([label,value]) => <div key={label} className="flex justify-between gap-4 border-t border-border py-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-mono">{value}</dd></div>)}</dl></div>
        <div className="border-y border-border py-4"><h2 className="mb-6">Cash movement comparison</h2><div className="mb-6"><div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Gross payment flows</span><span className="font-mono">{fmt(r.gross,r.currency)}</span></div><progress aria-label="Gross cash movements" className="cash-bar gross" max={r.gross || 1} value={r.gross} /></div><div><div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Net payment</span><span className="font-mono text-primary">{fmt(r.net,r.currency)}</span></div><progress aria-label="Net cash movements" className="cash-bar" max={r.gross || 1} value={r.net} /></div><p className="mt-6 font-mono text-sm text-primary">{r.gross ? ((r.reduction/r.gross)*100).toFixed(1) : '0.0'}% fewer gross cash flows</p></div>
      </section>
      <details className="border-y border-border p-4"><summary>Calculation provenance · {trades.length} eligible obligations</summary><div className="mt-4"><div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Ref</th><th>Payer → Beneficiary</th><th>Value date</th><th className="text-right">Obligation</th></tr></thead><tbody>{trades.map(t => <tr key={t.id}><td className="font-mono">{t.id}</td><td className="font-mono">CP-{t.receiver === 'A' ? 'B' : 'A'} → CP-{t.receiver}</td><td className="font-mono">{t.settlementDate}</td><td className="text-right font-mono">{fmt(t.amount,t.currency)}</td></tr>)}</tbody></table></div><p className="mt-4 font-mono text-sm">{fmt(Math.max(r.aReceives,r.bReceives),r.currency)} − {fmt(Math.min(r.aReceives,r.bReceives),r.currency)} = {fmt(r.net,r.currency)}</p><div className="mt-3"><Term label="Contractual netting assumptions" meaning="Same counterparties, currency, netting set, eligible obligations and settlement date. Enforceable netting agreement assumed; no novation or CCP risk guarantee." /></div></div></details>
    </>}
  </Shell>;
}
