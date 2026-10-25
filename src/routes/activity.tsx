import { createFileRoute, Link } from '@tanstack/react-router';
import { Shell, Tag } from '@/components/Shell';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/use-store';

export const Route = createFileRoute('/activity')({
  head: () => ({ meta: [
    { title: 'Operational Activity | CDP Clear' },
    { name: 'description', content: 'Browser-local demo actions and independently verified Stellar Testnet evidence.' },
    { property: 'og:title', content: 'Operational Activity | CDP Clear' },
    { property: 'og:description', content: 'Chronological post-trade operations and verified testnet evidence; no fabricated payments.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Activity,
});

function Activity() {
  const { activity } = useStore();
  const referenceLink = (reference: string) => reference.startsWith('T-') ? <Button asChild variant="ghost" className="!h-auto px-0 font-mono text-xs"><Link to="/obligations" hash={reference}>{reference}</Link></Button> : <Button asChild variant="ghost" className="!h-auto px-0 font-mono text-xs"><Link to={reference.startsWith('SI-') || reference.startsWith('TEST-SETTLEMENT-') ? '/settlement' : '/netting'}>{reference}</Link></Button>;
  return <Shell title="Activity" intro="Chronological register / browser-local operations and network evidence">
    <section className="border-y border-border bg-card">
      <div className="border-b border-border p-4 text-sm">{activity.length} recorded events <span className="ml-4 text-xs text-muted-foreground">Latest first</span></div>
      {activity.length ? <div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Recorded at (UTC)</th><th>Event</th><th>Reference</th><th>Lifecycle</th><th>Evidence</th><th>Details</th></tr></thead><tbody>{[...activity].reverse().map(event => <tr key={event.id}><td className="font-mono">{event.at.replace('T', ' ').slice(0, 19)}</td><td>{event.action}</td><td>{referenceLink(event.reference)}</td><td>{event.lifecycle ?? 'Local operation'}</td><td><Tag tone={event.category === 'Network evidence' ? 'success' : 'muted'}>{event.category}</Tag></td><td className="max-w-96 !whitespace-normal break-all text-muted-foreground">{event.detail}</td></tr>)}</tbody></table></div> : <div className="p-6"><p className="mb-4 text-sm text-muted-foreground">No operations recorded yet.</p><Button asChild variant="outline"><Link to="/obligations">Open obligations</Link></Button></div>}
    </section>
  </Shell>;
}