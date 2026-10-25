import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, Shell, Tag, btnCls, btnGhost, inputCls } from "@/components/Shell";
import { useStore, type Instruction } from "@/lib/store";
import { fmt, netObligations } from "@/lib/netting";
import { NETWORK, verifyTestnetPayment } from "@/lib/stellar";

export const Route = createFileRoute("/settlement")({
  head: () => ({
    meta: [
      { title: "Settlement — CDP Clear" },
      { name: "description", content: "Create a settlement instruction and verify a Stellar testnet payment." },
      { property: "og:title", content: "Settlement — CDP Clear" },
      { property: "og:description", content: "Create a settlement instruction and verify a Stellar testnet payment." },
    ],
  }),
  component: Settlement,
});

// Circle's public USDC issuer on Stellar testnet (public address, not a key).
const DEFAULT_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const isG = (s: string) => /^G[A-Z2-7]{55}$/.test(s.trim());

function Settlement() {
  const { trades, instruction, setInstruction } = useStore();
  const r = netObligations(trades);
  const [form, setForm] = useState({ assetCode: "USDC", assetIssuer: DEFAULT_ISSUER, source: "", destination: "" });
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [manualAck, setManualAck] = useState(false);

  const canCreate = r.ok && r.net > 0 && isG(form.source) && isG(form.destination) && form.source !== form.destination && form.assetCode.trim() !== "" && (form.assetCode.toUpperCase() === "XLM" || isG(form.assetIssuer));

  const create = () => {
    const inst: Instruction = {
      id: `SI-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      ...form,
      assetCode: form.assetCode.trim(),
      assetIssuer: form.assetCode.toUpperCase() === "XLM" ? "" : form.assetIssuer.trim(),
      amount: r.net,
      status: "Instructed",
      txHash: "",
    };
    setInstruction(inst);
    setMsg(null);
  };

  const verify = async () => {
    if (!instruction) return;
    setBusy(true);
    setMsg(null);
    try {
      const v = await verifyTestnetPayment({ hash, ...instruction });
      if (v.ok) {
        setInstruction({ ...instruction, status: "Settled (verified on testnet)", txHash: hash.trim().toLowerCase(), verifiedNote: `Ledger ${v.ledger} · ${v.createdAt}` });
        setMsg({ ok: true, lines: ["Matching successful payment found on Stellar testnet."] });
      } else setMsg({ ok: false, lines: v.reasons });
    } catch (e) {
      setMsg({ ok: false, lines: ["Could not reach Horizon testnet. You may use manual verification below.", String(e)] });
    } finally {
      setBusy(false);
    }
  };

  const manual = () => {
    if (!instruction || !/^[0-9a-fA-F]{64}$/.test(hash.trim())) return;
    setInstruction({ ...instruction, status: "Settled (manual verification)", txHash: hash.trim().toLowerCase(), verifiedNote: "Operator confirmed manually — NOT automatically verified." });
  };

  const settled = instruction?.status.startsWith("Settled");
  const payer = r.payer ?? "—";
  const payee = r.payee ?? "—";

  return (
    <Shell title="Settlement" intro="Turn the net result into a settlement instruction. This app never sends money — you make the payment yourself on Stellar testnet, then paste the transaction hash so we can check it.">
      <Card className="border-warning/40">
        <div className="flex flex-wrap gap-2">
          <Tag tone="warning">Not implemented: payment sending / wallet signing</Tag>
          <Tag tone="warning">Simulated: 1 {form.assetCode || "token"} = 1 {r.currency}</Tag>
          <Tag tone="primary">Implemented: read-only testnet verification via Horizon</Tag>
        </div>
      </Card>

      {!instruction ? (
        <Card>
          <h2 className="font-display text-lg font-semibold">1. Create instruction</h2>
          <p className="mt-1 text-sm text-muted-foreground">Net amount: <b className="text-foreground">{r.ok ? fmt(r.net, r.currency) : "—"}</b> · {payer} pays {payee}. Enter public testnet addresses (G…). Never paste a secret key (S…).</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Asset code"><input className={inputCls} value={form.assetCode} onChange={(e) => setForm({ ...form, assetCode: e.target.value })} /></Field>
            <Field label="Asset issuer (blank for XLM)"><input className={inputCls} value={form.assetIssuer} onChange={(e) => setForm({ ...form, assetIssuer: e.target.value })} /></Field>
            <Field label={`Source wallet (Party ${payer})`}><input className={inputCls} placeholder="G…" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
            <Field label={`Destination wallet (Party ${payee})`}><input className={inputCls} placeholder="G…" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></Field>
          </div>
          {[form.source, form.destination].some((s) => s.trim().startsWith("S")) && <p className="mt-3 text-sm text-destructive">That looks like a secret key. Only public addresses (G…) belong here.</p>}
          <button className={btnCls + " mt-4"} disabled={!canCreate} onClick={create}>Create settlement instruction</button>
        </Card>
      ) : (
        <>
          <Card className={settled ? "border-success/50" : ""}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Settlement instruction</h2>
              <Tag tone={settled ? "success" : "warning"}>{instruction.status}</Tag>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[180px_1fr]">
              <Row k="Instruction ID" v={instruction.id} />
              <Row k="Status" v={instruction.status} />
              <Row k="Network" v={NETWORK} />
              <Row k="Asset code" v={instruction.assetCode} />
              <Row k="Issuer" v={instruction.assetIssuer || "native (XLM)"} />
              <Row k="Source wallet" v={instruction.source} />
              <Row k="Destination wallet" v={instruction.destination} />
              <Row k="Amount" v={`${instruction.amount.toFixed(7)} ${instruction.assetCode}`} />
              <Row k="Created" v={instruction.createdAt} />
              {instruction.txHash && <Row k="Tx hash" v={instruction.txHash} />}
              {instruction.verifiedNote && <Row k="Verification" v={instruction.verifiedNote} />}
            </dl>
            {instruction.txHash && (
              <a className="mt-4 inline-block text-sm text-primary underline" target="_blank" rel="noreferrer" href={`https://stellar.expert/explorer/testnet/tx/${instruction.txHash}`}>View on Stellar Expert (testnet) ↗</a>
            )}
          </Card>

          {!settled && (
            <Card>
              <h2 className="font-display text-lg font-semibold">2. Verify testnet payment</h2>
              <p className="mt-1 text-sm text-muted-foreground">Send exactly this payment from your own testnet wallet (e.g. Stellar Laboratory or Freighter on testnet), then paste the transaction hash.</p>
              <input className={inputCls + " mt-4"} placeholder="64-character transaction hash" value={hash} onChange={(e) => setHash(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={btnCls} disabled={busy || !hash.trim()} onClick={verify}>{busy ? "Checking testnet…" : "Verify automatically"}</button>
                <button className={btnGhost} onClick={() => setInstruction(null)}>Discard instruction</button>
              </div>
              {msg && (
                <ul className={`mt-4 space-y-1 text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>
                  {msg.lines.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              )}
              <details className="mt-6 rounded-md border border-border p-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Manual verification fallback (only if Horizon is unreachable)</summary>
                <label className="mt-3 flex items-start gap-2">
                  <input type="checkbox" checked={manualAck} onChange={(e) => setManualAck(e.target.checked)} className="mt-1" />
                  <span>I checked this hash on a testnet explorer and confirmed it is a successful payment matching every field above.</span>
                </label>
                <button className={btnGhost + " mt-3"} disabled={!manualAck || !/^[0-9a-fA-F]{64}$/.test(hash.trim())} onClick={manual}>Mark settled (MANUAL)</button>
              </details>
            </Card>
          )}
          {settled && <button className={btnGhost} onClick={() => { setInstruction(null); setHash(""); setMsg(null); }}>Start a new instruction</button>}
        </>
      )}
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs text-muted-foreground"><span className="mb-1 block uppercase">{label}</span>{children}</label>;
}
function Row({ k, v }: { k: string; v: string }) {
  return (<><dt className="text-muted-foreground">{k}</dt><dd className="break-all font-mono">{v}</dd></>);
}
