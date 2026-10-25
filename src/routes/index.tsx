import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Shell, Tag, btnCls, btnGhost, inputCls } from "@/components/Shell";
import { useStore } from "@/lib/store";
import { fmt, type Party } from "@/lib/netting";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trades — CDP Clear" },
      { name: "description", content: "Editable sample cash obligations between Party A and Party B." },
      { property: "og:title", content: "Trades — CDP Clear" },
      { property: "og:description", content: "Editable sample cash obligations between Party A and Party B." },
    ],
  }),
  component: Trades,
});

function Trades() {
  const { trades, setTrades } = useStore();
  const update = (i: number, patch: Partial<(typeof trades)[number]>) =>
    setTrades(trades.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Shell title="Trades" intro="Three cash obligations between Party A and Party B. Each row says who receives cash; the other party pays. Edit any value — the Netting page updates automatically.">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Tag tone="warning">Simulated values</Tag>
          <span className="text-xs text-muted-foreground">Sample obligations, not live market data.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Trade ID</th><th>Payer</th><th>Receiver</th><th>Currency</th><th>Amount</th><th>Plain English</th><th /></tr>
            </thead>
            <tbody>
              {trades.map((t, i) => {
                const payer: Party = t.receiver === "A" ? "B" : "A";
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="py-3 font-mono">{t.id}</td>
                    <td className="font-mono">{payer}</td>
                    <td>
                      <select className={inputCls + " w-20"} value={t.receiver} onChange={(e) => update(i, { receiver: e.target.value as Party })}>
                        <option value="A">A</option><option value="B">B</option>
                      </select>
                    </td>
                    <td><input className={inputCls + " w-20"} value={t.currency} onChange={(e) => update(i, { currency: e.target.value.toUpperCase() })} /></td>
                    <td><input type="number" min={0} step="0.01" className={inputCls + " w-32"} value={t.amount} onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })} /></td>
                    <td className="text-muted-foreground">{payer} pays {t.receiver} {fmt(t.amount, t.currency)}</td>
                    <td>
                      <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setTrades(trades.filter((_, j) => j !== i))}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-2">
          <button className={btnGhost} onClick={() => setTrades([...trades, { id: `T-${String(trades.length + 1).padStart(3, "0")}`, receiver: "A", amount: 0, currency: "USD" }])}>Add obligation</button>
          <Link to="/netting" className={btnCls}>Next: Netting →</Link>
        </div>
      </Card>
    </Shell>
  );
}
