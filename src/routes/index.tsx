import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Shell, Tag, Term, inputCls } from "@/components/Shell";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { type Party } from "@/lib/netting";

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
  const { trades, setTrades } = useStore();
  const update = (i: number, patch: Partial<(typeof trades)[number]>) =>
    setTrades(trades.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Shell title="Bilateral Settlement Obligations" intro="Contractual cash obligations within netting set NS-AB-001 · CP-A / CP-B · Tokenised compute derivatives.">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Tag tone="warning">Illustrative valuation inputs</Tag>
          <span className="text-xs text-muted-foreground">Cash obligations, not derivative trade notionals or live market valuations.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Trade Reference</th><th>Counterparty Payer</th><th>Counterparty Beneficiary</th><th>Contractual Currency</th><th className="text-right">Gross Obligation</th><th>Settlement Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {trades.map((t, i) => {
                const payer: Party = t.receiver === "A" ? "B" : "A";
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="py-3 font-mono">{t.id}</td>
                    <td className="font-mono">CP-{payer}</td>
                    <td>
                      <select aria-label={`${t.id} beneficiary`} className={inputCls + " min-w-24"} value={t.receiver} onChange={(e) => update(i, { receiver: e.target.value as Party })}>
                        <option value="A">CP-A</option><option value="B">CP-B</option>
                      </select>
                    </td>
                    <td><input aria-label={`${t.id} currency`} className={inputCls + " min-w-24"} value={t.currency} onChange={(e) => update(i, { currency: e.target.value.toUpperCase() })} /></td>
                    <td><input aria-label={`${t.id} gross obligation`} type="number" min={0} step="0.01" className={inputCls + " w-32 text-right"} value={t.amount} onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })} /></td>
                    <td><Tag>Uninstructed</Tag></td>
                    <td>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${t.id}`} title={`Remove ${t.id}`} onClick={() => setTrades(trades.filter((_, j) => j !== i))}><Trash2 /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => setTrades([...trades, { id: `T-${String(Math.max(0, ...trades.map(t => Number(t.id.replace("T-", "")) || 0)) + 1).padStart(3, "0")}`, receiver: "A", amount: 0, currency: "USD", settlementDate: trades[0]?.settlementDate ?? "2026-10-26", lifecycle: "Captured", eligible: true }])}><Plus />Add obligation</Button>
          <Button asChild><Link to="/netting">Determine NSO<ArrowRight /></Link></Button>
        </div>
      </Card>
      <section><h2 className="mb-3 text-sm font-semibold">Trade lifecycle metadata</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th>Trade Reference</th><th>Lifecycle</th><th>Settlement Date</th><th><Term label="Netting eligibility" meaning="Only eligible obligations with matching settlement dates and currencies can form this bilateral netting set." /></th></tr></thead><tbody>{trades.map((t, i) => <tr key={t.id} className="border-t border-border"><td className="py-2 font-mono">{t.id}</td><td>{t.lifecycle ?? "Validated"}</td><td><input aria-label={`${t.id} settlement date`} type="date" className={inputCls + " max-w-44"} value={t.settlementDate ?? "2026-10-26"} onChange={e => update(i, { settlementDate: e.target.value })} /></td><td><label className="flex items-center gap-2"><input type="checkbox" checked={t.eligible !== false} onChange={e => update(i, { eligible: e.target.checked })} />Eligible</label></td></tr>)}</tbody></table></div></section>
    </Shell>
  );
}
