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
- Stellar settlement is verify-only via public Horizon testnet; never add key handling or payment submission in browser code.
- Financial obligations and netting are shared in src/lib/netting.ts; instruction lifecycle and snapshot reconciliation live in src/lib/settlement.ts so all pages use the same rules.
- Keep a browser-local reconciled instruction register and reject reused transaction hashes; this protects the demo against duplicate allocation without implying cross-user persistence.
- Verify the fixed Horizon testnet network and exact USDC issuer asset before instruction validation and payment reconciliation; on-chain matching does not attest real-world issuer authenticity.
- Shared workstation surfaces, compact table/control styling and responsive settlement module layout belong in src/styles.css; pages consume these styles and semantic tokens to keep all three workflow stages consistent without altering financial helpers.
- Activity is a browser-local event register persisted with demo state, separate from instruction lifecycle evidence; record operator actions as demo operations and network events only from independently verified instruction evidence to avoid fabricated payment claims.
