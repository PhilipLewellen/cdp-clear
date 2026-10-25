import { createFileRoute } from '@tanstack/react-router';
import { DemoWorkflow } from '@/components/DemoWorkflow';

// /demo renders the same guided workflow as the homepage.
export const Route = createFileRoute('/demo')({
  head: () => ({ meta: [
    { title: 'CDP Clear Demo | Guided Settlement Workflow' },
    { name: 'description', content: 'Guided Calculate, Net, Settle, Verify workflow for GPU compute derivatives settled in USDC on Stellar Testnet.' },
    { property: 'og:title', content: 'CDP Clear Demo | Guided Settlement Workflow' },
    { property: 'og:description', content: 'Guided bilateral netting and Stellar Testnet USDC settlement demo.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: DemoWorkflow,
});
