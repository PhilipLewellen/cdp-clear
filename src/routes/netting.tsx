import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Shell, Tag, btnCls } from "@/components/Shell";
import { useStore } from "@/lib/store";
import { fmt, netObligations } from "@/lib/netting";

export const Route = createFileRoute("/netting")({
  head: () => ({
    meta: [
      { title: "Netting — CDP Clear" },
      { name: "description", content: "Bilateral netting of gross obligations into one net payment." },
      { property: "og:title", content: "Netting — CDP Clear" },
      { property: "og:description", content: "Bilateral netting of gross obligations into one net payment." },
    ],
  }),
  component: Netting,
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Netting() {
  const { trades } = useStore();
  const r = netObligations(trades);
  return (
    <Shell title="Netting" intro="Instead of settling every obligation separately, we offset what A and B owe each other and settle only the difference.">
      {!r.ok ? (
        <Card><p className="text-destructive">{r.error}</p></Card>
      ) : (
        <>
          <Card className="border-primary/40">
            <div className="text-xs uppercase text-muted-foreground">Net result</div>
            <div className="mt-2 font-display text-4xl font-semibold text-primary">
              {r.payer ? `${r.payer} owes ${r.payee} ${fmt(r.net, r.currency)}` : "Fully offset — nothing to pay"}
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Gross obligations" value={fmt(r.gross, r.currency)} sub={`${trades.length} payments before netting`} />
            <Stat label="A receives (gross)" value={fmt(r.aReceives, r.currency)} sub="B → A" />
            <Stat label="B receives (gross)" value={fmt(r.bReceives, r.currency)} sub="A → B" />
            <Stat label="Net settlement" value={fmt(r.net, r.currency)} sub={`1 payment · ${r.gross ? Math.round((r.reduction / r.gross) * 100) : 0}% less cash moved`} />
          </div>
          <Card>
            <div className="text-sm text-muted-foreground">Calculation</div>
            <p className="mt-2 font-mono text-sm">
              |{fmt(r.aReceives, r.currency)} − {fmt(r.bReceives, r.currency)}| = {fmt(r.net, r.currency)}
            </p>
          </Card>
        </>
      )}
      <Card className="border-warning/40">
        <div className="mb-2"><Tag tone="warning">Important assumption</Tag></div>
        <p className="text-sm text-muted-foreground">
          Bilateral netting here assumes all obligations are between the <b className="text-foreground">same two counterparties</b>, share the{" "}
          <b className="text-foreground">same settlement cycle</b> and <b className="text-foreground">same currency</b>, and are covered by an{" "}
          <b className="text-foreground">enforceable netting agreement</b> (e.g. an ISDA/master agreement with legal opinions). Without these, netting may not be legally valid.
        </p>
      </Card>
      <Link to="/settlement" className={btnCls}>Next: Settlement →</Link>
    </Shell>
  );
}
