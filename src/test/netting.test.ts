import { describe, expect, it } from "vitest";
import { netObligations, SAMPLE_OBLIGATIONS } from "@/lib/netting";
import { amountsMatch } from "@/lib/stellar";

describe("bilateral netting", () => {
  it("sample trades net to B owes A USD 1,500", () => {
    const r = netObligations(SAMPLE_OBLIGATIONS);
    expect(r.gross).toBe(3100);
    expect(r.net).toBe(1500);
    expect(r.aReceives).toBe(2300);
    expect(r.bReceives).toBe(800);
    expect(r.reduction).toBe(1600);
    expect(((r.reduction / r.gross) * 100).toFixed(1)).toBe('51.6');
    expect(r.payer).toBe("B");
    expect(r.payee).toBe("A");
  });
  it("refuses mixed currencies", () => {
    const r = netObligations([...SAMPLE_OBLIGATIONS, { id: "x", receiver: "A", amount: 1, currency: "EUR" }]);
    expect(r.ok).toBe(false);
  });
  it('reverses the net payment direction', () => {
    const r = netObligations(SAMPLE_OBLIGATIONS.map(o => ({ ...o, receiver: o.receiver === 'A' ? 'B' : 'A' })));
    expect(r.payer).toBe('A'); expect(r.payee).toBe('B'); expect(r.net).toBe(1500);
  });
  it('zero balance requires no net payment', () => {
    const r = netObligations([{ id: 'a', receiver: 'A', amount: 800, currency: 'USD' }, { id: 'b', receiver: 'B', amount: 800, currency: 'USD' }]);
    expect(r.net).toBe(0); expect(r.payer).toBeNull(); expect(r.payee).toBeNull();
  });
  it('rejects unmatched settlement dates', () => {
    expect(netObligations(SAMPLE_OBLIGATIONS.map((o, i) => ({ ...o, settlementDate: i === 0 ? '2026-10-27' : '2026-10-26' }))).ok).toBe(false);
  });
  it('rejects ineligible obligations', () => {
    expect(netObligations(SAMPLE_OBLIGATIONS.map(o => ({ ...o, eligible: false }))).ok).toBe(false);
  });
  it("stellar amount must match exactly", () => {
    expect(amountsMatch("1500.0000000", 1500)).toBe(true);
    expect(amountsMatch("1499.9900000", 1500)).toBe(false);
  });
});
