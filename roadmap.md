# Phase 4 retrospective reconciliation
- [x] Add separate persistent TEST-SETTLEMENT-001 with saved Phase 3 evidence or explicit operator entry.
- [x] Independently verify all paginated operations, exact fields and allocation; retain actual results and audit times.
- [x] Test persistence, mismatch and read-only flows; preserve payments, balances and simulated netting.

Phase 4 validation: 105 tests pass. Browser reconciled a genuine pre-existing public 1 USDC Testnet payment through live SDK Horizon reads, retained result on reload, independently verified again and rejected a deliberately mismatched recipient. No Horizon POST requests or browser errors occurred. This public payment was used only in temporary browser checks, never seeded in the application and is not claimed as the user's payment. User-specific verification still requires their hash and expected public addresses, or saved Phase 3 references. Original confirmation timestamp and later reconciliation timestamp are separately displayed. Existing simulated netting remains 3100 gross / 1500 net / 51.6% reduction.

# Phase 3 separate Testnet payment
- [x] Add fixed 1.0000000 USDC payment review, fresh prerequisites and Freighter signing.
- [x] Implement exact signed Testnet submission, independent success verification and balance refresh without reconciling obligations.
- [x] Test safeguards and browser states; document real-extension verification limitations.
- [ ] Verify real Freighter approval and a successful live payment (requires the user's funded Testnet wallet/extension).

Phase 3 validation: 87 tests pass; latest build OK. Browser prepared a real classic SDK USDC transaction using live Horizon accounts, issuer and fee data, with emulated public wallet access only. Signature rejection showed no success/hash/explorer link and no payment was signed or submitted. Valid signed-XDR submission, matching confirmation and refresh are fixture-tested. Fees use current estimates capped at 0.01 XLM; network base fees above the cap fail closed. Separate payment never changes simulated obligations, instruction lifecycle or reconciliation; Phase 4 is not implemented.

# Phase 2 wallet balances and asset validation
- [x] Share the live Freighter connection across the header and Settlement.
- [x] Query exact-issuer Testnet balances, reserves, liabilities and beneficiary authorisation.
- [x] Add compact settlement funding checks and test missing prerequisites; keep execution disabled.
- [x] Verify live public-account reads and browser states using an emulated Freighter connection with real Horizon balances.
- [ ] Verify with a real Freighter extension (requires the user's browser extension; sandbox cannot install it).

Phase 2 validation: official Circle contract-address documentation confirms the exact Stellar Testnet issuer on 2026-10-25. All 74 tests pass; build OK. Browser checked real public-account balances (2.9999900 XLM / 0.0100000 USDC), beneficiary authorisation and insufficient funding for the 1500 USDC proposal. Disconnect clears balances, mobile has no document overflow, and no page errors occurred. Only wallet access was emulated; balances were live SDK Horizon reads. Payment execution remains disabled; no successful payment or real extension connection is claimed.

# Phase 1 wallet connection
- [x] Freighter connect/disconnect in header, Testnet-only guard, no persistence.
- [ ] Real Freighter connection check on published site (needs the user's browser extension).

# CDP Clear functional workflow
- [x] Upgrade Overview cash exposure, counterparty flows and settlement next actions.
- [x] Add isolated GPU-price scenarios and calculation tests.
- [x] Verify edited figures, scenario isolation and compact layout.

Risk overview checks: base 3100 gross / 1500 net / 1600 reduction (51.6%); +10% hypothetical shock yields 2200 net CP-B to CP-A and 3640 gross. Slider leaves persisted trades unchanged. Edited T-001 quantity 500 updates booked net to 500 and persists after reload. No page errors or document overflow at 800/390 pixels. Funding coverage remains Not available; no wallet balance queried. Previously verified network evidence is distinguished from local reconciliation and never applied to stale snapshots.
- [x] Add state-driven operations Overview without moving existing URLs.
- [x] Derive GPU-forward cash obligations from editable economics; preserve saved edits and dates.
- [x] Clarify manual testnet settlement and prevent duplicate allocation.
- [x] Link truthful operational activity with lifecycle and evidence.
- [x] Test economics, persistence, settlement safeguards and end-to-end navigation.

Functional validation: 40 tests pass. Browser flow checked 3100 gross / 1500 net / 1600 reduction (51.6%), GPU quantity/fixing/strike/long-party edits, persisted recalculation, local validation, netting calculation, live issuer validation, manual Lab instructions, missing-hash Exception and no fabricated network events. All five pages have no horizontal overflow at 800 and 390 pixels; no page errors. Real successful testnet payment remains unprovided; positive matching and duplicate protections are fixture-tested. Fixings and USD/USDC conversion are simulated; signing, submission and testnet funding require an external wallet or Stellar mentor.

# Previous presentation redesign
- [x] Apply requested palette, slim shell and four compact navigation tabs.
- [x] Simplify obligations toolbar/blotter and expandable metadata; preserve fresh samples and manual edits.
- [x] Compact netting and add expandable provenance with actionable eligibility errors.
- [x] Make settlement register left / selected details and verification right.
- [x] Add truthful browser-local chronological activity without changing financial or verification rules.
- [x] Test regressions, navigation, persistence and laptop/mobile layouts.

Browser checks: fresh 2000/800/300 samples; 1500 net B→A; edited amount persisted on reload; ineligible trade rejected with a direct affected-trade link; live testnet issuer validation; missing hash yields Exception with no explorer link or network-confirmation event. No overflow at 1440, 800 and 390 pixels; no page errors. A real successful payment was not supplied; matching verification remains covered by controlled test fixtures.