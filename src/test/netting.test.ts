import { describe, expect, it } from "vitest";
import { netObligations, SAMPLE_OBLIGATIONS } from "@/lib/netting";
import { amountsMatch } from "@/lib/stellar";

describe("bilateral netting", () => {
  it("sample trades net to B owes A USD 1,500", () => {
    const r = netObligations(SAMPLE_OBLIGATIONS);
    expect(r.gross).toBe(3100);
    expect(r.net).toBe(1500);
    expect(r.payer).toBe("B");
    expect(r.payee).toBe("A");
  });
  it("refuses mixed currencies", () => {
    const r = netObligations([...SAMPLE_OBLIGATIONS, { id: "x", receiver: "A", amount: 1, currency: "EUR" }]);
    expect(r.ok).toBe(false);
  });
  it("stellar amount must match exactly", () => {
    expect(amountsMatch("1500.0000000", 1500)).toBe(true);
    expect(amountsMatch("1499.9900000", 1500)).toBe(false);
  });
});
