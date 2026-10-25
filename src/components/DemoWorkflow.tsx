import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/ui/button';
import { TestSettlementPayment } from '@/components/TestSettlementPayment';
import { TestSettlementReconciliation } from '@/components/TestSettlementReconciliation';
import { WalletSettlementAsset } from '@/components/WalletSettlementAsset';
import { useStore } from '@/lib/use-store';
import { fmt, netObligations } from '@/lib/netting';
import { DEFAULT_ISSUER } from '@/lib/stellar';

export function DemoWorkflow() {
  const { trades, testSettlement } = useStore();
  const [step, setStep] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const r = netObligations(trades);
  const result = testSettlement?.result;
  const confirmed = result?.checks.confirmed === true && Boolean(result.confirmedAt);
  const direction = r.payer ? `CP-${r.payer} → CP-${r.payee}` : 'Fully offset · no payment needed';
  const labels = ['Calculate', 'Net', 'Settle', 'Verify'];
  const changeStep = (next: number) => { setStep(next); requestAnimationFrame(() => heading.current?.focus()); };
  return <Shell title="Demo Workflow" intro="GPU compute forwards → bilateral payment netting → separate Testnet payment → on-chain verification">
    <ol className="demo-steps" aria-label="Demo steps">{labels.map((label, index) => <li key={label}><Button variant={index === step ? 'default' : 'ghost'} aria-current={index === step ? 'step' : undefined} onClick={() => changeStep(index)}><span className="font-mono">{index + 1}.</span>{label}</Button></li>)}</ol>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
      <h2 ref={heading} tabIndex={-1} className="demo-step-title">{step + 1}. {labels[step]}</h2>
      <span className="text-xs text-muted-foreground">Step {step + 1} of 4 · {step < 2 ? 'Simulated contract economics' : 'Live Stellar Testnet · no real funds'}</span>
    </div>
    <section hidden={step !== 0} aria-label="Calculate contracts" className="demo-panel">
      <p className="mb-5 text-sm">GPU compute forward contracts create cash payments between CP-A and CP-B when the simulated fixing differs from the agreed strike price.</p>
      <div className="demo-contracts">{trades.map(t => <article key={t.id} className="rounded border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><h3 className="font-mono">{t.id}</h3><span className="text-xs text-muted-foreground">GPU compute forward</span></div>
        <p className="mt-4 font-mono text-xl text-primary">{Number.isFinite(t.amount) ? fmt(t.amount, t.currency) : 'Invalid economics'}</p>
        <p className="mt-2 text-sm">{t.amount === 0 ? 'No cash payment' : `CP-${t.receiver === 'A' ? 'B' : 'A'} pays CP-${t.receiver}`}</p>
        {t.economics && <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs"><dt className="text-muted-foreground">GPU-hours</dt><dd className="text-right font-mono">{t.economics.quantity.toLocaleString('en-US')}</dd><dt className="text-muted-foreground">Strike / hour</dt><dd className="text-right font-mono">{fmt(t.economics.strike, t.currency)}</dd><dt className="text-muted-foreground">Simulated fixing</dt><dd className="text-right font-mono">{fmt(t.economics.fixing, t.currency)}</dd></dl>}
        <details className="mt-4"><summary>Advanced Details</summary><p className="mt-3 text-xs text-muted-foreground">{t.economics ? `Long CP-${t.economics.longParty} payoff = GPU-hours × (simulated fixing − strike). ` : ''}Value date {t.settlementDate ?? 'Not specified'} · {t.eligible === false ? 'Ineligible' : 'Eligible'} · {t.lifecycle ?? 'Captured'}</p></details>
      </article>)}</div>
      {!trades.length && <p className="text-warning">No contracts saved. Add obligations in the original workspace; existing records have not been reset.</p>}
      <Button asChild variant="outline" className="mt-5"><Link to="/">Review or edit obligations</Link></Button>
    </section>
    <section hidden={step !== 1} aria-label="Net payment flows" className="demo-panel">
      <p className="mb-5 text-sm">Bilateral payment netting offsets what each counterparty owes, leaving only the difference to pay.</p>
      {!r.ok ? <p role="alert" className="text-destructive">{r.error}</p> : <>
        <div className="demo-net-flow"><div><p className="text-xs text-muted-foreground">{trades.length} gross cash obligations</p><p className="mt-2 font-mono text-3xl">{fmt(r.gross, r.currency)}</p></div><ArrowRight className="size-6 text-muted-foreground" aria-hidden="true"/><div><p className="text-xs text-muted-foreground">{r.net > 0 ? 'One net obligation' : 'No net obligation'}</p><p className="mt-2 font-mono text-3xl text-primary">{fmt(r.net, r.currency)}</p><p className="mt-2 font-mono">{direction}</p></div></div>
        <div className="mt-6 border-y border-border py-5"><p className="font-mono text-2xl text-success">{r.gross ? (r.reduction / r.gross * 100).toFixed(1) : '0.0'}% reduction</p><p className="mt-2 text-sm text-muted-foreground">{fmt(r.reduction, r.currency)} less in gross payment flows. Illustrative contractual amounts, not a blockchain payment.</p></div>
        <details className="mt-5"><summary>Advanced Details · calculation and eligibility</summary><p className="mt-3 font-mono">{fmt(r.aReceives, r.currency)} payable to CP-A − {fmt(r.bReceives, r.currency)} payable to CP-B</p><p className="mt-3 text-xs text-muted-foreground">Assumes the same counterparties, currency, settlement cycle, eligible obligations and an enforceable netting agreement. No novation or CCP guarantee.</p></details>
      </>}
      <Button asChild variant="outline" className="mt-5"><Link to="/netting">Full netting analysis</Link></Button>
    </section>
    <section hidden={step !== 2} aria-label="Separate test settlement" className="demo-panel">
      <p className="mb-5 text-sm">The net obligation is illustrative; the separate 1 USDC payment demonstrates a real transfer of valueless tokens on Stellar Testnet.</p>
      <div className="grid gap-5 sm:grid-cols-2"><div className="border-l-2 border-border pl-4"><p className="text-xs text-muted-foreground">Illustrative derivative obligation</p><p className="mt-2 font-mono text-2xl">{r.ok ? fmt(r.net, r.currency) : 'Netting unavailable'}</p><p className="mt-2 text-xs text-muted-foreground">{r.ok ? direction : r.error} · Not discharged by this test</p></div><div className="border-l-2 border-primary pl-4"><p className="text-xs text-muted-foreground">Separate Stellar Testnet payment</p><p className="mt-2 font-mono text-2xl text-primary">1.0000000 USDC</p><p className={`mt-2 text-sm ${confirmed ? 'text-success' : 'text-warning'}`}>{confirmed ? 'Blockchain confirmation verified' : testSettlement?.hash ? 'Existing transaction available · verify in step 4' : 'No existing transaction associated'}</p></div></div>
      {testSettlement?.hash && <div className="mt-5 border-y border-border py-4"><p className="text-sm">Use the existing transaction — no new payment required.</p><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{testSettlement.hash}</p>{confirmed && <><p className="mt-2 text-xs">Ledger {result?.ledger ?? 'Not recorded'} · Confirmed {result?.confirmedAt}</p><a href={`https://stellar.expert/explorer/testnet/tx/${testSettlement.hash}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">Inspect verified transaction ↗</a></>}</div>}
      <details className="mt-5"><summary>Advanced Details · live wallet balances</summary><WalletSettlementAsset amount={1} source={testSettlement?.source ?? ''} beneficiary={testSettlement?.destination ?? ''} issuer={DEFAULT_ISSUER} refreshVersion={refresh}/></details>
      <details className="mt-5"><summary>Optional · make a new 1 USDC Testnet payment</summary><TestSettlementPayment guided onSuccess={() => setRefresh(value => value + 1)} /></details>
      <p className="mt-4 text-xs text-muted-foreground">Freighter connection is shared with the header. Existing payment references and reconciliation records are retained.</p>
    </section>
    <section hidden={step !== 3} aria-label="Verify existing payment" className="demo-panel">
      <p className="mb-5 text-sm">Reconciliation checks the actual blockchain payment against the expected sender, recipient, exact amount and USDC issuer — without sending another payment.</p>
      <TestSettlementReconciliation guided />
      {result?.status === 'Reconciled' && <p className="mt-5 flex items-start gap-2 text-sm text-success"><CheckCircle2 className="size-4 shrink-0"/>Existing 1 USDC payment matched. The illustrative derivative obligation remains separate.</p>}
      <div className="mt-5 flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/activity">Full audit log</Link></Button><Button asChild variant="outline"><Link to="/settlement">Advanced settlement operations</Link></Button></div>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><Button variant="outline" disabled={step === 0} onClick={() => changeStep(step - 1)}><ArrowLeft className="size-4"/>Back</Button>{step < 3 ? <Button onClick={() => changeStep(step + 1)}>Next: {labels[step + 1]}<ArrowRight className="size-4"/></Button> : <Button asChild><Link to="/overview">Open Overview<ArrowRight className="size-4"/></Link></Button>}</div>
  </Shell>;
}