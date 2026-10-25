import { createFileRoute } from '@tanstack/react-router';
import { DemoWorkflow } from '@/components/DemoWorkflow';

export const Route = createFileRoute('/demo')({
  head: () => ({ meta: [
    { title: 'Demo Workflow — CDP Clear' },
    { name: 'description', content: 'Calculate GPU-forward obligations, net bilateral cash flows, demonstrate a separate USDC Testnet payment and verify existing blockchain evidence.' },
    { property: 'og:title', content: 'Demo Workflow — CDP Clear' },
    { property: 'og:description', content: 'Calculate, Net, Settle and Verify: guided bilateral payment netting and genuine Stellar Testnet reconciliation.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: DemoWorkflow,
});