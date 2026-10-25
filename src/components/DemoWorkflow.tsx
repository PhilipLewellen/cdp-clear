import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Button } from '@/components/ui/button';
import { TestSettlementPayment } from '@/components/TestSettlementPayment';
import { TestSettlementReconciliation } from '@/components/TestSettlementReconciliation';
import { WalletSettlementAsset } from '@/components/WalletSettlementAsset';
import { H100MarketPanel } from '@/components/H100MarketPanel';
import { ScaledSettlementCalc, ScaledSettlementPayment, ScaledSettlementVerify } from '@/components/ScaledSettlement';
import { useStore } from '@/lib/use-store';
import { deriveObligation, fmt, netObligations } from '@/lib/netting';
import { marketScenario } from '@/lib/h100';
import { DEFAULT_ISSUER } from '@/lib/stellar';

const labels = ['Calculate', 'Net', 'Settle', 'Verify'] as const;
const purpose = [
  'Three GPU compute forward contracts between CP-A and CP-B. Each creates a cash obligation when the simulated market fixing differs from the agreed forward price.',
  'Bilateral payment netting offsets what each counterparty owes, so only the difference needs to be paid.',
  'Settle the scaled net obligation with a real USDC payment on Stellar Testnet — nothing is sent without your explicit review and approval.',
  'Independently verify the confirmed blockchain payment against the exact settlement instruction.',
] as const;

