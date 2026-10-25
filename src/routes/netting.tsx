import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Shell, Tag, Term } from "@/components/Shell";
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
  return (
    <div className="min-w-0 border-l border-border px-4 py-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Netting() {
  const { trades } = useStore();
  const r = netObligations(trades);
  return (
    <Shell title="Net Settlement Obligation Determination" intro="Netting Set NS-AB-001 · CP-A / CP-B · Bilateral payment netting of eligible contractual cash obligations.">
      {!r.ok ? (
        <Card><p className="text-destructive">{r.error}</p></Card>
      ) : (
        <>
          <Card className="border-primary/40">
            <div className="text-xs uppercase text-muted-foreground">Net Settlement Obligation (NSO)</div>
            <div className="mt-2 font-display text-2xl font-semibold text-primary">
              {r.payer ? `${fmt(r.net, r.currency)} · Payable CP-${r.payer} to CP-${r.payee}` : "Fully offset — nothing to pay"}
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Aggregate gross payment flows" value={fmt(r.gross, r.currency)} sub={`${trades.length} payments before netting`} />
            <Stat label="Gross payable by CP-B" value={fmt(r.aReceives, r.currency)} sub="Gross receivable by CP-A" />
            <Stat label="Gross payable by CP-A" value={fmt(r.bReceives, r.currency)} sub="Gross receivable by CP-B" />
            <Stat label="Net settlement obligation" value={fmt(r.net, r.currency)} sub={`${r.net > 0 ? 1 : 0} net payment`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><Stat label="Gross payment reduction" value={fmt(r.reduction, r.currency)} sub={`${r.gross ? ((r.reduction / r.gross) * 100).toFixed(1) : "0.0"}% reduction`} /><Stat label="Payment Compression" value={`${trades.length} gross → ${r.net > 0 ? 1 : 0} net`} sub="Payment instruction compression" /></div>
          <div className="grid gap-3 text-sm sm:grid-cols-3"><div><Term label="Net Payer" meaning="Counterparty owing the remaining cash amount after eligible obligations are offset." /><p className="font-mono">{r.payer ? `CP-${r.payer}` : "None"}</p></div><div><Term label="Net Beneficiary" meaning="Counterparty entitled to receive the net settlement obligation." /><p className="font-mono">{r.payee ? `CP-${r.payee}` : "None"}</p></div><div><Term label="Settlement Currency" meaning="The single contractual currency shared by this netting set." /><p className="font-mono">{r.currency}</p></div></div>
          <Card>
            <div className="text-sm text-muted-foreground">Calculation</div>
            <p className="mt-2 font-mono text-sm">
              {fmt(Math.max(r.aReceives, r.bReceives), r.currency)} − {fmt(Math.min(r.aReceives, r.bReceives), r.currency)} = {fmt(r.net, r.currency)}
            </p>
          </Card>
        </>
      )}
      <Card className="border-warning/40">
        <div className="mb-2"><Tag tone="warning">Contractual netting assumptions</Tag></div>
        <p className="text-sm text-muted-foreground">
          Bilateral netting here assumes all obligations are between the <b className="text-foreground">same two counterparties</b>, share the{" "}
          <b className="text-foreground">matching settlement dates and eligible obligations</b> and <b className="text-foreground">same currency</b>, and are covered by an{" "}
          <b className="text-foreground">enforceable netting agreement</b> (e.g. an ISDA/master agreement with legal opinions). Netting is assumed contractually permitted. This demonstration does not perform novation or multilateral netting and makes no claim of margin optimisation or a CCP risk guarantee.
        </p>
      </Card>
      <Button asChild><Link to="/settlement">Cash-leg settlement<ArrowRight /></Link></Button>
    </Shell>
  );
}
