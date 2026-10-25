import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Shell, Term } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmt, netObligations } from "@/lib/netting";

export const Route = createFileRoute("/netting")({
  head: () => ({
    meta: [
      { title: "Bilateral Payment Netting — CDP Clear" },
      { name: "description", content: "Bilateral netting of gross obligations into one net payment." },
      { property: "og:title", content: "Bilateral Payment Netting — CDP Clear" },
      { property: "og:description", content: "Bilateral netting of gross obligations into one net payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Netting,
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="min-w-0 border-b border-border py-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-base">{value}</div>{sub && <div className="mt-1 text-[10px] text-muted-foreground">{sub}</div>}</div>;
}

function Netting() {
  const { trades } = useStore();
  const r = netObligations(trades);
  return <Shell title="Payment Netting" intro="Net settlement engine / NS-AB-001 · CP-A / CP-B">
    {!r.ok ? <Card><p role="alert" className="text-destructive">{r.error}</p><Button asChild variant="outline" className="mt-3"><Link to="/">Review trade obligations</Link></Button></Card> : <>
      <section className="grid border-y border-border bg-card lg:grid-cols-[1.1fr_1fr]">
        <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="text-[10px] font-medium text-muted-foreground">NET SETTLEMENT OBLIGATION</div>
          <div className="mt-3 break-words font-mono text-4xl font-medium text-primary">{fmt(r.net, r.currency)}</div>
          <div className="mt-3 font-mono text-sm">{r.payer ? `Payable CP-${r.payer} → CP-${r.payee}` : 'Fully offset · no payment required'}</div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4 text-xs"><span className="text-muted-foreground">Netting set <b className="ml-2 font-mono font-normal text-foreground">NS-AB-001</b></span><span className="text-muted-foreground">Value date <b className="ml-2 font-mono font-normal text-foreground">{trades[0]?.settlementDate ?? '—'}</b></span></div>
        </div>
        <div className="p-5"><div className="module-heading"><h2>Gross versus net cash movements</h2><span>{r.currency}</span></div>
          <div className="mb-5"><div className="mb-2 flex justify-between gap-2 text-xs"><span className="text-muted-foreground">Aggregate gross</span><span className="font-mono">{fmt(r.gross, r.currency)}</span></div><progress aria-label="Gross cash movements" className="cash-bar gross" max={r.gross || 1} value={r.gross} /></div>
          <div><div className="mb-2 flex justify-between gap-2 text-xs"><span className="text-muted-foreground">Net settlement</span><span className="font-mono text-primary">{fmt(r.net, r.currency)}</span></div><progress aria-label="Net cash movements" className="cash-bar" max={r.gross || 1} value={r.net} /></div>
          <div className="mt-5 flex justify-between border-t border-border pt-3 text-xs"><span className="text-muted-foreground">Gross payment reduction</span><span className="font-mono text-primary">{r.gross ? ((r.reduction / r.gross) * 100).toFixed(1) : '0.0'}%</span></div>
        </div>
      </section>
      <section className="grid gap-x-7 px-1 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Aggregate Gross Payment Flows" value={fmt(r.gross, r.currency)} />
        <Stat label="Gross Payable by CP-B" value={fmt(r.aReceives, r.currency)} />
        <Stat label="Gross Payable by CP-A" value={fmt(r.bReceives, r.currency)} />
        <Stat label="Net Settlement Obligation" value={fmt(r.net, r.currency)} />
        <Stat label="Gross Payment Reduction" value={fmt(r.reduction, r.currency)} sub={`${r.gross ? ((r.reduction / r.gross) * 100).toFixed(1) : '0.0'}% reduction`} />
        <Stat label="Payment Compression" value={`${trades.length} gross → ${r.net > 0 ? 1 : 0} net`} sub="Settlement instructions" />
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 border-y border-border bg-card px-4 py-4"><div><div className="mb-2 text-[10px] text-muted-foreground">BILATERAL OFFSET CALCULATION</div><p className="font-mono text-sm">{fmt(Math.max(r.aReceives, r.bReceives), r.currency)} − {fmt(Math.min(r.aReceives, r.bReceives), r.currency)} = <span className="text-primary">{fmt(r.net, r.currency)}</span></p></div><Button asChild disabled={r.net === 0}><Link to="/settlement">Generate Settlement Instruction<ArrowRight className="size-3.5" /></Link></Button></section>
    </>}
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><Term label="Contractual netting assumptions" meaning="Same counterparty pair, netting set, currency and settlement date; all obligations eligible and covered by an enforceable netting agreement (e.g. ISDA/master agreement with legal opinions). No novation, multilateral netting, margin optimisation or CCP risk guarantee." /><span>CP-A / CP-B · Single currency · Matching value date · Enforceable agreement assumed</span></div>
  </Shell>;
}
