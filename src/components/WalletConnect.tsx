import { Button } from "@/components/ui/button";
import { useFreighter } from "@/hooks/use-freighter";
import { shortAddress } from "@/lib/stellar-config";
import { Wallet } from "lucide-react";

export function WalletConnect() {
  const w = useFreighter();
  if (w.status === "connected" && w.address) return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="font-mono" title={w.address}>{shortAddress(w.address)}</span>
      <span className="text-muted-foreground">Stellar Testnet</span>
      <span className="font-medium text-success">Connected</span>
      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={w.disconnect}>Disconnect</Button>
    </div>
  );
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {w.error && <span role="alert" className="max-w-64 text-warning">{w.error}</span>}
      {w.status === "wrong-network" && <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={w.disconnect}>Dismiss</Button>}
      <Button variant="outline" size="sm" className="h-7 text-[11px]" disabled={w.status === "loading"} onClick={w.connect}>
        <Wallet className="size-3" />{w.status === "loading" ? "Connecting…" : w.status === "wrong-network" ? "Retry on Testnet" : "Connect Wallet"}
      </Button>
    </div>
  );
}
