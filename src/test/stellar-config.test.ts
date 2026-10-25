import { describe, expect, it } from "vitest";
import { STELLAR_CONFIG, checkWalletNetwork, shortAddress } from "@/lib/stellar-config";
import { TESTNET_PASSPHRASE } from "@/lib/stellar";

describe("wallet network guard", () => {
  it("uses Testnet only", () => {
    expect(STELLAR_CONFIG.networkPassphrase).toBe(TESTNET_PASSPHRASE);
    expect(STELLAR_CONFIG.horizonUrl).toBe("https://horizon-testnet.stellar.org");
  });
  it("accepts Testnet", () => expect(checkWalletNetwork("TESTNET", TESTNET_PASSPHRASE).ok).toBe(true));
  it("blocks Mainnet", () => {
    const r = checkWalletNetwork("PUBLIC", "Public Global Stellar Network ; September 2015");
    expect(r.ok).toBe(false); expect(!r.ok && r.mainnet).toBe(true);
  });
  it("blocks Futurenet", () => expect(checkWalletNetwork("FUTURENET", "Test SDF Future Network ; October 2022").ok).toBe(false));
  it("shortens addresses", () => expect(shortAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe("GABC…WXYZ"));
});
