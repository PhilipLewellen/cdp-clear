import { Button } from '@/components/ui/button';
import { inputCls } from '@/lib/ui-classes';
import { deriveObligation, fmt, forwardPayoff, netObligations, type ForwardEconomics, type Obligation, type Party } from '@/lib/netting';

export function TradeEconomics({ trade, onChange, onValidated }: { trade: Obligation; onChange: (trade: Obligation) => void; onValidated: () => void }) {
  const e = trade.economics;
  if (!e) return null;
  const edit = (patch: Partial<ForwardEconomics>) => onChange(deriveObligation({ ...trade, lifecycle: 'Captured', economics: { ...e, ...patch } }));
  const valid = netObligations([{ ...trade, eligible: true }]).ok;
  return <details><summary>GPU forward details</summary><div className="my-3 grid min-w-72 gap-3 whitespace-normal sm:grid-cols-2">
    <span className="text-xs text-muted-foreground sm:col-span-2">{e.instrument} · Benchmark fixing: simulated, not market data</span>
    <label className="text-xs">Long counterparty<select aria-label={`${trade.id} long counterparty`} className={inputCls + ' mt-1 w-full'} value={e.longParty} onChange={event => edit({ longParty: event.target.value as Party })}><option value="A">CP-A versus CP-B</option><option value="B">CP-B versus CP-A</option></select></label>
    {(['quantity', 'strike', 'fixing'] as const).map(key => <label key={key} className="text-xs">{key === 'quantity' ? 'GPU-hours' : key === 'strike' ? 'Strike · USD/GPU-hour' : 'Simulated fixing · USD/GPU-hour'}<input aria-label={`${trade.id} ${key}`} type="number" min={key === 'quantity' ? '0.01' : '0'} step="0.01" className={inputCls + ' mt-1 w-full'} value={Number.isFinite(e[key]) ? e[key] : ''} onChange={event => edit({ [key]: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>)}
    <p className="text-xs font-mono sm:col-span-2">Long payoff: {e.quantity} × ({e.fixing} − {e.strike}) = {fmt(forwardPayoff(e))}</p>
    <p className="text-xs sm:col-span-2">{trade.amount === 0 ? 'Zero payoff · no cash payment' : `CP-${trade.receiver === 'A' ? 'B' : 'A'} pays CP-${trade.receiver} ${fmt(trade.amount, trade.currency)}`}</p>
    {!valid && <p role="alert" className="text-xs text-destructive sm:col-span-2">Enter a positive quantity and non-negative finite prices.</p>}
    <Button variant="outline" disabled={!valid || trade.lifecycle === 'Validated'} onClick={() => { onChange({ ...trade, lifecycle: 'Validated' }); onValidated(); }}>Validate trade</Button>
  </div></details>;
}