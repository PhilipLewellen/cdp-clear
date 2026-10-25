import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFreighter } from '@/hooks/use-freighter';
import { inputCls } from '@/lib/ui-classes';
import { fundingChecks, loadWalletBalances, USDC_ASSET, type WalletBalances } from '@/lib/wallet-balances';

export function WalletSettlementAsset({ amount, source, beneficiary, issuer, onBeneficiaryChange, onUsePayer }: {
  amount: number; source: string; beneficiary: string; issuer: string;
  onBeneficiaryChange?: (address: string) => void; onUsePayer?: (address: string) => void;
}) {
  const wallet = useFreighter();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: WalletBalances; error?: string } | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const connectionCheck = useRef(wallet.checkConnection);
  connectionCheck.current = wallet.checkConnection;
  const address = wallet.status === 'connected' ? wallet.address : undefined;
  const key = JSON.stringify([address, beneficiary, refresh]);
  useEffect(() => {
    let cancelled = false;
    if (!address) return;
    setLoadingKey(key);
    setResult(null);
    async function read() {
      try {
        const connectedAddress = await connectionCheck.current();
        if (connectedAddress !== address) throw new Error('Wallet changed. Refresh balances.');
        const data = await loadWalletBalances(connectedAddress, beneficiary.trim());
        await connectionCheck.current();
        if (!cancelled) setResult({ key, data });
      } catch (error) {
        if (!cancelled) setResult({ key, error: error instanceof Error ? error.message : 'Testnet balances unavailable.' });
      } finally { if (!cancelled) setLoadingKey(null); }
    }
    void read();
    return () => { cancelled = true; };
  }, [address, beneficiary, key]);
  useEffect(() => {
    if (!address) return;
    const update = () => setRefresh(value => value + 1);
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, [address]);
  const active = address && result?.key === key ? result : null;
  const data = active?.data;
  const loading = Boolean(address && (!active || loadingKey === key));
  const reasons = data ? fundingChecks(data, amount, source || address || '', beneficiary.trim(), issuer) : [];
  const funding = !address ? 'Not checked · connect a Testnet wallet' : loading ? 'Checking Testnet…' : active?.error ? 'Unavailable · retry lookup' : data && reasons.length === 0 ? 'Balance prerequisites met at lookup · execution disabled' : 'Prerequisites missing';
  const trustlineStatus = data?.beneficiary ? !data.beneficiary.trustline ? 'Missing exact USDC trustline' : data.beneficiary.authorised ? 'Exact trustline · authorised to receive' : 'Exact trustline · not authorised to receive' : data?.beneficiaryError ?? 'Not checked';
  return <section className="settlement-section" aria-label="Wallet & Settlement Asset">
    <div className="module-heading"><h2>Wallet & Settlement Asset</h2><Button aria-label="Refresh Testnet balances" title="Refresh Testnet balances" variant="ghost" size="sm" disabled={!address || loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw className="size-3.5" /></Button></div>
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-2.5 text-xs">
      <dt className="text-muted-foreground">Connected payer wallet</dt><dd className="min-w-0 break-all font-mono">{address ?? 'Not connected'}</dd>
      <dt className="text-muted-foreground">Testnet XLM balance</dt><dd className="font-mono">{data?.payer ? `${data.payer.xlm} XLM` : 'Not available'}</dd>
      <dt className="text-muted-foreground">XLM available before fees</dt><dd className="font-mono">{data?.payer ? `${data.payer.availableXlm} XLM` : 'Not available'}</dd>
      <dt className="text-muted-foreground">Testnet USDC balance</dt><dd className="font-mono">{data?.payer?.usdc !== null && data?.payer?.usdc !== undefined ? `${data.payer.usdc} USDC` : data?.payer ? 'Exact trustline missing' : 'Not available'}</dd>
      <dt className="text-muted-foreground">Spendable Testnet USDC</dt><dd className="font-mono">{data?.payer?.spendableUsdc !== null && data?.payer?.spendableUsdc !== undefined ? `${data.payer.spendableUsdc} USDC` : 'Not available'}</dd>
      <dt className="text-muted-foreground">Proposed settlement</dt><dd className="font-mono">{Number.isFinite(amount) ? amount.toFixed(7) : '—'} USDC</dd>
      <dt className="text-muted-foreground">Asset issuer</dt><dd className="min-w-0 break-all font-mono">{USDC_ASSET.issuer}</dd>
    </dl>
    {address && onUsePayer && <Button variant="outline" size="sm" className="mt-3" onClick={() => onUsePayer(address)}>Use connected payer wallet</Button>}
    <label className="mt-4 block text-[10px] text-muted-foreground"><span className="mb-1.5 block">Beneficiary public address</span><input aria-label="Balance check beneficiary public address" className={inputCls} placeholder="G… public Stellar Testnet address" value={beneficiary} readOnly={!onBeneficiaryChange} onChange={event => {
      const value = event.target.value.trim();
      if (value.startsWith('S')) { setInputError('Secret keys are not accepted. Enter a public G-address only.'); return; }
      setInputError(null); onBeneficiaryChange?.(value);
    }} /></label>
    {inputError && <p role="alert" className="mt-2 text-xs text-destructive">{inputError}</p>}
    <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3 text-xs"><dt className="text-muted-foreground">Beneficiary USDC trustline</dt><dd>{trustlineStatus}</dd><dt className="text-muted-foreground">Funding status</dt><dd role="status" className={data && !reasons.length ? 'text-success' : 'text-warning'}>{funding}</dd></dl>
    {active?.error && <p role="alert" className="mt-3 text-xs text-destructive">{active.error}</p>}
    {reasons.length > 0 && <ul role="alert" className="mt-3 list-disc space-y-1 pl-4 text-xs text-warning">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
    {data && <p className="mt-3 text-[10px] text-muted-foreground">Horizon Testnet lookup · {new Date(data.checkedAt).toLocaleString()} · XLM reserve {data.payer?.reserveXlm ?? '—'} · single-payment base fee {data.feeXlm} XLM. Available balances account for liabilities; fees may rise and balances may change.</p>}
    <p className="mt-3 text-[10px] text-muted-foreground"><a href="https://developers.circle.com/stablecoins/usdc-contract-addresses" target="_blank" rel="noreferrer" className="text-primary underline">Circle-documented Stellar Testnet USDC</a> · issuer checked against official documentation on 25 Oct 2026. Test tokens have no financial value or USD backing. Read-only checks; no signing or payment execution.</p>
  </section>;
}