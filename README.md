# CDP Clear — HackMeridian demo

Bilateral Payment Netting & USDC Cash-Leg Settlement for Tokenised Compute Derivatives. **Simulation / Testnet Verification only. No real funds. No secret keys requested or used.** CDP Clear is not a central counterparty, regulated clearinghouse, live derivatives exchange or production settlement system.

## Pages
1. **Trade Capture & Lifecycle** (`/`) – CP-B pays CP-A USD 2,000; CP-A pays CP-B USD 800; CP-B pays CP-A USD 300. These are illustrative valuation-derived cash obligations, not full derivative notionals. Sample settlement date is October 26, 2026, an illustrative input; lifecycle and eligibility metadata are visible.
2. **Bilateral Payment Netting** (`/netting`) – gross payable CP-B USD 2,300 minus gross payable CP-A USD 800 = **NSO USD 1,500 payable CP-B to CP-A**. Aggregate gross flows USD 3,100; reduction USD 1,600 (51.6%); three gross payments compressed to one. Requires same currency, matching settlement dates and eligible obligations; contractual permission under an enforceable netting agreement is assumed. No novation, multilateral netting, margin optimisation or CCP risk guarantee.
3. **Cash-Leg Settlement & Reconciliation** (`/settlement`) – browser-local instruction register, obligation snapshot, public wallets, USDC issuer validation, external authorisation queue, independent network confirmation and explicit reconciliation. The app **does not sign or send payments**.

## Demo script
1. Create two testnet accounts via https://laboratory.stellar.org and fund them with test XLM via Friendbot. Both need a USDC trustline to the intended issuer. The prefilled issuer is `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, listed in Circle's Stellar testnet quickstart. Use https://faucet.circle.com if available; testnet services and balances may reset. Obtain sufficient test USDC or reduce the illustrative trade amounts. Do not use real funds.
2. Enter CP-B's public payer address and CP-A's public beneficiary address. Create a **Draft**, then **Validate instruction & issuer**. Horizon's network passphrase and exact USDC asset issuer are checked independently. This is on-chain identifier validation, not proof of Circle authenticity, reserves or redeemability.
3. Queue the **Validated** instruction for external authorisation (**Pending Authorisation**). Authorisation, signing and sending are performed outside CDP Clear. Under the explicit illustrative 1:1 assumption, the sample contractual USD 1,500 converts to 1,500 testnet USDC. Send exactly the instruction amount and asset externally.
4. Supply a REAL 64-character hash and select **Verify network transaction**. **Submitted** means an externally supplied hash, not submission by the app. **Confirmed** requires an independently verified successful transaction on Stellar Testnet. A successful but mismatching payment may be network-confirmed, but is never reconciled.
5. Select **Reconcile cash-leg obligation**. **Reconciled** requires matching asset code, issuer, amount, payer and beneficiary, a validated issuer, unchanged obligation snapshot, and no prior allocation of the transaction hash. Failed network execution is **Failed**; missing, mismatching, changed or unavailable evidence is **Exception**. Manual review records an Exception only, never Confirmed or Reconciled. After reload, re-verify before reconciliation.
6. Start a new instruction to retain the reconciled row in the register. Duplicate protection is browser-local, not cross-user. Reset demo data clears the register and restores samples. Prior-version instructions are quarantined as Exceptions for fresh verification.

## Implemented vs not
- Implemented: shared netting maths, eligibility/date validation, lifecycle metadata, instruction register, issuer/network validation, read-only Horizon confirmation and field-level reconciliation.
- Not implemented: external payment authorisation, payment sending, wallet signing, mainnet, live derivative valuation, real FX/market prices, persistence beyond browser localStorage or production-grade multi-operator controls.

## Tests
`bunx vitest run`
