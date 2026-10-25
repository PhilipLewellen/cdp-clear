# CDP Clear — HackMeridian demo

Bilateral Payment Netting & USDC Cash-Leg Settlement for Tokenised Compute Derivatives. **Simulation / Testnet Verification only. No real funds. No secret keys requested or used.** CDP Clear is not a central counterparty, regulated clearinghouse, live derivatives exchange or production settlement system.

## GPU-forward economics
T-001: 1000 GPU-hours × ($5 simulated fixing − $3 strike) = $2000 long CP-A payoff. T-002: 400 × ($2 − $4) = −$800. T-003: 300 × ($4 − $3) = $300. Expand each trade to edit GPU quantity, strike, simulated fixing or long counterparty. Cash amount is absolute payoff; cash direction follows its sign. No conflicting manual cash edits. Saved legacy cash rows are upgraded preserving cash values, dates and eligibility; any implied fixing remains simulated.

## Pages
0. **Operations Overview** (`/overview`) – state-driven totals, direction, status and settlement next action; existing URLs are preserved.
1. **Trade Capture & Lifecycle** (`/`) – CP-B pays CP-A USD 2,000; CP-A pays CP-B USD 800; CP-B pays CP-A USD 300. These are illustrative valuation-derived cash obligations, not full derivative notionals. Sample settlement date is October 26, 2026, an illustrative input; lifecycle and eligibility metadata are visible.
2. **Bilateral Payment Netting** (`/netting`) – gross payable CP-B USD 2,300 minus gross payable CP-A USD 800 = **NSO USD 1,500 payable CP-B to CP-A**. Aggregate gross flows USD 3,100; reduction USD 1,600 (51.6%); three gross payments compressed to one. Requires same currency, matching settlement dates and eligible obligations; contractual permission under an enforceable netting agreement is assumed. No novation, multilateral netting, margin optimisation or CCP risk guarantee.
3. **Cash-Leg Settlement & Reconciliation** (`/settlement`) – browser-local instruction register, obligation snapshot, public wallets, USDC issuer validation, external authorisation queue, independent network confirmation and explicit reconciliation. The app **does not sign or send payments**.

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
- Not implemented: external payment authorisation, payment sending, wallet signing, mainnet, live derivative valuation, real FX/market prices, persistence beyond browser localStorage or production-grade multi-operator controls.

## Tests
## Phase 2 — wallet and settlement asset
Connect Freighter on **Stellar Testnet**, open Settlement and enter the beneficiary public address in **Wallet & Settlement Asset**. Use the connected payer address for a new draft if appropriate; existing instructions are never silently rewritten. The panel uses the SDK's `Horizon.Server("https://horizon-testnet.stellar.org").loadAccount()` for actual account data and matches both code **USDC** and exact configured issuer. It rechecks the wallet network/account, refreshes every 30 seconds/on focus, and supports manual refresh. No balances are persisted or fabricated.

XLM available before fees subtracts sponsorship-adjusted reserves and selling liabilities, using current ledger reserve/base fee values. Spendable USDC subtracts selling liabilities and requires full trustline authorisation. Beneficiary checks include account existence, exact trustline, full authorisation and remaining limit after buying liabilities. Amount above spendable USDC, insufficient XLM, an instruction payer mismatch or missing prerequisites cannot produce a positive funding status. These are lookup-time balance prerequisites, not a transaction guarantee; fee surges, signatures and subsequent changes still matter.

Issuer documentation verified on 2026-10-25: https://developers.circle.com/stablecoins/usdc-contract-addresses lists Stellar Testnet `USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`. Test tokens have **no financial value and no real USD backing**. Revalidate official documentation before enabling any future transactions. Phase 2 does **not** sign, send payments or change settlement lifecycle based on funding. Real Freighter connection requires a browser with the extension; funded accounts/trustlines/test USDC may require a wallet or Stellar mentor.

## Tests
`bunx vitest run`

## Validation and external requirements
40 tests cover economics, dates/eligibility, duplicate hashes and obligation snapshots, persistence and truthful activity. Browser checks exercised quantity/strike/fixing/long-direction changes, saved recalculation, live issuer validation and missing-hash exceptions. Successful payment matching is covered by controlled fixtures; no genuine successful payment was provided in this update. A funded testnet wallet or Stellar mentor is required to create a real testnet payment, obtain test USDC and sign externally. No Freighter signing integration was added.
