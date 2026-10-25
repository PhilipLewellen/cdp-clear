import { useCallback, useState } from "react";
import { STELLAR_CONFIG, checkWalletNetwork } from "@/lib/stellar-config";

export type WalletStatus = "disconnected" | "loading" | "connected" | "wrong-network" | "error";
export interface WalletState { status: WalletStatus; address?: string; network?: string; error?: string; }

type ApiError = { message?: string } | string | undefined;
const errText = (e: ApiError, fallback: string) => (typeof e === "string" ? e : e?.message) || fallback;

// Freighter is loaded only in the browser, after a user action. No keys are ever handled here.
const freighter = () => import("@stellar/freighter-api");

export function useFreighter() {
  // Always start disconnected: a reload never displays a stale connection.
  const [state, setState] = useState<WalletState>({ status: "disconnected" });

  const connect = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const api = await freighter();
      const conn = await api.isConnected();
      if (conn.error) return setState({ status: "error", error: errText(conn.error, "Could not reach Freighter.") });
      if (!conn.isConnected) return setState({ status: "error", error: "Freighter extension not detected. Install it from freighter.app and reload." });
      const access = await api.requestAccess();
      if (access.error) return setState({ status: "error", error: errText(access.error, "Wallet access was declined.") });
      const addr = await api.getAddress();
      if (addr.error || !addr.address) return setState({ status: "error", error: errText(addr.error, "No public address returned by Freighter.") });
      const net = await api.getNetwork();
      if (net.error) return setState({ status: "error", error: errText(net.error, "Could not read Freighter network.") });
      const check = checkWalletNetwork(net.network, net.networkPassphrase);
      if (!check.ok) return setState({ status: "wrong-network", address: addr.address, network: net.network, error: check.message });
      setState({ status: "connected", address: addr.address, network: STELLAR_CONFIG.label });
    } catch (e) {
      setState({ status: "error", error: e instanceof Error ? e.message : "Wallet connection failed." });
    }
  }, []);

  const disconnect = useCallback(() => setState({ status: "disconnected" }), []);

  // Reserved for later phases; refuses unless connected on Testnet.
  const signTransaction = useCallback(async (xdr: string) => {
    if (state.status !== "connected" || !state.address) throw new Error("Connect Freighter on Stellar Testnet first.");
    const api = await freighter();
    const res = await api.signTransaction(xdr, { networkPassphrase: STELLAR_CONFIG.networkPassphrase, address: state.address });
    if (res.error) throw new Error(errText(res.error, "Signing was rejected."));
    return res.signedTxXdr;
  }, [state.status, state.address]);

  return { ...state, connect, disconnect, signTransaction };
}
