import { useEffect, useRef, useState } from 'react';
import { Copy, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/use-store';
import { checkSnapshotIntegrity, type Integrity } from '@/lib/financial-snapshot';
import { exportSettlementEvidence, refreshSettlementEvidence } from '@/lib/settlement-evidence';

export function SettlementEvidence() {
  const { scaledInstruction: instruction, setScaledInstruction } = useStore();
  const current = useRef(instruction);
  current.current = instruction;
  const [integrity, setIntegrity] = useState<Integrity>('Integrity verification unavailable');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void checkSnapshotIntegrity(instruction?.financialSnapshot, instruction?.financialFingerprint).then(result => { if (active) setIntegrity(result); });
    return () => { active = false; };
  }, [instruction?.financialSnapshot, instruction?.financialFingerprint]);
  if (!instruction) return null;
  const verify = async () => {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      setIntegrity(await checkSnapshotIntegrity(instruction.financialSnapshot, instruction.financialFingerprint));
      const paymentVerification = await refreshSettlementEvidence(instruction);
      if (current.current === instruction) setScaledInstruction({ ...instruction, paymentVerification });
    } finally { setBusy(false); }
  };
  const download = async () => {
    try {
      const evidence = await exportSettlementEvidence(instruction);
      const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2) + '\n'], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `${instruction.id}-settlement-evidence.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Settlement evidence exported.');
    } catch { setNotice('Evidence export unavailable. Please try again.'); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(instruction.financialFingerprint ?? ''); setNotice('Fingerprint copied.'); }
    catch { setNotice('Copy unavailable. Select the fingerprint to copy it.'); }
  };
  const verification = instruction.paymentVerification;
  return <section className="mt-5 border-t border-border pt-4" aria-label="Settlement Evidence">
    <h3 className="text-sm font-medium">Settlement Evidence</h3>
    <dl className="mt-3 grid grid-cols-[minmax(100px,150px)_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-muted-foreground">Instruction</dt><dd className="font-mono">{instruction.id}</dd>
      <dt className="text-muted-foreground">Financial snapshot</dt><dd>{instruction.financialSnapshot ? 'Original snapshot saved' : 'Historical snapshot unavailable'}</dd>
      <dt className="text-muted-foreground">SHA-256 fingerprint</dt><dd className="break-all font-mono">{instruction.financialFingerprint ? `${instruction.financialFingerprint.slice(0, 12)}…${instruction.financialFingerprint.slice(-12)}` : 'Unavailable'}</dd>
      <dt className="text-muted-foreground">Snapshot integrity</dt><dd role={integrity.startsWith('Warning') ? 'alert' : undefined} className={integrity.startsWith('Warning') ? 'text-destructive' : 'text-muted-foreground'}>{integrity}</dd>
      <dt className="text-muted-foreground">Stellar payment</dt><dd className={verification?.ok ? 'text-success' : 'text-warning'}>{verification?.ok && verification.payment ? 'Verified — matching payment operation' : verification ? (verification.confirmed ? 'Confirmed transaction — payment mismatch' : 'Unverified') : 'Evidence not yet retrieved — verify again'}</dd>
      <dt className="text-muted-foreground">Matched transaction</dt><dd className="break-all font-mono">{verification?.payment?.transactionHash ?? 'Unavailable'}</dd>
      <dt className="text-muted-foreground">Latest verification</dt><dd>{verification?.verifiedAt ?? 'Unavailable'}</dd>
    </dl>
    {verification && !verification.ok && <p className="mt-2 text-xs text-warning">{verification.reasons.join(' ')}</p>}
    <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={verify}><RefreshCw className="size-3.5" />Verify Again</Button><Button variant="outline" disabled={busy} onClick={download}><Download className="size-3.5" />Export Evidence</Button></div>
    {busy && <p role="status" className="mt-2 text-xs">Checking snapshot and Stellar Testnet evidence…</p>}
    {notice && <p role="status" className="mt-2 text-xs">{notice}</p>}
    <details className="mt-3 text-xs"><summary className="cursor-pointer text-muted-foreground">Financial Integrity</summary>
      <p className="mt-2 break-all font-mono">{instruction.financialFingerprint ?? (instruction.financialSnapshot ? 'Fingerprint unavailable' : 'Historical snapshot unavailable')}</p>
      {instruction.financialFingerprint && <Button variant="ghost" className="mt-2" onClick={copy}><Copy className="size-3.5" />Copy fingerprint</Button>}
      <p className="mt-2 text-muted-foreground">Local SHA-256 checks data consistency, not truthfulness or independent timestamping. This is not an on-chain hash or legally binding proof. Addresses unknown at creation remain unavailable in the original snapshot.</p>
      {instruction.financialSnapshot && <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono">{JSON.stringify(instruction.financialSnapshot, null, 2)}</pre>}
    </details>
    <details className="mt-3 text-xs"><summary className="cursor-pointer text-muted-foreground">Blockchain evidence and individual checks</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono">{verification ? JSON.stringify(verification, null, 2) : 'Independently retrieved evidence unavailable.'}</pre></details>
  </section>;
}