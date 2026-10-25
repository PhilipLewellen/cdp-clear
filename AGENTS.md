<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Demo state (trades, instruction) lives in a React context persisted to localStorage (`src/lib/store.tsx`); no backend is needed for the demo.
- Keep component modules component-only; the demo context and hook live outside the provider module and shared class constants outside Shell so Fast Refresh preserves context identity and avoids importer invalidation.
- WalletProvider shares a nonpersisted connection across workflow pages; context stays outside component modules to preserve Fast Refresh identity. Read-only balance checks dynamically load Horizon SDK in the browser, recheck Freighter network/account, discard stale results and use integer stroops for exact asset/liability/reserve calculations; no execution or lifecycle changes occur from funding checks.
- Financial obligations and netting are shared in src/lib/netting.ts; instruction lifecycle and snapshot reconciliation live in src/lib/settlement.ts so all pages use the same rules.
- GPU-forward economics derive cash amounts and direction in the shared financial helper; legacy saved cash rows are upgraded without replacing their saved cash values, dates or eligibility.
- / renders the guided workflow (/demo renders it too); operations pages live at /overview, /obligations, /netting, /settlement, /activity. Keep step panels mounted so Back/Next never loses an in-progress payment review.
- Overview scenario calculations and current-snapshot settlement monitoring live in src/lib/risk-overview.ts; scenarios operate on copied economics and never write booked state, while signed cash deltas preserve meaning across payer reversals.
- H100.ts validates/caches the reference; use-h100.ts shares one workflow observation. Calculate owns the full feed panel; Net consumes its basis and copied economics; Settle owns confirmed booked scaling/instruction creation, isolating wallets and evidence from market updates.
- Keep a browser-local reconciled register: snapshots cannot be instructed twice and transaction hashes cannot be reused; a supplied hash records verification requested, not submission, and implies no cross-user persistence.
- Verify the fixed Horizon testnet network and exact USDC issuer asset before instruction validation and payment reconciliation; on-chain matching does not attest real-world issuer authenticity.
- Shared workstation surfaces, compact table/control styling and responsive settlement module layout belong in src/styles.css; pages consume these styles and semantic tokens to keep all three workflow stages consistent without altering financial helpers.
- Activity is a browser-local event register persisted with demo state, separate from instruction lifecycle evidence; record operator actions as demo operations and network events only from independently verified instruction evidence to avoid fabricated payment claims.
- Separate Testnet payment logic lives in src/lib/test-payment.ts, isolated from simulated instructions; validate unchanged signed transaction hash and payer signature, refresh prerequisites, and confirm matching Horizon evidence before success.
- Unresolved payment hashes stay in sessionStorage (scaled flow also keeps the public signed XDR, never keys); block resubmission and offer read-only status lookup after ambiguous submission.
- Retrospective test reconciliation lives in a read-only module separate from simulated settlement; store its record/audit in the existing demo store and retain confirmed Phase 3 public references for reuse, because no second payment or legal discharge is implied.
- Verify retrospective payments through paginated SDK Horizon operations with exact stroop comparison, successful transaction membership and browser-local allocation checks; never infer reconciliation from a saved success label.
- Scaled-settlement.ts scales copied quantities and reconciles immutable instructions; scaled-payment.ts reuses netting, funding and Horizon helpers for parameterized Testnet payments. Never mutate booked trades or historical 1 USDC records; block payment on portfolio change. Freighter signs locally with Testnet checks; never persist wallet access or keys.
- Financial-snapshot.ts captures new-instruction provenance with browser SHA-256. Settlement-evidence.ts reuses Horizon verification and allowlisted JSON export; evidence refresh never changes lifecycle or historical timestamps, and legacy snapshots are never invented.
- Settlement exception testing lives in src/lib/settlement-exception.ts (read-only Horizon evidence fetch, hypothetical instruction builder, pure field-by-field reconcileException) with the panel in src/components/SettlementException.tsx; all state is component-local, nothing is persisted, and the genuine instruction, its status, hashes and audit events are never touched.
- Pre-payment readiness checks, payment-state mapping and read-only recovery classification live in src/lib/settlement-readiness.ts; unavailable network data is never a pass, and an unresolved hash blocks new payment until Horizon shows it failed or it expired unseen.
