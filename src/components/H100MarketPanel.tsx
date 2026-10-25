import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isStale, H100_METHODOLOGY_URL, H100_SOURCE_URL } from '@/lib/h100';
import type { useH100 } from '@/hooks/use-h100';

const pct = (value: number | null) => value === null ? 'Not published' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;

export function H100MarketPanel({ market }: { market: ReturnType<typeof useH100> }) {
  const { observation, cached, loading, error, refresh } = market;
  const stale = observation ? isStale(observation) : false;
  return <section aria-label="H100 market reference" className="mb-5 border-b border-border pb-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">Published H100 Reference</h3>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'motion-safe:animate-spin' : ''}`}/>{loading ? 'Fetching…' : 'Refresh Price'}</Button>
      </div>
    </div>
    {loading && <p role="status" className="mt-3 text-xs text-muted-foreground">Fetching latest published H100 reference…{observation ? ' Showing the last retrieved observation while refreshing.' : ''}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">Latest market data unavailable: {error} {observation ? 'Valuation uses the last retrieved observation, not a freshly verified price.' : 'No indicative valuation or fallback price is used.'}</p>}
    {observation && <dl className="mt-4 grid grid-cols-[130px_minmax(0,1fr)] gap-x-6 gap-y-2 text-xs sm:grid-cols-[130px_minmax(0,1fr)_130px_minmax(0,1fr)]">
      <dt className="text-muted-foreground">H100 index value</dt><dd className="font-mono text-sm text-primary">{observation.value.toFixed(4)} USD / GPU-hour</dd>
      <dt className="text-muted-foreground">Status</dt><dd>{observation.final ? 'Final' : 'Provisional'}{cached ? ' · Cached / last retrieved' : ''}{stale ? ' · Older than 24 hours' : ''}</dd>
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
