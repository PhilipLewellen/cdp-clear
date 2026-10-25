import { createFileRoute } from '@tanstack/react-router';
import { DemoWorkflow } from '@/components/DemoWorkflow';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'CDP Clear — Calculate, Net, Settle, Verify' },
    { name: 'description', content: 'Calculate, net and settle AI compute derivatives using USDC on Stellar. Guided bilateral payment netting and genuine Stellar Testnet reconciliation.' },
    { property: 'og:title', content: 'CDP Clear — Calculate, Net, Settle, Verify' },
    { property: 'og:description', content: 'Calculate, net and settle AI compute derivatives using USDC on Stellar.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: DemoWorkflow,
});
