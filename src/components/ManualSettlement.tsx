import { Button } from '@/components/ui/button';
import type { Instruction } from '@/lib/settlement';

export function ManualSettlement({ instruction }: { instruction: Instruction }) {
  return <details className="mt-4 border-y border-border py-3" open={instruction.status === 'Pending Authorisation'}><summary>Manual Stellar Lab testnet payment</summary>
    <ol className="mt-3 list-decimal space-y-3 pl-5 text-xs">
      <li>Open Stellar Lab and select <b>Testnet</b>, never Mainnet. Use separate testnet accounts for CP-{instruction.payer} and CP-{instruction.beneficiary}; fund transaction fees with test XLM via Friendbot.</li>
      <li>Both accounts need a USDC trustline to the exact issuer below. Obtain enough test USDC from the issuer’s testnet faucet; Friendbot supplies XLM, not USDC. Ask a Stellar mentor if asset funding is unavailable.</li>
      <li>Build a Payment operation from <span className="break-all font-mono">{instruction.source}</span> to <span className="break-all font-mono">{instruction.destination}</span>, using asset <b>USDC</b>, issuer <span className="break-all font-mono">{instruction.assetIssuer}</span>, and exactly <b>{instruction.amount.toFixed(2)} USDC</b>. Do not send XLM or a different issuer’s token.</li>
      <li>Review, authorise, sign and submit outside CDP Clear using a testnet wallet or Stellar mentor. Never paste a secret key into CDP Clear; this app cannot sign or send.</li>
      <li>Copy the successful transaction’s genuine 64-character hash, paste it below, verify the network transaction, then reconcile. A supplied hash alone is not evidence of settlement.</li>
    </ol>
    <Button asChild variant="outline" className="mt-3"><a href="https://lab.stellar.org" target="_blank" rel="noreferrer">Open Stellar Lab ↗</a></Button>
  </details>;
}