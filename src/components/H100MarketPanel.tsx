import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cachedH100, fetchH100, isStale, H100_METHODOLOGY_URL, H100_SOURCE_URL, type H100Observation } from '@/lib/h100';

const pct = (value: number | null) => value === null ? 'Not published' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;

export function H100MarketPanel({ onScenario, scenarioActive }: {
  onScenario: (price: number | null) => void;
  scenarioActive: boolean;
}) {
  const [observation, setObservation] = useState<H100Observation | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = cachedH100();
    if (saved) { setObservation(saved); setCached(true); }
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setObservation(await fetchH100());
      setCached(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Market data request failed.');
    } finally {
      setLoading(false);
    }
  };

  const stale = observation ? isStale(observation) : false;
  return <section aria-label="H100 market reference" className="mt-6 rounded border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">H100 Market Reference</h3>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`}/>{loading ? 'Fetching…' : 'Refresh Market Data'}</Button>
        <Button onClick={() => observation && onScenario(observation.value)} disabled={!observation || loading}>Run Market Scenario</Button>
        {scenarioActive && <Button variant="ghost" onClick={() => onScenario(null)}>Reset to Original Demo</Button>}
      </div>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">Market data unavailable: {error} No fallback price is used.</p>}
    {!observation && !error && <p className="mt-3 text-sm text-muted-foreground">No H100 observation loaded. Refresh market data to retrieve the latest published index value.</p>}
    {observation && <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
      <dt className="text-muted-foreground">H100 index value</dt><dd className="font-mono text-sm text-primary">{observation.value.toFixed(4)} USD / GPU-hour</dd>
      <dt className="text-muted-foreground">Status</dt><dd>{observation.final ? 'Final' : 'Provisional'}{cached ? ' · Cached' : ''}{stale ? ' · Older than 24 hours' : ''}</dd>
      <dt className="text-muted-foreground">Benchmark</dt><dd>{observation.benchmark ?? 'Not published'}</dd>
      <dt className="text-muted-foreground">Rental basis</dt><dd>{observation.terms ?? 'Not published'}</dd>
      <dt className="text-muted-foreground">Observation date</dt><dd>{observation.date ?? 'Not published'}</dd>
      <dt className="text-muted-foreground">Last updated</dt><dd>{observation.updated ?? 'Not published'}</dd>
      <dt className="text-muted-foreground">One-day change</dt><dd className="font-mono">{pct(observation.chg1d)}</dd>
      <dt className="text-muted-foreground">Seven-day change</dt><dd className="font-mono">{pct(observation.chg7d)}</dd>
    </dl>}
    {stale && <p className="mt-3 text-xs text-warning">This observation is more than 24 hours old; refresh before relying on it.</p>}
    <details className="mt-4"><summary>Advanced Details · source and methodology</summary>
      <p className="mt-3 text-xs text-muted-foreground">Methodology version {observation?.methodologyVersion ?? 'not retrieved'}. This is a published rental price index — not a real-time exchange price, futures price or regulated settlement benchmark.</p>
      <p className="mt-2 text-xs">Data: <a href={H100_SOURCE_URL} target="_blank" rel="noreferrer" className="text-primary underline">Compute Screener (computescreener.com)</a>, CC BY 4.0 · <a href={H100_METHODOLOGY_URL} target="_blank" rel="noreferrer" className="text-primary underline">Methodology ↗</a></p>
    </details>
  </section>;
}
