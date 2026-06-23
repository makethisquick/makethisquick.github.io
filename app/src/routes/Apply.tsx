import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AppBar } from "../components/AppBar";
import { UploadSlot } from "../components/UploadSlot";
import { getInvite, markStep, saveApp } from "../lib/store";
import { validateFile, type FileKind } from "../lib/validation";
import { captureApplication } from "../lib/box";
import type { ApplicationData, DocMeta, SlotKey } from "../lib/types";
import { ArrowLeft, ArrowRight, Shield, ShieldCheck, DocIcon, IdIcon, BankIcon, IncomeIcon, Info } from "../components/icons";

const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Step = "welcome" | "travel" | "identity" | "household" | "uploads" | "success";
const ORDER: Step[] = ["welcome", "travel", "identity", "household", "uploads", "success"];
const SEG: Partial<Record<Step, number>> = { travel: 0, identity: 1, household: 2, uploads: 3 };

const REQUIRED_SLOTS: SlotKey[] = ["contract", "id"];
const SLOT_LABEL: Record<SlotKey, string> = { contract: "job contract", id: "government photo ID", bank: "bank statement", income: "income document" };

interface TravelState { traveling: string; businessDomain: string; facilityName: string; contractStart: string; contractEnd: string; shift: string; }
interface IdentityState { legalName: string; aliases: string; dob: string; taxHome: string; }
interface HouseholdState { household: string; pets: string; vehicle: string; }