export function DemoWorkflow() {
  const { trades, testSettlement, scaledInstruction } = useStore();
  const [step, setStep] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [scenarioFixing, setScenarioFixing] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const r = netObligations(trades);
  const scenario = scenarioFixing === null ? null : marketScenario(trades, scenarioFixing);
  const scenarioMode = Boolean(scenario?.ok);
  const shown = scenarioMode
    ? trades.map(t => t.economics ? deriveObligation({ ...t, economics: { ...t.economics, fixing: scenarioFixing as number } }) : t)
    : trades;
  const shownNet = scenarioMode ? scenario : r;
  const result = testSettlement?.result;
  const confirmed = result?.checks.confirmed === true && Boolean(result.confirmedAt);
  const direction = r.payer ? `CP-${r.payer} → CP-${r.payee}` : 'Fully offset · no payment needed';
  const shownDirection = shownNet?.payer ? `CP-${shownNet.payer} → CP-${shownNet.payee}` : 'Fully offset · no payment needed';
  const reconciled = scaledInstruction?.status === 'Reconciled';
  const changeStep = (next: number) => { setStep(next); requestAnimationFrame(() => heading.current?.focus()); };
  const nextLabel = ['Review Netting', scaledInstruction ? 'Continue to Settlement' : 'Next: Settle', 'Next: Verify'][step];
  return <Shell title="Demo Workflow" intro="GPU compute forwards → bilateral payment netting → scaled Testnet settlement → on-chain verification">
    <ol className="demo-steps" aria-label="Demo steps">{labels.map((label, index) => <li key={label}><Button variant={index === step ? 'default' : 'ghost'} aria-current={index === step ? 'step' : undefined} data-complete={index < step || undefined} onClick={() => changeStep(index)}>{index < step ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <span className="font-mono">{index + 1}.</span>}{label}</Button></li>)}</ol>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
      <h2 ref={heading} tabIndex={-1} className="demo-step-title">{step + 1}. {labels[step]}</h2>
      <span className="text-xs text-muted-foreground">Step {step + 1} of 4 · {step < 2 ? 'Simulated contract economics' : 'Live Stellar Testnet · no real funds'}</span>
    </div>
    <p className="pt-4 text-sm text-muted-foreground">{purpose[step]}</p>

    <section hidden={step !== 0} aria-label="Calculate contracts" className="demo-panel">
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Calculation mode">
        <Button variant={scenarioMode ? 'ghost' : 'default'} onClick={() => setScenarioFixing(null)}>Original Demo</Button>
        <Button variant={scenarioMode ? 'default' : 'ghost'} disabled={!scenarioMode} onClick={() => {}}>Market Data Scenario</Button>
        {scenarioMode && <span className="text-xs text-muted-foreground">Common H100 fixing {fmt(scenarioFixing as number, 'USD')} / GPU-hour</span>}
      </div>
      {scenarioMode && <p className="mb-5 rounded border border-primary bg-card p-3 text-sm text-primary">Indicative scenario using published H100 rental pricing — not a contractual settlement fixing. Booked contracts and settlement records are unchanged.</p>}
      <div className="demo-contracts">{shown.map(t => <article key={t.id} className="rounded border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><h3 className="font-mono">{t.id}</h3><span className="text-xs text-muted-foreground">GPU compute forward</span></div>
        <p className="mt-4 font-mono text-xl text-primary">{Number.isFinite(t.amount) ? fmt(t.amount, t.currency) : 'Invalid economics'}</p>
        <p className="mt-2 text-sm">{t.amount === 0 ? 'No cash payment' : `CP-${t.receiver === 'A' ? 'B' : 'A'} pays CP-${t.receiver}`}</p>
        {t.economics && <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs"><dt className="text-muted-foreground">GPU-hours</dt><dd className="text-right font-mono">{t.economics.quantity.toLocaleString('en-US')}</dd><dt className="text-muted-foreground">Agreed forward price</dt><dd className="text-right font-mono">{fmt(t.economics.strike, t.currency)}</dd><dt className="text-muted-foreground">{scenarioMode ? 'H100 scenario fixing' : 'Market fixing (simulated)'}</dt><dd className="text-right font-mono">{fmt(t.economics.fixing, t.currency)}</dd></dl>}
        <details className="mt-4"><summary>Advanced Details</summary><p className="mt-3 text-xs text-muted-foreground">{t.economics ? `Long CP-${t.economics.longParty} payoff = GPU-hours × (${scenarioMode ? 'H100 scenario fixing' : 'simulated fixing'} − agreed forward price). ` : ''}Value date {t.settlementDate ?? 'Not specified'} · {t.eligible === false ? 'Ineligible' : 'Eligible'} · {t.lifecycle ?? 'Captured'}</p></details>
      </article>)}</div>
      {scenarioMode && scenario && r.ok && <div className="mt-6 rounded border border-border bg-card p-4" aria-label="Scenario comparison">
        <p className="text-sm font-semibold">Net settlement comparison</p>
        <div className="mt-4 grid gap-3 text-xs">
          <div><p className="flex justify-between"><span className="text-muted-foreground">Original demo net · {direction}</span><span className="font-mono">{fmt(r.net, r.currency)}</span></p><progress className="cash-bar gross mt-1" max={Math.max(r.net, scenario.net, 1)} value={r.net}/></div>
          <div><p className="flex justify-between"><span className="text-muted-foreground">Market scenario net · {shownDirection}</span><span className="font-mono">{fmt(scenario.net, scenario.currency)}</span></p><progress className="cash-bar mt-1" max={Math.max(r.net, scenario.net, 1)} value={scenario.net}/></div>
          <p className="border-t border-border pt-3">Difference <span className="font-mono">{fmt(Math.abs(scenario.net - r.net), r.currency)}</span> {scenario.net === r.net ? '· unchanged' : scenario.net > r.net ? 'higher' : 'lower'}{scenario.payer !== r.payer ? ' · payment direction reversed' : ''}</p>
        </div>
      </div>}
      <div className="mt-6 border-t border-border pt-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Explore Market Prices · optional</p>
        <H100MarketPanel onScenario={setScenarioFixing} scenarioActive={scenarioMode} />
      </div>
      {!trades.length && <p className="mt-4 text-warning">No contracts saved. Add obligations in the original workspace; existing records have not been reset.</p>}
      <Button asChild variant="outline" className="mt-5"><Link to="/obligations">Review or edit obligations</Link></Button>
    </section>

    <section hidden={step !== 1} aria-label="Net payment flows" className="demo-panel">
      {!r.ok ? <p role="alert" className="text-destructive">{r.error}</p> : <>
        <div className="demo-net-flow"><div><p className="text-xs text-muted-foreground">{trades.length} gross cash obligations</p><p className="mt-2 font-mono text-3xl">{fmt(r.gross, r.currency)}</p></div><ArrowRight className="size-6 text-muted-foreground" aria-hidden="true"/><div><p className="text-xs text-muted-foreground">{r.net > 0 ? 'One net obligation' : 'No net obligation'}</p><p className="mt-2 font-mono text-3xl text-primary">{fmt(r.net, r.currency)}</p><p className="mt-2 font-mono">{direction}</p></div></div>
        <p className="mt-2 text-sm">{trades.length} payments reduced to {r.net > 0 ? 'one' : 'zero'} · {direction}</p>
        <div className="mt-6 border-y border-border py-5"><p className="font-mono text-2xl text-success">{r.gross ? (r.reduction / r.gross * 100).toFixed(1) : '0.0'}% reduction</p><p className="mt-2 text-sm text-muted-foreground">{fmt(r.reduction, r.currency)} less in gross payment flows. Illustrative contractual amounts, not a blockchain payment.</p></div>
        <details className="mt-5"><summary>Advanced Details · calculation and eligibility</summary><p className="mt-3 font-mono">{fmt(r.aReceives, r.currency)} payable to CP-A − {fmt(r.bReceives, r.currency)} payable to CP-B</p><p className="mt-3 text-xs text-muted-foreground">Assumes the same counterparties, currency, settlement cycle, eligible obligations and an enforceable netting agreement. No novation or CCP guarantee.</p></details>
        <ScaledSettlementCalc />
      </>}
      <Button asChild variant="outline" className="mt-5"><Link to="/netting">Full netting analysis</Link></Button>
    </section>

    <section hidden={step !== 2} aria-label="Settle scaled obligation" className="demo-panel">
      <ScaledSettlementPayment onSuccess={() => setRefresh(value => value + 1)} onViewVerified={() => changeStep(3)} />
      <details className="mt-8 border-t border-border pt-5"><summary>Advanced Settlement Tools · historical 1 USDC demonstration</summary>
        <p className="mb-5 mt-4 text-sm">Historical demonstration: the separate 1 USDC payment below is unrelated to the scaled instruction and demonstrates a real transfer of valueless tokens on Stellar Testnet.</p>
        <div className="grid gap-5 sm:grid-cols-2"><div className="border-l-2 border-border pl-4"><p className="text-xs text-muted-foreground">Illustrative derivative obligation</p><p className="mt-2 font-mono text-2xl">{r.ok ? fmt(r.net, r.currency) : 'Netting unavailable'}</p><p className="mt-2 text-xs text-muted-foreground">{r.ok ? direction : r.error} · Not discharged by this test</p></div><div className="border-l-2 border-primary pl-4"><p className="text-xs text-muted-foreground">Separate Stellar Testnet payment</p><p className="mt-2 font-mono text-2xl text-primary">1.0000000 USDC</p><p className={`mt-2 text-sm ${confirmed ? 'text-success' : 'text-warning'}`}>{confirmed ? 'Blockchain confirmation verified' : testSettlement?.hash ? 'Existing transaction available · verify in step 4' : 'No existing transaction associated'}</p></div></div>
        {testSettlement?.hash && <div className="mt-5 border-y border-border py-4"><p className="text-sm">Use the existing transaction — no new payment required.</p><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{testSettlement.hash}</p>{confirmed && <><p className="mt-2 text-xs">Ledger {result?.ledger ?? 'Not recorded'} · Confirmed {result?.confirmedAt}</p><a href={`https://stellar.expert/explorer/testnet/tx/${testSettlement.hash}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">Inspect verified transaction ↗</a></>}</div>}
        <details className="mt-5"><summary>Live wallet balances</summary><WalletSettlementAsset amount={1} source={testSettlement?.source ?? ''} beneficiary={testSettlement?.destination ?? ''} issuer={DEFAULT_ISSUER} refreshVersion={refresh}/></details>
        <details className="mt-5"><summary>Make a new 1 USDC Testnet payment</summary><TestSettlementPayment guided onSuccess={() => setRefresh(value => value + 1)} /></details>
        <p className="mt-4 text-xs text-muted-foreground">Freighter connection is shared with the header. Existing payment references and reconciliation records are retained.</p>
      </details>
    </section>

    <section hidden={step !== 3} aria-label="Verify settlement" className="demo-panel">
      <ScaledSettlementVerify />
      <details className="mt-8 border-t border-border pt-5"><summary>Advanced Verification · historical 1 USDC record</summary>
        <p className="mb-5 mt-4 text-sm">Historical record: reconciliation below checks the separate 1 USDC payment against its expected sender, recipient, exact amount and USDC issuer — without sending another payment.</p>
        <TestSettlementReconciliation guided />
        {result?.status === 'Reconciled' && <p className="mt-5 flex items-start gap-2 text-sm text-success"><CheckCircle2 className="size-4 shrink-0"/>Existing 1 USDC payment matched. The illustrative derivative obligation remains separate.</p>}
      </details>
      <div className="mt-5 flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/activity">Full audit log</Link></Button><Button asChild variant="outline"><Link to="/settlement">Advanced settlement operations</Link></Button></div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><Button variant="outline" disabled={step === 0} onClick={() => changeStep(step - 1)}><ArrowLeft className="size-4"/>Back</Button>{step < 3 ? <Button onClick={() => changeStep(step + 1)}>{nextLabel}<ArrowRight className="size-4"/></Button> : reconciled ? <Button asChild><Link to="/activity">View Audit Trail<ArrowRight className="size-4"/></Link></Button> : <Button asChild><Link to="/overview">Open Overview<ArrowRight className="size-4"/></Link></Button>}</div>
  </Shell>;
}
