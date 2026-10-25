import { createFileRoute, Link } from '@tanstack/react-router';
import { Shell, Tag } from '@/components/Shell';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/use-store';
import { fmt, netObligations } from '@/lib/netting';
import { obligationSnapshot, settledSnapshot } from '@/lib/settlement';

export const Route = createFileRoute('/overview')({
  head: () => ({ meta: [
    { title: 'Operations Overview — CDP Clear' },
    { name: 'description', content: 'Current GPU-forward cash obligations, bilateral net settlement and operational next actions.' },
    { property: 'og:title', content: 'Operations Overview — CDP Clear' },
    { property: 'og:description', content: 'State-driven post-trade totals and settlement lifecycle for simulated GPU compute forwards.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: Overview,
});
function Overview() {
  const { trades, instruction, history, reset } = useStore();
  const r = netObligations(trades);
  const status = settledSnapshot(trades, history) ? 'Reconciled' : instruction?.obligationSnapshot === obligationSnapshot(trades) ? instruction.status : instruction ? 'Changed obligations · new instruction required' : 'Uninstructed';
  return <Shell title="Operations Overview" intro="NS-AB-001 / GPU compute forwards / Current browser-local state">
    {!trades.length ? <section className="border-y border-border p-4"><p className="mb-3">No GPU forwards in this netting set.</p><Button variant="outline" onClick={reset}>Restore sample forwards</Button></section> : !r.ok ? <section className="border-y border-border p-4"><p role="alert" className="mb-3 text-destructive">{r.error}</p><Button asChild variant="outline"><Link to="/">Review obligations</Link></Button></section> : <>
      <section className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">{[['Gross derivative cash obligations', fmt(r.gross,r.currency)], ['Net settlement amount', fmt(r.net,r.currency)], ['Payment reduction', `${fmt(r.reduction,r.currency)} (${r.gross ? (100*r.reduction/r.gross).toFixed(1) : '0.0'}%)`]].map(([label,value]) => <div key={label}><div className="text-xs text-muted-foreground">{label}</div><p className="mt-2 font-mono text-xl">{value}</p></div>)}</section>
      <section className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-4"><div><p className="font-mono">{r.payer ? `CP-${r.payer} → CP-${r.payee}` : 'Fully offset · no payment required'}</p><p className="mt-2 text-xs text-muted-foreground">Settlement status <Tag tone={status === 'Reconciled' ? 'success' : 'primary'}>{status}</Tag></p></div><Button asChild><Link to={r.net > 0 ? '/settlement' : '/'}>{r.net > 0 ? 'Review settlement' : 'Review obligations'}</Link></Button></section>
      <p className="text-xs text-muted-foreground">{trades.length} GPU forwards · Simulated benchmark fixings · Contractual USD obligations are separate from the illustrative 1:1 testnet USDC cash leg.</p>
    </>}
  </Shell>;
}