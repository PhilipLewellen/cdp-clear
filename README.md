# CDP Clear — HackMeridian demo

Bilateral Payment Netting & USDC Cash-Leg Settlement for Tokenised Compute Derivatives. **Simulated derivatives / Stellar Testnet only. No real funds. No secret keys requested or used by CDP Clear.** Freighter signs locally. CDP Clear is not a central counterparty, regulated clearinghouse, live derivatives exchange or production settlement system.

## GPU-forward economics
T-001: 1000 GPU-hours × ($5 simulated fixing − $3 strike) = $2000 long CP-A payoff. T-002: 400 × ($2 − $4) = −$800. T-003: 300 × ($4 − $3) = $300. Expand each trade to edit GPU quantity, strike, simulated fixing or long counterparty. Cash amount is absolute payoff; cash direction follows its sign. No conflicting manual cash edits. Saved legacy cash rows are upgraded preserving cash values, dates and eligibility; any implied fixing remains simulated.

## Pages
0. **Operations Overview** (`/overview`) – state-driven totals, direction, status and settlement next action; existing URLs are preserved.
1. **Trade Capture & Lifecycle** (`/`) – CP-B pays CP-A USD 2,000; CP-A pays CP-B USD 800; CP-B pays CP-A USD 300. These are illustrative valuation-derived cash obligations, not full derivative notionals. Sample settlement date is October 26, 2026, an illustrative input; lifecycle and eligibility metadata are visible.
2. **Bilateral Payment Netting** (`/netting`) – gross payable CP-B USD 2,300 minus gross payable CP-A USD 800 = **NSO USD 1,500 payable CP-B to CP-A**. Aggregate gross flows USD 3,100; reduction USD 1,600 (51.6%); three gross payments compressed to one. Requires same currency, matching settlement dates and eligible obligations; contractual permission under an enforceable netting agreement is assumed. No novation, multilateral netting, margin optimisation or CCP risk guarantee.
3. **Cash-Leg Settlement & Reconciliation** (`/settlement`) – browser-local instruction register, obligation snapshot, public wallets, USDC issuer validation, external authorisation queue, independent network confirmation and explicit reconciliation. A separate Phase 3 action signs through Freighter and sends exactly **1.0000000 Testnet USDC**, never the simulated net obligation.

4. **Activity** (`/activity`) – actual local edits, validation, netting calculations, instruction changes and verification requests; linked references, lifecycle and evidence. No fabricated history.

## Demo script
1. Create two testnet accounts via https://lab.stellar.org and fund them with test XLM via Friendbot. Both need a USDC trustline to the intended issuer. The prefilled issuer is `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, listed in Circle's Stellar testnet quickstart. Use https://faucet.circle.com if available; testnet services and balances may reset. Obtain sufficient test USDC or reduce the illustrative trade amounts. Do not use real funds.
2. Enter CP-B's public payer address and CP-A's public beneficiary address. Create a **Draft**, then **Validate instruction & issuer**. Horizon's network passphrase and exact USDC asset issuer are checked independently. This is on-chain identifier validation, not proof of Circle authenticity, reserves or redeemability.
3. Queue the **Validated** instruction for external authorisation (**Pending Authorisation**). Authorisation, signing and sending are performed outside CDP Clear. Under the explicit illustrative 1:1 assumption, the sample contractual USD 1,500 converts to 1,500 testnet USDC. Send exactly the instruction amount and asset externally.
4. Supply a REAL 64-character hash and select **Verify network transaction**. A supplied hash records only **Verification requested**, a local action; the app does not claim submission. **Confirmed** requires an independently verified successful transaction on Stellar Testnet. A successful but mismatching payment may be network-confirmed, but is never reconciled.
5. Select **Reconcile cash-leg obligation**. **Reconciled** requires matching asset code, issuer, amount, payer and beneficiary, a validated issuer, unchanged obligation snapshot, no prior allocation of the transaction hash, and no earlier reconciled instruction for the same obligation snapshot. Failed network execution is **Failed**; missing, mismatching, changed or unavailable evidence is **Exception**. Manual review records an Exception only, never Confirmed or Reconciled. After reload, re-verify before reconciliation.
6. Start a new instruction to retain the reconciled row in the register. Duplicate protection is browser-local, not cross-user. Reset demo data clears the register and restores samples. Prior-version instructions are quarantined as Exceptions for fresh verification.

## Implemented vs not
- Implemented: GPU-forward payoff derivation, state-driven Overview, local audit events, shared netting maths, eligibility/date validation, lifecycle metadata, instruction register, issuer/network validation, read-only Horizon confirmation and field-level reconciliation.
- Not implemented: app execution of the simulated net obligation, mainnet, live derivative valuation, real FX/market prices or production-grade multi-operator controls.

