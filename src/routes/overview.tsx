import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Shell, Tag } from '@/components/Shell';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useStore } from '@/lib/use-store';
import { fmt, netObligations } from '@/lib/netting';
import { overviewSettlement, signedNet, stressObligations } from '@/lib/risk-overview';

export const Route = createFileRoute('/overview')({
  head: () => ({ meta: [
    { title: 'Risk & Settlement Overview — CDP Clear' },
    { name: 'description', content: 'Booked GPU-forward cash exposure, hypothetical GPU fixing scenarios and evidence-based settlement monitoring.' },
    { property: 'og:title', content: 'Risk & Settlement Overview — CDP Clear' },
    { property: 'og:description', content: 'Bilateral cash flows, isolated GPU-price stress calculations and current testnet settlement evidence.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: Overview,
});
function Overview() {
  const { trades, instruction, history, reset, recordActivity } = useStore();
  const [shock, setShock] = useState(0);
  const r = netObligations(trades);
  const stress = stressObligations(trades, shock);
  const monitor = overviewSettlement(trades, instruction, history);
  const register = new Map(history.map(row => [row.id, row]));
  if (instruction) register.set(instruction.id, instruction);
  const direction = (payer: string | null, payee: string | null) => payer ? `CP-${payer} → CP-${payee}` : 'Fully offset · no payment required';
  const delta = signedNet(stress) - signedNet(r);
  return <Shell title="Risk & Settlement Overview" intro="NS-AB-001 / GPU compute forwards / Browser-local booked state">
    {!trades.length ? <section className="border-y border-border p-4"><p className="mb-3">No GPU forwards in this netting set.</p><Button variant="outline" onClick={reset}>Restore sample forwards</Button></section> : !r.ok ? <section className="border-y border-border p-4"><p role="alert" className="mb-3 text-destructive">{r.error}</p><Button asChild variant="outline"><Link to="/obligations">Review obligations</Link></Button></section> : <>
      <div className="settlement-modules">
        <section className="settlement-module" aria-label="Cash exposure summary">
          <div className="module-heading"><h2>Cash exposure summary</h2><span>BOOKED</span></div>
          <dl className="space-y-3">{[['Aggregate gross obligations', fmt(r.gross,r.currency)], ['Net settlement obligation', fmt(r.net,r.currency)], ['Payer → beneficiary', direction(r.payer,r.payee)], ['Gross payment reduction', `${fmt(r.reduction,r.currency)} / ${r.gross ? (100*r.reduction/r.gross).toFixed(1) : '0.0'}%`], ['Obligations / generated instructions', `${trades.length} / ${register.size}`], ['Net payments required', r.net > 0 ? '1' : '0']].map(([label,value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-mono">{value}</dd></div>)}</dl>
        </section>
        <section className="settlement-module" aria-label="Counterparty cash flow exposure">
          <div className="module-heading"><h2>Counterparty cash flow exposure</h2><span>GROSS PAYABLE</span></div>
          {([['CP-B', r.aReceives], ['CP-A', r.bReceives]] as const).map(([party,amount],i) => <div key={party} className="mb-5"><div className="mb-2 flex justify-between gap-4 text-xs"><span className="text-muted-foreground">{party} payable</span><span className="font-mono">{fmt(amount,r.currency)}</span></div><progress aria-label={`${party} gross payable`} className={`cash-bar ${i ? 'gross' : ''}`} max={Math.max(r.aReceives,r.bReceives,1)} value={amount} /></div>)}
          <p className="border-t border-border pt-3 text-xs font-mono text-primary">Net {direction(r.payer,r.payee)} · {fmt(r.net,r.currency)}</p>
        </section>
        <section className="settlement-module" aria-label="GPU price stress analysis">
          <div className="module-heading"><h2>GPU price stress analysis</h2><span>HYPOTHETICAL</span></div>
          <div className="mb-4 flex items-center justify-between gap-3"><label htmlFor="gpu-shock" className="text-xs text-muted-foreground">Parallel simulated fixing shock</label><output className="font-mono text-primary">{shock > 0 ? '+' : ''}{shock}%</output></div>
          <Slider id="gpu-shock" aria-label="GPU fixing shock" min={-30} max={30} step={5} value={[shock]} onValueChange={values => setShock(values[0] ?? 0)} />
          <div className="mt-2 mb-5 flex justify-between font-mono text-[10px] text-muted-foreground"><span>−30%</span><span>0%</span><span>+30%</span></div>
          {!stress.ok ? <p role="alert" className="text-destructive">{stress.error}</p> : <dl className="space-y-3">{[['Base net obligation', fmt(r.net,r.currency)], ['Stressed net obligation', fmt(stress.net,stress.currency)], ['Net cash change to CP-A', `${delta > 0 ? '+' : ''}${fmt(delta,r.currency)}`], ['Gross stressed obligations', fmt(stress.gross,stress.currency)], ['Stressed payer → beneficiary', direction(stress.payer,stress.payee)]].map(([label,value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-mono">{value}</dd></div>)}</dl>}
          <p className="mt-4 text-[11px] text-muted-foreground">Hypothetical fixing shifts; contract quantities and strikes unchanged. Not booked and not applied to settlement. Signed change is cash receivable by CP-A, including payer reversals.</p>
        </section>
        <section className="settlement-module" aria-label="Settlement risk monitor">
          <div className="module-heading"><h2>Settlement risk monitor</h2><span>TESTNET EVIDENCE</span></div>
          <dl className="space-y-3">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Net amount payable</dt><dd className="text-right font-mono">{fmt(r.net,r.currency)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Instruction lifecycle</dt><dd className="text-right"><Tag tone={monitor.status === 'Reconciled' ? 'success' : 'primary'}>{monitor.status}</Tag></dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Instruction ID</dt><dd className="text-right font-mono break-all">{monitor.current?.id ?? 'Not generated for current obligations'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">On-chain verification</dt><dd className="text-right">{monitor.verified ? monitor.current?.status === 'Reconciled' ? 'Previously verified · matched; reconciled locally' : 'Previously confirmed · payment match requires review' : 'Not verified'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Funding coverage</dt><dd className="text-right">Not available</dd></div>
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground">No verified payer-wallet balance queried for the exact testnet issuer.</p>
          {(monitor.stale || monitor.current?.status === 'Exception' || monitor.current?.status === 'Failed') && <p role="alert" className="mt-4 break-words border-l-2 border-warning pl-3 text-xs text-warning">{monitor.stale ? 'Booked obligations changed; previous instruction evidence does not cover the current netting set.' : monitor.current?.verifiedNote ?? 'Review settlement verification exception.'}</p>}
        </section>
      </div>
      <section className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-4" aria-label="Operations next action"><div><h2>Operations</h2><p className="mt-1 text-xs text-muted-foreground">{monitor.status === 'Reconciled' ? 'Current obligations reconciled · no further payment required' : 'Next action for the current booked netting set'}</p></div><Button asChild><Link to={monitor.action.to} onClick={() => { if (monitor.action.to === '/netting') recordActivity({ category: 'Demo operation', action: 'Netting calculated', reference: 'NS-AB-001', lifecycle: 'Calculated', detail: `${fmt(r.gross,r.currency)} gross / ${fmt(r.net,r.currency)} net · ${direction(r.payer,r.payee)}` }); }}>{monitor.action.label}</Link></Button></section>
      <p className="text-[11px] text-muted-foreground">Exposure totals reflect stored obligations, using simulated benchmark fixings—not live market data. Hypothetical scenarios are separate. USD obligations and illustrative 1:1 testnet USDC remain distinct; no signing or payment sending.</p>
    </>}
  </Shell>;
}
