import { Networks } from "@stellar/stellar-sdk";

// Testnet only. Mainnet is never a supported network for this demo.
export const STELLAR_CONFIG = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  network: "TESTNET",
  label: "Stellar Testnet",
} as const;

export type NetworkCheck = { ok: true } | { ok: false; mainnet: boolean; message: string };

export function checkWalletNetwork(network: string, passphrase: string): NetworkCheck {
  if (passphrase === STELLAR_CONFIG.networkPassphrase) return { ok: true };
  const mainnet = passphrase === Networks.PUBLIC || network.toUpperCase() === "PUBLIC";
  return { ok: false, mainnet, message: mainnet ? "Freighter is on Mainnet. Switch Freighter to Testnet to continue." : `Freighter is on ${network || "an unknown network"}. Switch Freighter to Testnet to continue.` };
}

export const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