function ageFrom(dob: string): number {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return NaN;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

export default function Apply() {
  const [params] = useSearchParams();
  const inviteTok = params.get("invite") ?? "";
  const invite = useMemo(() => (inviteTok ? getInvite(inviteTok) : null), [inviteTok]);
  const token = inviteTok || "demo";

  const [step, setStep] = useState<Step>("welcome");
  const [travel, setTravel] = useState<TravelState>({ traveling: "", businessDomain: "", facilityName: "", contractStart: "", contractEnd: "", shift: "" });
  const [identity, setIdentity] = useState<IdentityState>({ legalName: "", aliases: "", dob: "", taxHome: "" });
  const [household, setHousehold] = useState<HouseholdState>({ household: "", pets: "", vehicle: "" });

  const [idErr, setIdErr] = useState<{ legalName?: string; dob?: string; taxHome?: string }>({});
  const [dateErr, setDateErr] = useState("");

  const [files, setFiles] = useState<Partial<Record<SlotKey, File>>>({});
  const [skipped, setSkipped] = useState<Partial<Record<SlotKey, boolean>>>({});
  const [fileErr, setFileErr] = useState<Partial<Record<SlotKey, string>>>({});
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ApplicationData | null>(null);

  // mark the invite "opened" once
  const opened = useRef(false);
  useEffect(() => {
    if (invite && !opened.current) {
      opened.current = true;
      markStep(token, "application", "sent");
    }
  }, [invite, token]);

  // focus the active step heading + scroll up on step change
  useEffect(() => {
    if (step === "welcome") return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-active-heading]")?.focus();
      window.scrollTo(0, 0);
    });
  }, [step]);

  const ctxLine = invite?.property ? `For ${invite.property}` : "Verified renter onboarding";
  const chromeOff = step === "welcome" || step === "success";

  const startApp = useCallback(() => setStep("travel"), []);

  // ---- validation ----
  function validateTravel(): boolean {
    if (travel.traveling === "yes" && travel.contractStart && travel.contractEnd && new Date(travel.contractEnd) < new Date(travel.contractStart)) {
      setDateErr("End date can't be before the start date.");
      return false;
    }
    setDateErr("");
    return true;
  }
  function validateIdentity(): boolean {
    const next: typeof idErr = {};
    if (!identity.legalName.trim()) next.legalName = "Enter your legal full name.";
    const age = ageFrom(identity.dob);
    if (!identity.dob) next.dob = "Enter your date of birth.";
    else if (isNaN(age) || age < 0 || age > 120) next.dob = "Enter a valid date of birth.";
    else if (age < 18) next.dob = "Applicants must be 18 or older.";
    if (!identity.taxHome.trim()) next.taxHome = "Enter your permanent tax home address.";
    setIdErr(next);
    return Object.keys(next).length === 0;
  }

  function next() {
    const cur = ORDER[ORDER.indexOf(step)];
    if (cur === "travel" && !validateTravel()) return;
    if (cur === "identity" && !validateIdentity()) return;
    if (cur === "uploads") { submit(); return; }
    setStep(ORDER[Math.min(ORDER.indexOf(step) + 1, ORDER.length - 1)]);
  }
  function back() {
    const i = ORDER.indexOf(step);
    if (i <= 1) return;
    setStep(ORDER[i - 1]);
  }

  // ---- uploads ----
  function onSelect(slot: SlotKey, kind: FileKind, file: File) {
    validateFile(file, kind).then((res) => {
      if (!res.ok) {
        setFileErr((e) => ({ ...e, [slot]: res.reason }));
        setFiles((f) => { const n = { ...f }; delete n[slot]; return n; });
        return;
      }
      setFiles((f) => ({ ...f, [slot]: file }));
      setFileErr((e) => ({ ...e, [slot]: undefined }));
      setSkipped((s) => ({ ...s, [slot]: false }));
      setSubmitMsg("");
    });
  }
  function onRemove(slot: SlotKey) {
    setFiles((f) => { const n = { ...f }; delete n[slot]; return n; });
    setFileErr((e) => ({ ...e, [slot]: undefined }));
  }
  function onSkip(slot: SlotKey, val: boolean) {
    setSkipped((s) => ({ ...s, [slot]: val }));
    if (val) {
      setFiles((f) => { const n = { ...f }; delete n[slot]; return n; });
      setFileErr((e) => ({ ...e, [slot]: undefined }));
    }
  }

  function buildDocs(): Record<SlotKey, DocMeta> {
    const out = {} as Record<SlotKey, DocMeta>;
    (["contract", "id", "bank", "income"] as SlotKey[]).forEach((s) => {
      const f = files[s];
      out[s] = f ? { present: true, skipped: false, name: f.name, size: f.size, type: f.type } : { present: false, skipped: !!skipped[s] };
    });
    return out;
  }

  async function submit() {
    // Hard requirement: contract + government ID (per spec — only bank + W-2 are skippable).
    const missing = REQUIRED_SLOTS.filter((s) => !files[s]);
    if (missing.length) {
      setFileErr((e) => { const n = { ...e }; missing.forEach((s) => (n[s] = "This document is required to submit.")); return n; });
      setSubmitMsg(`Please add your ${missing.map((s) => SLOT_LABEL[s]).join(" and ")} to continue.`);
      document.querySelector<HTMLElement>(`[data-slot="${missing[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitMsg("");
    setSubmitting(true);
    const data: ApplicationData = { ...travel, ...identity, ...household, documents: buildDocs() };
    saveApp(token, { invite: token, tenantEmail: invite?.tenantEmail ?? "", data, status: "submitted", submittedAt: new Date().toISOString() });
    if (invite) markStep(token, "application", "submitted");
    try {
      await captureApplication({ token, tenantEmail: invite?.tenantEmail ?? "", data, files });
    } catch {
      /* best-effort; localStorage already has it */
    }
    setSubmitted(data);
    setSubmitting(false);
    setStep("success");
  }

  const seg = SEG[step];

  return (
    <main className="app-main">
      <AppBar tag="Application" brandLink={false} />
      <div className="shell">
        {!chromeOff && (
          <div className="wiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={(seg ?? 0) + 1} aria-label="Application progress">
            {[0, 1, 2, 3].map((n) => (
              <span key={n} className={"wiz-progress__seg" + (n < (seg ?? 0) ? " is-done" : n === seg ? " is-active" : "")} />
            ))}
          </div>
        )}

        {step === "welcome" && <Welcome ctxLine={ctxLine} onStart={startApp} />}

        {step === "travel" && (
          <section className="step-body">
            <div className="step-head">
              <span className="kicker">About your move · 2A of 3</span>
              <h2 tabIndex={-1} data-active-heading>A few quick questions</h2>
              <p>This helps us tailor your Passport. Nothing here is a credit check.</p>
            </div>

            <Field label="Are you relocating for work or a business assignment?">
              <Choices name="traveling" value={travel.traveling} onChange={(v) => setTravel({ ...travel, traveling: v })}
                options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]} />
            </Field>

            {travel.traveling === "yes" && (
              <div className="reveal-block">
                <div className="field">
                  <label htmlFor="biz-domain">What field is the assignment in?</label>
                  <select className="select" id="biz-domain" value={travel.businessDomain} onChange={(e) => setTravel({ ...travel, businessDomain: e.target.value })}>
                    <option value="">Select a field…</option>
                    {["Healthcare", "Technology", "Engineering", "Education", "Finance", "Skilled trades", "Government", "Other"].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>

                {travel.businessDomain === "Healthcare" && (
                  <div className="field reveal-block">
                    <label htmlFor="facility">Where is your upcoming healthcare assignment?</label>
                    <input className="input" id="facility" placeholder="Hospital or facility name" autoComplete="off"
                      value={travel.facilityName} onChange={(e) => setTravel({ ...travel, facilityName: e.target.value })} />
                    <p className="field__hint">The hospital, clinic, or facility name on your placement.</p>
                  </div>
                )}

                <div className="field">
                  <span className="field__label">Tentative contract dates</span>
                  <div className="row-2">
                    <div>
                      <label htmlFor="c-start" className="field__hint" style={{ marginTop: 0, marginBottom: ".35rem", display: "block" }}>Start</label>
                      <input className="input" id="c-start" type="date" value={travel.contractStart} onChange={(e) => setTravel({ ...travel, contractStart: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="c-end" className="field__hint" style={{ marginTop: 0, marginBottom: ".35rem", display: "block" }}>End</label>
                      <input className="input" id="c-end" type="date" value={travel.contractEnd} onChange={(e) => setTravel({ ...travel, contractEnd: e.target.value })} />
                    </div>
                  </div>
                  {dateErr && <div className="field__error">{dateErr}</div>}
                </div>

                <Field label="What is your shift schedule?">
                  <Choices name="shift" value={travel.shift} onChange={(v) => setTravel({ ...travel, shift: v })}
                    options={[{ v: "Day", l: "Day" }, { v: "Night", l: "Night" }, { v: "Mid", l: "Mid" }]} />
                </Field>
              </div>
            )}
          </section>
        )}

        {step === "identity" && (
          <section className="step-body">
            <div className="step-head">
              <span className="kicker">Identity · 2B of 3</span>
              <h2 tabIndex={-1} data-active-heading>Let's confirm who you are</h2>
              <p>Matches the verification the property team runs. Your details are encrypted in transit.</p>
            </div>
            <div className="field">
              <label htmlFor="legal-name">Legal full name <span className="field__req">*</span></label>
              <input className="input" id="legal-name" autoComplete="name" placeholder="As it appears on your ID" aria-invalid={!!idErr.legalName}
                value={identity.legalName} onChange={(e) => setIdentity({ ...identity, legalName: e.target.value })} />
              {idErr.legalName && <div className="field__error">{idErr.legalName}</div>}
            </div>
            <div className="field">
              <label htmlFor="aliases">Any aliases or previous legal names?</label>
              <input className="input" id="aliases" autoComplete="off" placeholder="Maiden name, prior name… (or leave blank)"
                value={identity.aliases} onChange={(e) => setIdentity({ ...identity, aliases: e.target.value })} />
              <p className="field__hint">Helps the background check run thoroughly and accurately.</p>
            </div>
            <div className="field">
              <label htmlFor="dob">Date of birth <span className="field__req">*</span></label>
              <input className="input" id="dob" type="date" autoComplete="bday" aria-invalid={!!idErr.dob}
                value={identity.dob} onChange={(e) => setIdentity({ ...identity, dob: e.target.value })} />
              {idErr.dob && <div className="field__error">{idErr.dob}</div>}
            </div>
            <div className="field">
              <label htmlFor="tax-home">Permanent tax home address <span className="field__req">*</span></label>
              <textarea className="textarea" id="tax-home" autoComplete="street-address" placeholder="Street, city, state, ZIP" aria-invalid={!!idErr.taxHome}
                value={identity.taxHome} onChange={(e) => setIdentity({ ...identity, taxHome: e.target.value })} />
              <p className="field__hint">Confirms you qualify for tax-free stipends on a travel assignment.</p>
              {idErr.taxHome && <div className="field__error">{idErr.taxHome}</div>}
            </div>
          </section>
        )}

        {step === "household" && (
          <section className="step-body">
            <div className="step-head">
              <span className="kicker">Household · 2C of 3</span>
              <h2 tabIndex={-1} data-active-heading>Who's coming with you?</h2>
              <p>So the property team can match you to the right unit.</p>
            </div>
            <Field label="Who is traveling with you?">
              <Choices grid name="household" value={household.household} onChange={(v) => setHousehold({ ...household, household: v })}
                options={[{ v: "Solo", l: "Just me" }, { v: "Partner", l: "Partner" }, { v: "Coworker", l: "Coworker" }, { v: "Family", l: "Family" }]} />
            </Field>
            <Field label="Any pets joining you?">
              <Choices name="pets" value={household.pets} onChange={(v) => setHousehold({ ...household, pets: v })}
                options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]} />
            </Field>
            <Field label="Bringing a vehicle that needs parking?">
              <Choices name="vehicle" value={household.vehicle} onChange={(v) => setHousehold({ ...household, vehicle: v })}
                options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]} />
            </Field>
          </section>
        )}

        {step === "uploads" && (
          <section className="step-body">
            <div className="step-head">
              <span className="kicker">Verification hub</span>
              <h2 tabIndex={-1} data-active-heading>Add your documents</h2>
              <p>Your contract and photo ID are required. You can skip the bank statement and W-2 for now and add them later.</p>
            </div>

            {submitMsg && (
              <div className="notice notice--danger" style={{ marginBottom: "1rem" }}>
                <Info /><span>{submitMsg}</span>
              </div>
            )}

            <div className="uploads">
              <UploadSlot slot="contract" kind="document" title="Travel / job contract" subtitle="Your signed agency agreement or placement letter." icon={<DocIcon />} required file={files.contract} skipped={!!skipped.contract} error={fileErr.contract} onSelect={onSelect} onRemove={onRemove} />
              <UploadSlot slot="id" kind="id" title="Government photo ID" subtitle="Driver's license or passport." icon={<IdIcon />} required file={files.id} skipped={!!skipped.id} error={fileErr.id} onSelect={onSelect} onRemove={onRemove} />
              <UploadSlot slot="bank" kind="document" title="Proof of liquidity" subtitle="First page of your most recent bank statement." icon={<BankIcon />} skippable file={files.bank} skipped={!!skipped.bank} error={fileErr.bank} onSelect={onSelect} onRemove={onRemove} onSkip={onSkip} />
              <UploadSlot slot="income" kind="document" title="Historical income" subtitle="Your most recent W-2 or last two paystubs." icon={<IncomeIcon />} skippable file={files.income} skipped={!!skipped.income} error={fileErr.income} onSelect={onSelect} onRemove={onRemove} onSkip={onSkip} />
            </div>

            <div className="notice notice--spark" style={{ marginTop: "1.1rem" }}>
              <Shield /><span>Files are checked for type and size, then stored securely in your private folder. We never share them without your consent.</span>
            </div>
          </section>
        )}

        {step === "success" && <Success data={submitted} invite={invite} token={token} />}

        {!chromeOff && (
          <>
            <div className="step-actions">
              {ORDER.indexOf(step) > 1 && (
                <button className="btn btn--ghost btn--icon" onClick={back} aria-label="Go back"><ArrowLeft /></button>
              )}
              <button className={"btn " + (step === "uploads" ? "btn--spark" : "btn--primary")} onClick={next} disabled={submitting}>
                {submitting ? "Submitting…" : step === "uploads" ? "Submit application" : "Continue"}
                {!submitting && <ArrowRight className="arrow" />}
              </button>
            </div>
            <div className="trust-line"><Shield /> Encrypted in transit · You control your data</div>
          </>
        )}
      </div>
    </main>
  );
}

/* ---- welcome (5s auto-advance + loading bar; reduced-motion = manual) ---- */
function Welcome({ ctxLine, onStart }: { ctxLine: string; onStart: () => void }) {
  const timer = useRef<number | undefined>(undefined);
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (reduce) { setHint("Tap “Create My Passport” to begin."); return; }
    setHint("Starting automatically in a moment…");
    timer.current = window.setTimeout(onStart, 5000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [onStart]);

  function cancel(e: React.SyntheticEvent) {
    if (reduce || paused) return;
    if ((e.target as HTMLElement).closest?.("#start-btn")) return;
    if (timer.current) clearTimeout(timer.current);
    setPaused(true);
    setHint("Take your time — tap Create My Passport when you're ready.");
  }

  return (
    <div className="welcome" onPointerDownCapture={cancel} onKeyDownCapture={cancel} onWheelCapture={cancel}>
      <div className="welcome__seal"><Shield /></div>
      <span className="kicker">{ctxLine}</span>
      <h1>Let's build your <em>verified Renter Passport.</em></h1>
      <p>This takes about 3 minutes and packages your application perfectly for the property team.</p>
      <button id="start-btn" className="btn btn--primary" style={{ alignSelf: "center", padding: "1rem 1.8rem", fontSize: "1.05rem" }} onClick={onStart}>
        Create My Passport <ArrowRight className="arrow" />
      </button>
      <div className={"loadbar" + (reduce ? "" : " is-running") + (paused ? " is-paused" : "")}><span className="loadbar__fill" /></div>
      <p className="welcome__hint">{hint}</p>
    </div>
  );
}

/* ---- success ---- */
function Success({ data, invite, token }: { data: ApplicationData | null; invite: ReturnType<typeof getInvite>; token: string }) {
  const docs = data?.documents;
  const rows: [string, boolean, string][] = [["Applicant", true, data?.legalName || "—"]];
  const names: [SlotKey, string][] = [["contract", "Job contract"], ["id", "Photo ID"], ["bank", "Bank statement"], ["income", "Income"]];
  names.forEach(([k, label]) => {
    const d = docs?.[k];
    rows.push([label, !!d?.present, d?.present ? "Received" : d?.skipped ? "Skipped" : "Pending"]);
  });

  return (
    <section className="success">
      <div className="success__seal"><ShieldCheck /></div>
      <h1>Passport Secured!</h1>
      <p>Your Renter Passport has been compiled. We're verifying your details and will connect you with the property team shortly.</p>
      <div className="success__receipt" aria-label="Submission summary">
        {rows.map(([label, ok, note], i) => (
          <div className="row" key={i}><span>{label}</span><b className={ok ? "ok" : ""}>{note}</b></div>
        ))}
      </div>
      {invite?.steps.lease?.requested && (
        <div style={{ marginTop: ".4rem" }}>
          <Link className="btn btn--spark" to={`/lease?invite=${encodeURIComponent(token)}`} style={{ justifyContent: "center" }}>
            Continue to your lease <ArrowRight className="arrow" />
          </Link>
        </div>
      )}
    </section>
  );
}

/* ---- small field helpers ---- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {children}
    </div>
  );
}
function Choices({ name, value, onChange, options, grid }: { name: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; grid?: boolean }) {
  return (
    <div className={"choices" + (grid ? " choices--grid" : "")} role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <label className="choice" key={o.v}>
          <input type="radio" name={name} value={o.v} checked={value === o.v} onChange={() => onChange(o.v)} />
          <span className="choice__face">{o.l}</span>
        </label>
      ))}
    </div>
  );
}
