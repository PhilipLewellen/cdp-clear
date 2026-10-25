import { useRef, useState } from 'react';
import { useH100 } from '@/hooks/use-h100';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/ui/button';
import { H100MarketPanel } from '@/components/H100MarketPanel';
import { ScaledSettlementCalc, ScaledSettlementPayment, ScaledSettlementVerify } from '@/components/ScaledSettlement';
import { useStore } from '@/lib/use-store';
import { deriveObligation, fmt, netObligations } from '@/lib/netting';
import { marketScenario } from '@/lib/h100';

const labels = ['Calculate', 'Net', 'Settle', 'Verify'] as const;
const purpose = [
  'Indicative cash exposures use the latest available published H100 rental reference, not an authorised contractual settlement fixing.',
  'Indicative bilateral netting offsets opposing market-valued exposures; settlement remains a separately confirmed illustrative calculation.',
  'Settle the scaled net obligation with a real USDC payment on Stellar Testnet — nothing is sent without your explicit review and approval.',
  'Independently verify the confirmed blockchain payment against the exact settlement instruction.',
] as const;

export function DemoWorkflow() {
  const { trades, scaledInstruction } = useStore();
  const [step, setStep] = useState(0);
  const market = useH100();
  const heading = useRef<HTMLHeadingElement>(null);
  const booked = netObligations(trades);
  const referencePrice = market.observation?.value;
  const valuation = referencePrice !== undefined ? marketScenario(trades, referencePrice) : null;
  const shown = referencePrice !== undefined && valuation?.ok
    ? trades.map(t => t.economics ? deriveObligation({ ...t, economics: { ...t.economics, fixing: referencePrice } }) : t)
    : [];
  const r = valuation ?? { ...netObligations([]), ok: false, error: market.loading ? 'Loading indicative market valuation…' : 'Indicative market valuation unavailable. No fallback calculation is shown.' };
  const direction = r.payer ? `CP-${r.payer} → CP-${r.payee}` : 'Fully offset · no payment needed';
  const reconciled = scaledInstruction?.status === 'Reconciled';
  const changeStep = (next: number) => { setStep(next); requestAnimationFrame(() => heading.current?.focus()); };
  const nextLabel = ['Review Netting', scaledInstruction ? 'Continue to Settlement' : 'Next: Settle', 'Next: Verify'][step];
  return <Shell title="From derivatives exposure to verified settlement." intro="Calculate GPU compute derivative obligations, reduce payments through bilateral netting, and settle in USDC on Stellar.">
    <ol className="demo-steps" aria-label="Demo steps">{labels.map((label, index) => <li key={label}><Button variant={index === step ? 'default' : 'ghost'} aria-current={index === step ? 'step' : undefined} data-complete={index < step || undefined} onClick={() => changeStep(index)}>{index < step ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <span className="font-mono">{index + 1}.</span>}{label}</Button></li>)}</ol>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
      <h2 ref={heading} tabIndex={-1} className="demo-step-title">{step + 1}. {labels[step]}</h2>
      <span className="text-xs text-muted-foreground">Step {step + 1} of 4 · {step < 2 ? 'Indicative Market Valuation' : 'Live Stellar Testnet · no real funds'}</span>
    </div>
    <p className="pt-4 text-sm text-muted-foreground">{purpose[step]}</p>

    <section hidden={step !== 0} aria-label="Calculate contracts" className="demo-panel">
      <h3 className="mb-3 text-sm font-semibold">Indicative Market Valuation</h3>
      <H100MarketPanel market={market} />
      {!r.ok && <p role="status" className="mb-4 text-sm text-muted-foreground">{r.error}</p>}
      <div className="demo-contracts">{shown.map(t => <article key={t.id} className="rounded border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><h3 className="font-mono">{t.id}</h3><span className="text-xs text-muted-foreground">GPU compute forward</span></div>
        <p className="mt-4 font-mono text-xl text-primary">{Number.isFinite(t.amount) ? fmt(t.amount, t.currency) : 'Invalid economics'}</p>
        <p className="mt-2 text-sm">{t.amount === 0 ? 'No cash payment' : `CP-${t.receiver === 'A' ? 'B' : 'A'} pays CP-${t.receiver}`}</p>
        {t.economics && <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs"><dt className="text-muted-foreground">GPU-hours</dt><dd className="text-right font-mono">{t.economics.quantity.toLocaleString('en-US')}</dd><dt className="text-muted-foreground">Agreed forward price</dt><dd className="text-right font-mono">{fmt(t.economics.strike, t.currency)}</dd><dt className="text-muted-foreground">Published H100 reference</dt><dd className="text-right font-mono">{t.economics.fixing.toFixed(4)} USD</dd></dl>}
        <details className="mt-4"><summary>Advanced Details</summary><p className="mt-3 text-xs text-muted-foreground">{t.economics ? `Long CP-${t.economics.longParty} payoff = GPU-hours × (published H100 reference − agreed forward price). ` : ''}Value date {t.settlementDate ?? 'Not specified'} · {t.eligible === false ? 'Ineligible' : 'Eligible'} · {t.lifecycle ?? 'Captured'}</p></details>
      </article>)}</div>
      <details className="mt-5 border-t border-border pt-4"><summary>Original Illustrative Example</summary>
        <p className="mt-3 text-xs text-muted-foreground">Booked simulated fixings remain unchanged. {booked.ok ? `${fmt(booked.gross, booked.currency)} gross / ${fmt(booked.net, booked.currency)} net · CP-${booked.payer} → CP-${booked.payee}` : booked.error}</p>
        <div className="mt-3 grid gap-2 text-xs">{trades.map(t => <p key={t.id} className="font-mono">{t.id} · {fmt(t.amount, t.currency)} · CP-{t.receiver === 'A' ? 'B' : 'A'} → CP-{t.receiver} · simulated fixing {t.economics ? fmt(t.economics.fixing, t.currency) : 'unavailable'}</p>)}</div>
      </details>
      {!trades.length && <p className="mt-4 text-warning">No contracts saved. Add obligations in the original workspace; existing records have not been reset.</p>}
      <Button asChild variant="outline" className="mt-5"><Link to="/obligations">Review or edit obligations</Link></Button>
    </section>

    <section hidden={step !== 1} aria-label="Net payment flows" className="demo-panel">
      <h3 className="mb-3 text-sm font-semibold">Indicative Market Valuation</h3>
      <H100MarketPanel market={market} />
      {!r.ok ? <p role="status" className="text-destructive">{r.error}</p> : <>
        <div className="demo-net-flow"><div><p className="text-xs text-muted-foreground">{trades.length} gross cash obligations</p><p className="mt-2 font-mono text-3xl">{fmt(r.gross, r.currency)}</p></div><ArrowRight className="size-6 text-muted-foreground" aria-hidden="true"/><div><p className="text-xs text-muted-foreground">{r.net > 0 ? 'One net obligation' : 'No net obligation'}</p><p className="mt-2 font-mono text-3xl text-primary">{fmt(r.net, r.currency)}</p><p className="mt-2 font-mono">{direction}</p></div></div>
        <p className="mt-2 text-sm">{trades.length} payments reduced to {r.net > 0 ? 'one' : 'zero'} · {direction}</p>
        <figure className="mt-5 rounded border border-border bg-card p-4" aria-label="Opposing cash flows offset">
          <figcaption className="mb-3 text-xs text-muted-foreground">Opposing cash flows offset</figcaption>
          <div className="grid gap-3 text-xs">
            <div><p className="flex justify-between gap-3"><span>CP-B → CP-A</span><span className="font-mono">{fmt(r.aReceives, r.currency)}</span></p><progress className="cash-bar gross mt-1" max={Math.max(r.aReceives, r.bReceives, 1)} value={r.aReceives} aria-label="Payable to CP-A" /></div>
            <div><p className="flex justify-between gap-3"><span>CP-A → CP-B</span><span className="font-mono">{fmt(r.bReceives, r.currency)}</span></p><progress className="cash-bar gross mt-1" max={Math.max(r.aReceives, r.bReceives, 1)} value={r.bReceives} aria-label="Payable to CP-B" /></div>
          </div>
        </figure>
        <div className="mt-6 border-y border-border py-5"><p className="font-mono text-2xl text-success">{r.gross ? (r.reduction / r.gross * 100).toFixed(1) : '0.0'}% reduction</p><p className="mt-2 text-sm text-muted-foreground">{fmt(r.reduction, r.currency)} less in gross payment flows. Indicative market exposures, not authorised settlement amounts or a blockchain payment.</p></div>
        <details className="mt-5"><summary>Advanced Details · calculation and eligibility</summary><p className="mt-3 font-mono">{fmt(r.aReceives, r.currency)} payable to CP-A − {fmt(r.bReceives, r.currency)} payable to CP-B</p><p className="mt-3 text-xs text-muted-foreground">Assumes the same counterparties, currency, settlement cycle, eligible obligations and an enforceable netting agreement. No novation or CCP guarantee.</p></details>

      </>}
      <details className="mt-5 border-t border-border pt-4"><summary>Original Illustrative Example · settlement calculation</summary>
        <p className="mt-3 text-xs text-muted-foreground">Settlement uses the selected booked simulated fixings, not the changing H100 reference. Confirm this separate calculation before generating an immutable instruction.</p>
        <ScaledSettlementCalc requireConfirmation />
      </details>
      <Button asChild variant="outline" className="mt-5"><Link to="/netting">Full netting analysis</Link></Button>
    </section>

    <section hidden={step !== 2} aria-label="Settle scaled obligation" className="demo-panel">
      <ScaledSettlementPayment onViewVerified={() => changeStep(3)} />
    </section>

    <section hidden={step !== 3} aria-label="Verify settlement" className="demo-panel">
      <ScaledSettlementVerify />
      <div className="mt-5 flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/activity">Full audit log</Link></Button><Button asChild variant="outline"><Link to="/settlement">Advanced settlement operations</Link></Button></div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><Button variant="outline" disabled={step === 0} onClick={() => changeStep(step - 1)}><ArrowLeft className="size-4"/>Back</Button>{step < 3 ? <Button onClick={() => changeStep(step + 1)}>{nextLabel}<ArrowRight className="size-4"/></Button> : reconciled ? <Button asChild><Link to="/activity">View Audit Trail<ArrowRight className="size-4"/></Link></Button> : <Button asChild><Link to="/overview">Open Overview<ArrowRight className="size-4"/></Link></Button>}</div>
  </Shell>;
}
