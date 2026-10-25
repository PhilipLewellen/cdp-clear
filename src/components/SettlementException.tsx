import { useState } from 'react';
import { ArrowLeft, FlaskConical, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inputCls } from '@/lib/ui-classes';
import { ALTERNATIVE_ISSUER, defaultMismatchAmount, fetchPaymentEvidence, hypotheticalFromEvidence, reconcileException, type ExceptionResult, type ExceptionScenario, type PaymentEvidence } from '@/lib/settlement-exception';

const SCENARIOS: { key: ExceptionScenario; label: string; hint: string }[] = [
  { key: 'amount', label: 'Incorrect expected amount', hint: 'The hypothetical instruction expects a different USDC amount than was actually paid.' },
  { key: 'recipient', label: 'Incorrect expected recipient', hint: 'The hypothetical instruction expects a different recipient public address.' },
  { key: 'issuer', label: 'Incorrect expected asset issuer', hint: 'The hypothetical instruction expects a different, clearly identified USDC issuer.' },
];

const G_ADDRESS = /^G[A-Z2-7]{55}$/;
const AMOUNT = /^\d+(\.\d{1,7})?$/;

/**
 * Isolated settlement exception demonstration. All state is component-local: nothing is
 * persisted, no records, instructions, hashes or audit events are modified, and no
 * transaction is generated, signed or submitted.
 */
