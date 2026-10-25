# CDP Clear

**Bilateral netting and USDC settlement for AI compute derivatives.**

Built at HackMeridian Lisbon 2026, representing Nuvanté.

[Live Demo]([https://clear-bilateral-settlement.lovable.app/)](https://cdpclear.com/) 

## What is CDP Clear?

CDP Clear is a post-trade application that calculates, nets and settles cash obligations arising from derivatives linked to GPU computing prices.

AI compute is becoming an increasingly important input for businesses. As GPU rental prices fluctuate, financial contracts can help participants manage that exposure. But those contracts create payment obligations that still need to be calculated, netted and settled.

CDP Clear brings those processes into one application, using USDC on Stellar Testnet to demonstrate settlement and on-chain reconciliation.

## The problem

Two counterparties trading derivatives may owe each other money across several contracts. Settling every obligation individually can increase gross cash movements, funding requirements and operational work.

Bilateral netting reduces these payments to a single amount owed between the counterparties, assuming the obligations are eligible to be netted.

The remaining payment still needs to be authorised, executed and matched against the original settlement instruction.

## How it works

CDP Clear follows four steps:

**1. Calculate**

The application retrieves published H100 GPU rental pricing from Compute Screener and calculates indicative cash exposure across three GPU forward contracts.

**2. Net**

Eligible opposing obligations are offset to determine the net amount payable between counterparties.

For the original illustrative portfolio:

| Trade | Direction | Cash obligation |
|---|---|---:|
| T-001 | CP-B pays CP-A | $2,000 |
| T-002 | CP-A pays CP-B | $800 |
| T-003 | CP-B pays CP-A | $300 |
| **Gross obligations** | | **$3,100** |
| **Net obligation** | **CP-B pays CP-A** | **$1,500** |

Netting reduces gross payment value by **51.6%**, from $3,100 to $1,500, and reduces three payments to one.

**3. Settle**

CDP Clear generates a settlement instruction based on the netting calculation.

For Testnet demonstrations, users can select a smaller illustrative portfolio. At a 1:1,000 scale, the original $1,500 net obligation becomes a $1.50 test obligation.

The application prepares a 1.5000000 USDC payment, checks wallet readiness and requests approval through Freighter.

**4. Verify**

After payment, CDP Clear retrieves the transaction from Stellar and compares it against the settlement instruction.

It checks the sender, recipient, amount, asset issuer and transaction success. A confirmed blockchain transaction is only marked *Reconciled* when the required details match.

The application also supports settlement exception testing and downloadable settlement evidence.

## Why Stellar?

Stellar provides native USDC transfers, fast transaction confirmation and a publicly accessible record of payments.

These features are useful for derivatives settlement, where counterparties need to know whether the correct payment was made, not simply whether money moved.

CDP Clear uses Stellar to:

- Execute USDC payments authorised through Freighter.
- Support transfers outside conventional banking hours.
- Retrieve transaction and payment-operation records through Horizon.
- Reconcile actual payments against settlement instructions.

The financial calculations and netting rules run in CDP Clear. Stellar handles the payment and provides independent evidence of its execution.

## Technical architecture

```text
Compute Screener H100 Index
            |
            v
    GPU Forward Contracts
            |
            v
    Cash Exposure Calculation
            |
            v
       Bilateral Netting
            |
            v
    Settlement Instruction
            |
            v
    Freighter Wallet Signing
            |
            v
    Stellar Testnet USDC
            |
            v
    Horizon Verification
            |
            v
     Settlement Reconciliation
            |
            v
      Evidence Export
```

### Stack

| Area | Technology |
|---|---|
| Frontend | React 19, TypeScript |
| Application framework | TanStack Start and TanStack Router |
| Styling | Tailwind CSS 4 |
| UI components | Radix UI |
| Blockchain | Stellar Testnet |
| Wallet | Freighter API |
| Transactions | Stellar JavaScript SDK |
| Verification | Stellar Horizon API |
| Market data | Compute Screener |
| Financial evidence | SHA-256 |
| Testing | Vitest |

### Settlement controls

The application includes checks for netting eligibility, settlement direction, payment amounts, connected wallet, network, available USDC and XLM, and recipient trustline.

Uncertain transaction outcomes are not automatically treated as failures. CDP Clear can check the known transaction hash before allowing another payment attempt.

Settlement instructions also support financial snapshots and SHA-256 fingerprints. These help detect changes to saved calculation inputs.

The application can export settlement evidence containing the financial snapshot, expected instruction, transaction reference, verification result and timestamps.

## Running locally

The project uses Bun and Vite.

```bash
bun install
bun run dev
```

Run the tests:

```bash
bun run test
```

Build for production:

```bash
bun run build
```

### Testing a Stellar payment

To execute a payment through the application, you need:

- Freighter installed and connected to Stellar Testnet.
- A funded Testnet account with sufficient XLM.
- Circle-issued Stellar Testnet USDC.
- A receiving account with the correct USDC trustline.

The application checks these requirements before payment. Freighter handles transaction signing.

You can explore the financial calculations and netting workflow without connecting a wallet.

## What is live and what is simulated?

The distinction matters.

**Live functionality**

- Published H100 rental-price retrieval.
- Wallet connection and Testnet balance checks.
- Freighter-authorised USDC transfers.
- Stellar transaction verification.
- Reconciliation against settlement instructions.

**Illustrative elements**

- GPU forward contracts and their agreed prices.
- Contractual settlement fixings.
- Bilateral netting assumptions.
- Scaled portfolios used to keep Testnet payments small.

The published H100 rental price is an indicative market reference, not automatically an authorised contractual settlement fixing.

A scaled USDC payment demonstrates settlement of the smaller illustrative portfolio. It does not discharge the original $1,500 obligation.

## Limitations

CDP Clear is a hackathon proof of concept, not a regulated clearinghouse or production settlement system.

The prototype assumes that the illustrated obligations are eligible for bilateral netting. Actual enforceability depends on the applicable agreements and legal framework.

Settlement records and duplicate-payment controls are currently browser-local and should not be treated as a shared institutional audit system.

The application does not provide production custody, counterparty identity verification, regulatory compliance or legally enforceable settlement finality for the underlying derivatives.

Stellar Testnet USDC has no real monetary value.

## Next steps

Further development could include institutional authorisation workflows, shared settlement records, stronger audit controls and integration with agreed compute-derivatives settlement benchmarks.

## HackMeridian 2026

**Project:** CDP Clear  
**Event:** HackMeridian, Lisbon  
**Representing:** Nuvanté  
**Network:** Stellar Testnet

CDP Clear demonstrates how bilateral derivatives netting can connect to wallet-authorised stablecoin payments and independently verifiable settlement records.
