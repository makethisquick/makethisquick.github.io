import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppBar } from "../components/AppBar";
import { getInvite, markStep, saveApp } from "../lib/store";
import { requestSignSession, BoxNotConfiguredError, BOX_EMBED_ORIGIN } from "../lib/box";
import { Shield, ShieldCheck, DocIcon, Check, ArrowRight, Info } from "../components/icons";

type Phase = "intro" | "sign" | "done";

export default function Lease() {
  const [params] = useSearchParams();
  const token = params.get("invite") || "demo";
  const invite = useMemo(() => getInvite(token), [token]);

  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");

  const finishSigned = useCallback(() => {
    if (invite) markStep(token, "lease", "submitted");
    saveApp(token, { leaseStatus: "signed", leaseSignedAt: new Date().toISOString() });
    setPhase("done");
    window.scrollTo(0, 0);
  }, [invite, token]);

  // BOX Sign posts a completion message to the parent window — only trust its origin.
  useEffect(() => {
    if (phase !== "sign") return;
    function onMsg(e: MessageEvent) {
      if (e.origin !== BOX_EMBED_ORIGIN) return; // critical: never trust an unverified origin
      const t = (e.data && (e.data.type || e.data)) as string;
      if (t === "sign_complete" || t === "success") finishSigned();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [phase, finishSigned]);

  async function startSign() {
    if (!consent) return;
    setBusy(true);
    setError("");
    try {
      const session = await requestSignSession({ token, email: invite?.tenantEmail ?? "" });
      setEmbedUrl(session.embedUrl);
      setPhase("sign");
    } catch (err) {
      if (err instanceof BoxNotConfiguredError) {
        // Demo / not wired up: simulate a successful signing so the flow is testable.
        setDemo(true);
        window.setTimeout(finishSigned, 700);
      } else {
        // A real failure must never look like a successful signature.
        setError((err as Error).message || "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-main">
      <AppBar tag="Lease" brandLink={false} />
      <div className="shell">
        {phase === "intro" && (
          <section>
            <div className="step-head">
              <span className="kicker">{invite?.property ? `For ${invite.property}` : "Final step"}</span>
              <h2 tabIndex={-1}>Review &amp; sign your lease</h2>
              <p>Your lease is prepared for secure electronic signature. Review the agreement, then sign — it takes about a minute.</p>
            </div>

            <div className="card card--raised">
              <div style={{ display: "flex", alignItems: "center", gap: ".9rem" }}>
                <span className="slot__ico" style={{ width: 46, height: 46 }}><DocIcon /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: "1.05rem", display: "block" }}>Residential Lease Agreement</b>
                  <small className="muted">{invite?.property || "Prepared for signature"}</small>
                </div>
                <span className="badge badge--sent">Ready</span>
              </div>
            </div>

            <label className="check-row" style={{ marginTop: "1rem" }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="box"><Check /></span>
              <span className="meta"><b>I agree to sign electronically</b><small>I consent to use electronic records and signatures (E-SIGN / UETA).</small></span>
            </label>

            {demo && (
              <div className="notice" style={{ marginTop: "1rem" }}>
                <Info /><span><b>Demo mode.</b> BOX Sign isn't connected yet, so signing is simulated. See <span className="mono">BOX-INTEGRATION.md</span> to go live with embedded signing.</span>
              </div>
            )}
            {error && (
              <div className="notice notice--danger" style={{ marginTop: "1rem" }}>
                <Info /><span>{error}</span>
              </div>
            )}

            <div className="step-actions step-actions--end">
              <button className="btn btn--primary" onClick={startSign} disabled={!consent || busy}>
                {busy ? "Preparing…" : "Continue to signing"} {!busy && <ArrowRight className="arrow" />}
              </button>
            </div>
            <div className="trust-line"><Shield /> Powered by BOX Sign · Legally binding e-signature</div>
          </section>
        )}

        {phase === "sign" && (
          <section>
            <div className="step-head">
              <span className="kicker">Sign</span>
              <h2 tabIndex={-1}>Sign your lease</h2>
            </div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "var(--panel)" }}>
              <iframe src={embedUrl} title="Sign your lease" allow="fullscreen" style={{ width: "100%", height: "72vh", border: 0, display: "block" }} />
            </div>
          </section>
        )}

        {phase === "done" && (
          <section className="success">
            <div className="success__seal"><ShieldCheck /></div>
            <h1>Lease signed!</h1>
            <p>Your signed lease has been filed securely and a copy is on its way to your email. Welcome home.</p>
          </section>
        )}
      </div>
    </main>
  );
}