export function SettlementException({ defaultHash, onClose }: { defaultHash: string; onClose: () => void }) {
  const [hash, setHash] = useState(defaultHash);
  const [evidence, setEvidence] = useState<PaymentEvidence | null>(null);
  const [scenario, setScenario] = useState<ExceptionScenario>('amount');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [expectedRecipient, setExpectedRecipient] = useState('');
  const [result, setResult] = useState<ExceptionResult | null>(null);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const busy = Boolean(phase);

  const load = async () => {
    if (busy) return;
    setPhase('Retrieving transaction from Stellar Testnet…');
    setError('');
    setResult(null);
    try {
      const found = await fetchPaymentEvidence(hash);
      setEvidence(found);
      setExpectedAmount(current => current || defaultMismatchAmount(found.amount));
    } catch (e) {
      setEvidence(null);
      setError(e instanceof Error ? e.message : 'Horizon lookup unavailable.');
    } finally {
      setPhase('');
    }
  };

  const amountValid = AMOUNT.test(expectedAmount) && Number(expectedAmount) > 0;
  const recipientValid = G_ADDRESS.test(expectedRecipient);
  const ready = evidence && (scenario === 'issuer' || (scenario === 'amount' && amountValid) || (scenario === 'recipient' && recipientValid));

  const run = () => {
    if (!evidence || !ready) return;
    setError('');
    setResult(reconcileException(hypotheticalFromEvidence(evidence, scenario, { amount: expectedAmount, recipient: expectedRecipient }), evidence));
  };

  return <section className="settlement-section mt-6" aria-label="Simulated instruction mismatch — real Stellar blockchain data">
    <div className="module-heading"><h2>Simulated instruction mismatch — real Stellar blockchain data</h2><span>Exception test · read-only</span></div>
    <p className="mb-4 text-xs text-muted-foreground">Demonstrates how CDP Clear detects a settlement discrepancy: a real, previously confirmed Stellar Testnet payment is reconciled against a deliberately incorrect hypothetical settlement instruction. The genuine instruction, its Reconciled status, stored hashes and audit events are not modified. No payment is generated, signed or submitted.</p>

    <label className="block text-xs text-muted-foreground">Confirmed Testnet transaction hash
      <input aria-label="Exception test transaction hash" placeholder="64-character hex transaction hash" className={`${inputCls} mt-2 font-mono`} value={hash} disabled={busy} onChange={event => { setHash(event.target.value.trim()); setEvidence(null); setResult(null); setError(''); }} />
    </label>
    <Button variant="outline" className="mt-3" disabled={busy || !/^[0-9a-f]{64}$/i.test(hash)} onClick={load}><RefreshCw className="size-3.5" />Load Transaction</Button>
    {phase && <p role="status" className="mt-3 text-xs text-primary">{phase}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}

    {evidence && <>
      <dl className="mt-5 grid grid-cols-[150px_minmax(0,1fr)] gap-2 border-y border-border py-4 text-xs">
        <dt className="text-muted-foreground">Blockchain result</dt><dd className="text-success">Successful{evidence.ledger ? ` · Ledger ${evidence.ledger}` : ''}</dd>
        <dt className="text-muted-foreground">Actual sender</dt><dd className="break-all font-mono">{evidence.from}</dd>
        <dt className="text-muted-foreground">Actual recipient</dt><dd className="break-all font-mono">{evidence.to}</dd>
        <dt className="text-muted-foreground">Actual amount</dt><dd className="font-mono">{evidence.amount} {evidence.assetCode}</dd>
        <dt className="text-muted-foreground">Actual asset issuer</dt><dd className="break-all font-mono">{evidence.assetIssuer || 'native'}</dd>
        {evidence.createdAt && <><dt className="text-muted-foreground">Confirmed</dt><dd className="font-mono">{evidence.createdAt}</dd></>}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Exception scenario">
        {SCENARIOS.map(option => <Button key={option.key} variant={scenario === option.key ? 'default' : 'ghost'} role="radio" aria-checked={scenario === option.key} onClick={() => { setScenario(option.key); setResult(null); setError(''); }}>{option.label}</Button>)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{SCENARIOS.find(option => option.key === scenario)?.hint}</p>

      {scenario === 'amount' && <label className="mt-3 block text-xs text-muted-foreground">Hypothetical expected amount (USDC)
        <input aria-label="Hypothetical expected amount" className={`${inputCls} mt-2 font-mono`} value={expectedAmount} onChange={event => { setExpectedAmount(event.target.value.trim()); setResult(null); }} />
        {expectedAmount && !amountValid && <span role="alert" className="mt-1 block text-destructive">Enter a positive amount with at most seven decimals.</span>}
      </label>}
      {scenario === 'recipient' && <label className="mt-3 block text-xs text-muted-foreground">Hypothetical expected recipient (public G-address you supply)
        <input aria-label="Hypothetical expected recipient" placeholder="G… public Stellar address" className={`${inputCls} mt-2 font-mono`} value={expectedRecipient} onChange={event => { const value = event.target.value.trim(); if (value.startsWith('S')) { setError('Secret keys are not accepted. Enter a public G-address only.'); return; } setExpectedRecipient(value); setResult(null); setError(''); }} />
        {expectedRecipient && !recipientValid && <span role="alert" className="mt-1 block text-destructive">Enter a valid 56-character public G-address.</span>}
      </label>}
      {scenario === 'issuer' && <p className="mt-3 text-xs text-muted-foreground">Hypothetical expected issuer: <span className="break-all font-mono text-foreground">{ALTERNATIVE_ISSUER}</span> (documented Circle Mainnet USDC issuer, used only as a clearly identified example alternative). The real transaction's asset identity is unchanged and different issuers are never treated as equivalent.</p>}

      <Button className="mt-4" disabled={!ready} onClick={run}><FlaskConical className="size-3.5" />Run Reconciliation Check</Button>
    </>}

    {result && <div className="mt-5" role="group" aria-label="Exception reconciliation result">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-border p-3"><p className="text-xs text-muted-foreground">Blockchain result</p><p className="mt-1 text-sm text-success">Successful</p></div>
        <div className="border border-border p-3"><p className="text-xs text-muted-foreground">Financial reconciliation result</p><p className={`mt-1 text-sm ${result.mismatches.length ? 'text-destructive' : 'text-success'}`}>{result.mismatches.length ? 'Mismatch' : 'Match'}</p></div>
      </div>
      <p className={`mt-4 text-sm font-medium ${result.mismatches.length ? 'text-destructive' : 'text-success'}`}>{result.status}</p>
      <p className="mt-2 text-xs text-muted-foreground">{result.mismatches.length
        ? 'The payment was successfully confirmed on Stellar, but it does not match the expected settlement instruction. The blockchain payment itself is not failed, reversed, missing or unsuccessful.'
        : 'The hypothetical instruction matches the confirmed payment exactly; no exception is raised.'}</p>
      <table className="mt-4 w-full text-xs">
        <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="py-2 pr-3 font-medium">Field</th><th className="py-2 pr-3 font-medium">Expected (hypothetical instruction)</th><th className="py-2 pr-3 font-medium">Actual (blockchain)</th><th className="py-2 font-medium">Result</th></tr></thead>
        <tbody>
          {result.fields.map(field => <tr key={field.key} className="border-b border-border/50">
            <td className="py-2 pr-3">{field.label}</td>
            <td className="break-all py-2 pr-3 font-mono">{field.expected}</td>
            <td className="break-all py-2 pr-3 font-mono">{field.actual}</td>
            <td className={`py-2 ${field.match ? 'text-success' : 'text-destructive'}`}>{field.match ? 'Match' : 'Mismatch'}</td>
          </tr>)}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-muted-foreground">Real transaction (underlying payment was successful):</p>
      <p className="mt-1 break-all font-mono text-xs">{result.evidence.hash}</p>
      <a className="mt-2 inline-block text-xs text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${result.evidence.hash}`} target="_blank" rel="noreferrer">Inspect successful transaction on Stellar Expert ↗</a>
    </div>}

    <div className="mt-6 border-t border-border pt-4">
      <Button variant="outline" onClick={onClose}><ArrowLeft className="size-3.5" />Return to Successful Reconciliation</Button>
    </div>
  </section>;
}
