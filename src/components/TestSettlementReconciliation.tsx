import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/use-store';
import { savedPayment } from '@/lib/payment-evidence';
import { DEFAULT_ISSUER } from '@/lib/stellar';
import { inputCls } from '@/lib/ui-classes';
import { verifyExistingTestPayment, type TestSettlement } from '@/lib/test-reconciliation';

export function TestSettlementReconciliation() {
  const { testSettlement: record, setTestSettlement, history, instruction } = useStore();
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const current = useRef(record);
  current.current = record;
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const associate = () => {
      const value = savedPayment(), previous = current.current;
      if (!previous || previous.hash || !value) return;
      setTestSettlement({ ...previous, ...value, audit: [...previous.audit, { action: 'Existing transaction associated', at: new Date().toISOString(), detail: value.hash }] });
    };
    associate();
    window.addEventListener('cdp-clear-confirmed-payment', associate);
    return () => window.removeEventListener('cdp-clear-confirmed-payment', associate);
  }, [record, setTestSettlement]);
  if (!record) return null;
  const edit = (key: 'source' | 'destination' | 'hash', value: string) => {
    if (key !== 'hash' && value.trim().startsWith('S')) { setNotice('Secret keys are not accepted. Enter public G-addresses only.'); return; }
    setNotice('');
    setTestSettlement({ ...record, [key]: key === 'hash' ? value.trim().toLowerCase() : value.trim(), result: null });
  };
  const verify = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setNotice('');
    let snap: TestSettlement = record;
    const at = new Date().toISOString();
    if (!record.audit.some(event => event.action === 'Existing transaction associated' && event.detail === record.hash)) {
      snap = { ...record, audit: [...record.audit, { action: 'Existing transaction associated', at, detail: record.hash }] };
    }
    setTestSettlement(snap);
    try {
      const allocated = [...history, ...(instruction ? [instruction] : [])].filter(row => row.status === 'Reconciled').map(row => row.txHash);
      const result = await verifyExistingTestPayment(snap, allocated);
      const audit = [...snap.audit];
      if (result.checks.confirmed && result.confirmedAt && !audit.some(event => event.action === 'Transaction confirmed on Stellar' && event.detail === snap.hash)) audit.push({ action: 'Transaction confirmed on Stellar', at: result.confirmedAt, detail: snap.hash });
      audit.push({ action: result.status === 'Reconciled' ? 'Reconciliation completed' : result.status === 'Verification unavailable' ? 'Verification unavailable' : 'Exception detected', at: result.checkedAt, detail: result.status === 'Reconciled' ? `${snap.hash} · Operation ${result.operationId} · Exact 1.0000000 USDC matched` : result.reasons.join(' ') });
      setTestSettlement({ ...snap, result, audit });
    } finally { guard.current = false; setBusy(false); }
  };
  const result = record.result;
  const ready = /^G[A-Z2-7]{55}$/.test(record.source) && /^G[A-Z2-7]{55}$/.test(record.destination) && /^[a-f0-9]{64}$/.test(record.hash);
  return <section className="settlement-section" aria-label="Retrospective test reconciliation">
    <div className="module-heading"><h2>Retrospective test reconciliation</h2><span>Phase 4 · Read-only</span></div>
    <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-muted-foreground">Instruction</dt><dd className="break-all font-mono">{record.id}</dd>
      <dt className="text-muted-foreground">Expected payment</dt><dd className="font-mono">1.0000000 USDC</dd>
      <dt className="text-muted-foreground">Network</dt><dd>Stellar Testnet</dd>
      <dt className="text-muted-foreground">Exact issuer</dt><dd className="break-all font-mono">{DEFAULT_ISSUER}</dd>
    </dl>
    <div className="mt-4 space-y-3">
      <label className="block text-xs text-muted-foreground">Expected sender public address<input aria-label="Expected sender public address" className={`${inputCls} mt-1`} value={record.source} disabled={busy} onChange={event => edit('source', event.target.value)} /></label>
      <label className="block text-xs text-muted-foreground">Expected recipient public address<input aria-label="Expected recipient public address" className={`${inputCls} mt-1`} value={record.destination} disabled={busy} onChange={event => edit('destination', event.target.value)} /></label>
      <label className="block text-xs text-muted-foreground">Existing payment transaction hash<input aria-label="Existing payment transaction hash" className={`${inputCls} mt-1`} value={record.hash} disabled={busy} onChange={event => edit('hash', event.target.value)} /></label>
    </div>
    <div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy || !ready} onClick={verify}><Search className="size-3.5" />{busy ? 'Verifying Stellar…' : 'Reconcile Existing Payment'}</Button>{result && <Button variant="outline" disabled={busy || !ready} onClick={verify}><RefreshCw className="size-3.5" />Verify Again</Button>}</div>
    {notice && <p role="alert" className="mt-3 text-xs text-destructive">{notice}</p>}
    <p role="status" className={`mt-4 text-sm ${result?.status === 'Reconciled' ? 'text-success' : 'text-warning'}`}>{result?.status ?? 'Awaiting verification'}</p>
    {result && <>
      {result.reasons.length > 0 && <p role="alert" className="mt-2 text-xs text-destructive">{result.reasons.join(' ')}</p>}
      <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-xs">{Object.entries({ sender: 'Sender match', recipient: 'Recipient match', amount: 'Amount match', asset: 'Asset and issuer match', confirmed: 'Blockchain transaction confirmed', membership: 'Successful payment in this transaction' }).map(([key, label]) => <div className="contents" key={key}><dt className="text-muted-foreground">{label}</dt><dd>{result.checks[key as keyof typeof result.checks] ? 'Verified' : result.status === 'Verification unavailable' ? 'Unavailable' : 'Not matched'}</dd></div>)}</dl>
      <div className="mt-4 border-y border-border py-3"><h3 className="text-xs font-medium">Actual on-chain payment operations</h3>{result.payments.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No payment data retrieved.</p> : result.payments.map(payment => <dl key={payment.id} className="mt-3 grid grid-cols-[80px_minmax(0,1fr)] gap-2 text-xs"><dt>Operation</dt><dd className="break-all font-mono">{payment.id}</dd><dt>Amount</dt><dd className="break-all font-mono">{payment.amount} {payment.asset_code ?? 'XLM'}</dd><dt>Sender</dt><dd className="break-all font-mono">{payment.from}</dd><dt>Recipient</dt><dd className="break-all font-mono">{payment.to}</dd><dt>Issuer</dt><dd className="break-all font-mono">{payment.asset_issuer ?? 'Native asset'}</dd></dl>)}</div>
      {result.confirmedAt && <div className="mt-3 text-xs"><p>Blockchain confirmation: <span className="font-mono">{result.confirmedAt}</span></p><p className="mt-1">Latest verification: <span className="font-mono">{result.checkedAt}</span></p><p className="mt-2 break-all font-mono">{record.hash}</p><a className="mt-2 inline-block text-primary underline" href={`https://stellar.expert/explorer/testnet/tx/${record.hash}`} target="_blank" rel="noreferrer">Inspect existing transaction on Stellar Expert ↗</a></div>}
    </>}
    <details className="mt-4 text-xs" open={Boolean(result)}><summary className="cursor-pointer text-muted-foreground">Test settlement audit trail · {record.audit.length} events</summary><ol className="mt-3 space-y-3">{record.audit.map((event, index) => <li key={index}><p>{event.action}</p><p className="mt-1 font-mono text-muted-foreground">{event.at}</p><p className="mt-1 break-all text-muted-foreground">{event.detail}</p></li>)}</ol></details>
    <p className="mt-4 text-[10px] text-muted-foreground">Separate technical demonstration. No new payment or signature. Does not settle the illustrative $1,500 net obligation or legally discharge any compute derivatives contract. Browser-local allocation register.</p>
  </section>;
}