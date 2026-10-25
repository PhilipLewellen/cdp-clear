# Institutional product UX refinement
- [x] Homepage opens the guided workflow (/ renders DemoWorkflow; Obligations moved to /obligations; /demo redirects to /; all routes preserved).
- [x] One settlement lifecycle mapped from real instruction states: Not created / Ready for review / Awaiting wallet approval / Submitted / verifying / Reconciled / Exception / Verification unavailable, shown on the Settle card.
- [x] Net step shows explicit scaled panel: original net, demo scale, scaled net, expected testnet USDC payment.
- [x] Settle card shows source netting result and wallet readiness; review-before-signing preserved.
- [x] One-sentence product explanation on the opening screen.
- [x] Tests and browser validation.

# Hackathon UX excellence pass
- [x] Demo Workflow as primary experience: one step at a time, checkmarked progress indicator, per-step purpose sentence and primary action (Review Netting / Generate Settlement Instruction / state-driven settle action / View Audit Trail).
- [x] Step 1 compact contract cards (ID, GPU-hours, agreed forward price, simulated fixing, obligation+payer); formulas in Advanced Details; H100 as optional "Explore Market Prices".
- [x] Step 2 prominent gross→net, reduction, "3 payments reduced to one"; scaled settlement secondary with concise rationale; "Continue to Settlement" after generation.
- [x] Step 3 single settlement card with state-driven primary action (Connect Wallet / Review Payment / Approve in Freighter / View Confirmed Payment); historical 1 USDC payment moved to Advanced Settlement Tools.
- [x] Step 4 "Settlement Reconciled" hero (expected vs actual, sender/recipient, asset/issuer, hash, confirmation time, explorer link); exception test and historical reconciliation as advanced sections.
- [x] Navigation: Demo Workflow primary tab, Operations group for the five other routes; confirmation before Reset demo data.
- [x] Tests and browser validation.

UX pass validation: 157 tests pass (2 new reset-confirmation tests); typecheck clean. Browser walkthrough confirmed the Operations nav group, per-step purpose sentences and primary actions, instruction generation leading to "Continue to Settlement", the state-driven Connect Wallet action, Advanced Settlement Tools / Advanced Verification grouping, instruction retention across Back navigation, and the reset confirmation with Cancel preserving state. No page errors; no financial or blockchain logic changed.

# Phase 5 settlement exception testing
- [x] Add "Test a Settlement Exception" to Demo Workflow Step 4, available with or without a scaled instruction (paste any confirmed hash).
- [x] Isolated read-only panel: fetch real tx + paginated payment operations from Horizon, build a hypothetical instruction from actual sender/recipient/amount/asset/issuer.
- [x] Three scenarios (default: incorrect expected amount; recipient; alternative issuer), side-by-side Match/Mismatch table, "Exception — Instruction Mismatch" status, Blockchain Successful vs Reconciliation Mismatch callouts, explorer link, "Return to Successful Reconciliation".
- [x] Component-local state only: no store writes, no record/status/audit changes, no Freighter, no new transactions.
- [x] Tests and browser validation.

Phase 5 validation: 155 tests pass (13 new); typecheck clean. Browser check loaded a genuine confirmed public Testnet USDC payment (20.0000000 USDC, ledger 5384565), ran the default amount scenario (hypothetical 20.5000000 → Amount Mismatch only) and the issuer scenario (Circle Mainnet issuer → Asset issuer Mismatch only), both showing "Exception — Instruction Mismatch" with "Blockchain result: Successful" intact; Return button closed the panel; no page errors, no Horizon POSTs, no store changes. The public payment was a temporary test fixture, never seeded. Recipient scenario is covered by unit tests (regex-validated user-supplied G-address, no invented address).

# Scaled end-to-end settlement
- [x] Add scale selector (1:1 … 1:10,000, default 1:1,000) scaling contract quantities proportionally; recalc via existing netting logic.
- [x] Generate immutable scaled settlement instruction (ID, snapshot, amounts, parties, USDC asset/issuer, network, timestamp) without any blockchain action.
- [x] Connect instruction to Freighter: prerequisites, review screen, "Settle with USDC on Stellar", real Testnet payment, duplicate-submission protection.
- [x] Automatic Horizon reconciliation against the exact instruction, "Verify Again", persisted status and audit trail.
- [x] Preserve the historical 1 USDC record and all existing pages; label "Scaled Stellar Testnet Demonstration" with 1 USD = 1 USDC assumption.
- [x] Tests and browser validation.
- [ ] Verify a real Freighter-approved scaled payment end to end (requires the user's funded Testnet wallet/extension).

Scaled settlement validation: 142 tests pass; build OK. Browser check confirmed the default 1:1,000 scale shows USD 3.10 gross / 1.50 net with the "1,500 ÷ 1,000 = 1.50 → 1.5000000 testnet USDC" calculation, instruction generation, the Settle step with instruction details and blocked payment without Freighter, the Verify step with Verify Again, persistence across reload, and full-size 3,100 / 1,500 / 1500.0000000 figures. No page errors; no Horizon POST; historical 1 USDC panels remain separate. A genuine Freighter approval and live scaled payment were not performed (no user wallet in the sandbox).

# H100 market data integration
- [x] Add Compute Screener H100 fetch/validation/cache module with no hardcoded or fallback prices.
- [x] Add H100 Market Reference panel with refresh, scenario run/reset and CC BY 4.0 attribution in Demo Workflow Step 1.
- [x] Add Original Demo / Market Data Scenario switch, indicative-scenario label and net comparison; keep scenario state separate from booked records.
- [x] Run tests and browser check of refresh, scenario recalculation, reset and error states.

H100 validation: 126 tests pass; build OK. Live browser check fetched the genuine Compute Screener observation (3.7129 USD/GPU-hour, Provisional, H100 SXM 80GB, 2026-10-25), ran the scenario (net USD 811.93 CP-B to CP-A vs original USD 1,500, difference 688.07 lower), reset to the original demo with 3,100 gross / 1,500 net / 51.6% intact, showed a visible error with no fallback price when the API was blocked, and labeled the stored observation Cached after reload. Scenario state is component-local; no settlement, wallet or reconciliation records were touched.

# Guided live-demo UX
- [x] Add prominent Demo Workflow with Calculate → Net → Settle → Verify and Next/Back navigation.
- [x] Reuse existing payment and retrospective verification without changing financial logic or saved records; collapse advanced details.
- [x] Verify guided navigation, saved-evidence persistence, live read-only verification and original pages.

Guided UX validation: full existing suite passed (106 tests), plus the new saved-record preservation test and affected panels passed. Latest build OK. Browser followed all steps, showed 3100 gross / 1500 net / 51.6% reduction, reconciled a pre-existing public Testnet payment using live Horizon, retained evidence on reload and verified again. All original pages loaded; no Horizon POST, page errors or document overflow at 800/390 pixels. Public test evidence exists only in temporary browser context, not application seed data. No new payment or real Freighter approval was performed; prior real-extension checks remain blocked by unavailable user hardware.

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