## Phase 2 — wallet and settlement asset
Connect Freighter on **Stellar Testnet**, open Settlement and enter the beneficiary public address in **Wallet & Settlement Asset**. Use the connected payer address for a new draft if appropriate; existing instructions are never silently rewritten. The panel uses the SDK's `Horizon.Server("https://horizon-testnet.stellar.org").loadAccount()` for actual account data and matches both code **USDC** and exact configured issuer. It rechecks the wallet network/account, refreshes every 30 seconds/on focus, and supports manual refresh. No balances are persisted or fabricated.

XLM available before fees subtracts sponsorship-adjusted reserves and selling liabilities, using current ledger reserve/base fee values. Spendable USDC subtracts selling liabilities and requires full trustline authorisation. Beneficiary checks include account existence, exact trustline, full authorisation and remaining limit after buying liabilities. Amount above spendable USDC, insufficient XLM, an instruction payer mismatch or missing prerequisites cannot produce a positive funding status. These are lookup-time balance prerequisites, not a transaction guarantee; fee surges, signatures and subsequent changes still matter.

Issuer documentation verified on 2026-10-25: https://developers.circle.com/stablecoins/usdc-contract-addresses lists Stellar Testnet `USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`. Test tokens have **no financial value and no real USD backing**. Revalidate official documentation before enabling any future transactions. Phase 2 does **not** sign, send payments or change settlement lifecycle based on funding. Real Freighter connection requires a browser with the extension; funded accounts/trustlines/test USDC may require a wallet or Stellar mentor.

## Tests
`bunx vitest run`

## Validation and external requirements
Tests cover economics, dates/eligibility, duplicate hashes and obligation snapshots, persistence and truthful activity. Successful payment matching and signing/submission safeguards are tested with controlled fixtures; this does not claim a real Freighter approval or successful live payment. A funded Testnet Freighter wallet is required for an end-to-end Phase 3 payment; a Stellar mentor may help obtain test USDC/trustlines.

## Phase 3 — separate 1 USDC test settlement
1. Connect Freighter on Testnet. Fund the payer with at least 1 spendable USDC of the configured Circle-documented Testnet issuer and sufficient XLM after reserves/liabilities. Use a single-signature account. The recipient must exist, have the same authorised USDC trustline and at least 1 USDC receiving capacity.
2. In **Separate 1 USDC test settlement**, enter the recipient's public G-address (blank by default) and select **Send Test Settlement**. Review sender, recipient, exact issuer, fixed amount, network and fee. Current p95/base fees are used, with a 0.01 XLM ceiling and a 180-second transaction timeout.
3. Select **Confirm & sign in Freighter**, then approve the extension's signature prompt. Funds/network are checked again before signing; the unchanged transaction body and valid payer signature are checked before Horizon submission.
4. A hash and Stellar Expert link appear only after independent Horizon verification of a successful matching 1 USDC payment. Live balances refresh. The $1,500 simulated NSO and all instruction lifecycle/reconciliation records are untouched.
5. Rejection or pre-submission errors never show success. Ambiguous submission blocks another payment and offers **Check payment status**; unresolved public hash/addresses survive reload in the same tab, but no keys or signed XDR are stored. Do not resend from another tab/device when outcome is uncertain. Failures with confirmed network result may require manual review before another attempt.

Real extension approval/submission cannot be verified in the sandbox; no genuine payment is claimed without that user-authorised flow.

## Phase 4 — retrospective existing-payment reconciliation
Open **Retrospective test reconciliation** on Settlement. `TEST-SETTLEMENT-001` expects exactly **1.0000000 USDC** of the configured Circle Stellar Testnet issuer, separate from the illustrative USD 1,500 obligation. Previously saved Phase 3 public references are prefilled; older successful payments were not retained after reload, so paste their hash and enter expected sender/recipient if missing. No invented address or hash is supplied.

Review the expected instruction and click **Reconcile Existing Payment**. This is read-only: no Freighter signature, transaction construction, submission, USDC deduction or XLM fee. SDK Horizon reads verify the fixed Testnet network, successful transaction, every paginated payment operation, operation membership/success, sender, recipient, exact integer-stroop amount and asset/issuer. Only a complete match is **Reconciled**; mismatches show **Exception — Mismatch**, and missing transactions/outages show **Verification unavailable**. **Verify Again** repeats independent reads.

The actual operation fields, hash, blockchain confirmation time, later verification time and audit events are retained in the existing browser-local store. The record survives refresh and demo reset; successful Phase 3 public references are saved without signed XDR or wallet access. Allocation is browser-local, not cross-user or tamper-proof; the test record cannot share a reconciled transaction with simulated instructions. Test reconciliation does not settle or legally discharge any compute derivatives contract. A real existing payment hash and expected addresses are needed to verify your payment; no additional test USDC is required.
