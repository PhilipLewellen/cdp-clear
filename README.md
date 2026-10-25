# CDP Clear — HackMeridian demo

Beginner-friendly clearing → netting → settlement demo. **Testnet only. No real funds. No secret keys anywhere in the app.**

## Pages
1. **Trades** (`/`) – three editable sample obligations between Party A and B (A receives USD 2,000; B receives USD 800; A receives USD 300). Values are simulated.
2. **Netting** (`/netting`) – gross vs net. Sample result: gross USD 3,100 → **B owes A USD 1,500**. Notes the assumptions (same counterparties, settlement cycle, currency, enforceable netting agreement).
3. **Settlement** (`/settlement`) – creates a settlement instruction (ID, asset code, issuer, network, source/destination wallets, amount, status). The app **does not send payments**.

## Demo script
1. Create two funded testnet accounts at https://laboratory.stellar.org (Friendbot). For a USDC demo, add a trustline to USDC (issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`) and get test USDC from https://faucet.circle.com — or simply set asset code to `XLM` and leave issuer blank.
2. On Settlement, enter B's public address as source and A's as destination, create the instruction.
3. Send exactly `1500` of the asset from source to destination yourself (Laboratory or Freighter, testnet).
4. Paste the transaction hash → **Verify automatically**. The app reads Horizon testnet and only marks **Settled (verified on testnet)** if the tx succeeded and contains a payment with matching source, destination, amount and asset.
5. If Horizon is unreachable, a clearly labelled **Settled (manual verification)** fallback exists.

## Implemented vs not
- Implemented: netting maths, instruction creation, read-only Horizon testnet verification.
- Not implemented: payment sending, wallet signing, mainnet, real FX/market prices (1 token = 1 USD is simulated), persistence beyond browser localStorage.

## Tests
`bunx vitest run`
