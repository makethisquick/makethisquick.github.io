import { useState } from "react";
import { Link } from "react-router-dom";
import { AppBar } from "../components/AppBar";
import { toast, copyText } from "../components/Toast";
import { QrModal } from "../components/QrModal";
import {
  allInvites,
  createInvite,
  removeInvite,
  markStep,
  applyLink,
  leaseLink,
} from "../lib/store";
import { isEmail } from "../lib/validation";
import type { Invite, StepKey, StepStatus } from "../lib/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Trash,
  Person,
  DocIcon,
  Info,
  Link as LinkIcon,
  QrIcon,
} from "../components/icons";

const BADGE: Record<StepStatus, [string, string]> = {
  pending: ["badge--pending", "Not started"],
  sent: ["badge--sent", "Link opened"],
  submitted: ["badge--done", "Complete"],
};

const SAMPLES = [
  { tenantName: "Maya Chen", tenantEmail: "maya.chen@email.com", property: "1420 Maple Ave, Unit 3B", application: true, lease: true },
  { tenantName: "Devon Brooks", tenantEmail: "devon.b@email.com", property: "88 Harbor St", application: true, lease: false },
];

interface FormState {
  tenantName: string;
  tenantEmail: string;
  property: string;
  application: boolean;
  lease: boolean;
}
const EMPTY: FormState = { tenantName: "", tenantEmail: "", property: "", application: true, lease: true };

export default function Landlord() {
  const [invites, setInvites] = useState<Invite[]>(() => allInvites());
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<{ name?: string; email?: string; steps?: string }>({});
  const [qr, setQr] = useState<{ url: string; label: string } | null>(null);

  const refresh = () => setInvites(allInvites());

  const appsIn = invites.filter((i) => i.steps.application.requested && i.steps.application.status === "submitted").length;
  const leasesIn = invites.filter((i) => i.steps.lease.requested && i.steps.lease.status === "submitted").length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.tenantName.trim()) next.name = "Enter the tenant's name.";
    if (!isEmail(form.tenantEmail)) next.email = "Enter a valid email address.";
    if (!form.application && !form.lease) next.steps = "Pick at least one step to request.";
    setErrors(next);
    if (Object.keys(next).length) return;

    createInvite(form);
    setForm(EMPTY);
    refresh();
    toast("Invite created");
  }

  function share(url: string, tok: string, step: StepKey) {
    copyText(url)
      .then(() => {
        markStep(tok, step, "sent");
        refresh();
        toast("Link copied");
      })
      .catch(() => toast("Copy failed — long-press the link"));
  }

  function del(inv: Invite) {
    if (confirm(`Delete the invite for ${inv.tenantName || "this tenant"}?`)) {
      removeInvite(inv.id);
      refresh();
    }
  }

  return (
    <main className="app-main">
      <AppBar tag="Landlord panel" brandLink={false} />
      <div className="shell shell--wide">
        <div className="panel-head">
          <div>
            <span className="kicker">Verified renter onboarding</span>
            <h1 style={{ marginTop: ".6rem" }}>Invite a tenant</h1>
            <p>Send a private link. Your tenant builds a verified Renter Passport — application and lease — in a few guided minutes.</p>
          </div>
          <a className="btn btn--ghost btn--sm" href="https://makethisquick.com" target="_blank" rel="noopener">
            <ArrowLeft /> MakeThisQuick
          </a>
        </div>

        <div className="stat-row" aria-label="Invite summary">
          <div className="stat-box"><b>{invites.length}</b><span>Invites sent</span></div>
          <div className="stat-box"><b>{appsIn}</b><span>Applications in</span></div>
          <div className="stat-box"><b>{leasesIn}</b><span>Leases signed</span></div>
        </div>

        <div className="app-grid">
          {/* create */}
          <section className="card card--raised" aria-labelledby="new-h">
            <h2 id="new-h" style={{ fontFamily: "var(--display)", fontSize: "1.2rem", marginBottom: "1.1rem" }}>New invite</h2>
            <form onSubmit={submit} noValidate>
              <div className="field">
                <label htmlFor="t-name">Tenant name <span className="field__req">*</span></label>
                <input className="input" id="t-name" autoComplete="name" placeholder="Jordan Rivera" value={form.tenantName}
                  aria-invalid={!!errors.name}
                  onChange={(e) => setForm({ ...form, tenantName: e.target.value })} />
                {errors.name && <div className="field__error">{errors.name}</div>}
              </div>
              <div className="field">
                <label htmlFor="t-email">Tenant email <span className="field__req">*</span></label>
                <input className="input" id="t-email" type="email" inputMode="email" autoComplete="email" placeholder="jordan@email.com" value={form.tenantEmail}
                  aria-invalid={!!errors.email}
                  onChange={(e) => setForm({ ...form, tenantEmail: e.target.value })} />
                {errors.email && <div className="field__error">{errors.email}</div>}
              </div>
              <div className="field">
                <label htmlFor="t-prop">Property / unit <span className="muted">(optional)</span></label>
                <input className="input" id="t-prop" placeholder="1420 Maple Ave, Unit 3B" value={form.property}
                  onChange={(e) => setForm({ ...form, property: e.target.value })} />
              </div>

              <div className="field">
                <span className="field__label">Request these steps</span>
                <label className="check-row">
                  <input type="checkbox" checked={form.application} onChange={(e) => setForm({ ...form, application: e.target.checked })} />
                  <span className="box"><Check /></span>
                  <span className="meta"><b>Application</b><small>Renter Passport — identity, history &amp; documents</small></span>
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={form.lease} onChange={(e) => setForm({ ...form, lease: e.target.checked })} />
                  <span className="box"><Check /></span>
                  <span className="meta"><b>Lease</b><small>Review &amp; e-sign the lease agreement</small></span>
                </label>
                {errors.steps && <div className="field__error">{errors.steps}</div>}
              </div>

              <button type="submit" className="btn btn--primary" style={{ width: "100%", marginTop: ".4rem" }}>
                Create invite <ArrowRight className="arrow" />
              </button>
            </form>

            <div className="notice" style={{ marginTop: "1.1rem" }}>
              <Info />
              <span>Prototype storage: invites live in <b>this browser</b> for now. Submissions are also captured server-side via Netlify Forms. Add a database to sync across devices — see the README.</span>
            </div>
          </section>

          {/* list */}
          <section aria-labelledby="list-h">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
              <h2 id="list-h" style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Your invites</h2>
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => { SAMPLES.forEach(createInvite); refresh(); toast("Sample invites added"); }}>
                Add sample
              </button>
            </div>

            {invites.length === 0 ? (
              <div className="empty">
                <DocIcon />
                <b>No invites yet</b>
                Create your first invite on the left, then share the private link with your tenant.
              </div>
            ) : (
              <div className="invite-list">
                {invites.map((inv) => (
                  <InviteCard key={inv.id} inv={inv} onShare={share} onQr={setQr} onDelete={del} />
                ))}
              </div>
            )}
          </section>
        </div>

        <footer style={{ marginTop: "auto", paddingTop: "2.5rem" }}>
          <p className="mono" style={{ fontSize: ".72rem", color: "var(--muted-2)" }}>
            © {new Date().getFullYear()} MakeThisQuick LLC · Renter Passport · <Link to="/apply" style={{ color: "var(--cobalt-2)" }}>preview the tenant flow</Link>
          </p>
        </footer>
      </div>

      {qr && <QrModal url={qr.url} label={qr.label} onClose={() => setQr(null)} />}
    </main>
  );
}

function InviteCard({
  inv,
  onShare,
  onQr,
  onDelete,
}: {
  inv: Invite;
  onShare: (url: string, tok: string, step: StepKey) => void;
  onQr: (q: { url: string; label: string }) => void;
  onDelete: (inv: Invite) => void;
}) {
  const links: { step: StepKey; label: string; url: string; icon: JSX.Element }[] = [];
  if (inv.steps.application.requested) links.push({ step: "application", label: "Application link", url: applyLink(inv.token), icon: <Person /> });
  if (inv.steps.lease.requested) links.push({ step: "lease", label: "Lease link", url: leaseLink(inv.token), icon: <DocIcon /> });

  return (
    <article className="invite">
      <div className="invite__top">
        <div className="invite__who">
          <b>{inv.tenantName || "Unnamed tenant"}</b>
          <small>{inv.tenantEmail}</small>
          {inv.property && <small>{inv.property}</small>}
        </div>
        <button className="btn btn--icon btn--danger-ghost btn--sm" title="Delete invite" aria-label="Delete invite" onClick={() => onDelete(inv)}>
          <Trash />
        </button>
      </div>

      <div className="invite__steps">
        {(["application", "lease"] as StepKey[]).filter((s) => inv.steps[s].requested).map((s) => {
          const [cls, label] = BADGE[inv.steps[s].status];
          return (
            <div className="invite__step" key={s}>
              {s === "lease" ? <DocIcon /> : <Person />}
              <span className="lbl">{s === "lease" ? "Lease" : "Application"}</span>
              <span className={`badge ${cls}`}>{label}</span>
            </div>
          );
        })}
      </div>

      {links.map((l) => (
        <div key={l.step}>
          <div className="linkrow">
            <div className="linkrow__url">
              <LinkIcon style={{ width: 14, height: 14, color: "var(--muted-2)", flex: "none" }} />
              <span className="url">{l.url.replace(/^https?:\/\//, "")}</span>
            </div>
          </div>
          <div className="invite__actions">
            <span className="kicker" style={{ alignSelf: "center", marginRight: "auto" }}>{l.label}</span>
            <button className="btn btn--primary btn--sm" onClick={() => onShare(l.url, inv.token, l.step)}>Copy</button>
            <button className="btn btn--ghost btn--icon btn--sm" aria-label={`QR code for ${l.label}`} title="Show QR" onClick={() => onQr({ url: l.url, label: l.label })}><QrIcon /></button>
            <a className="btn btn--ghost btn--sm" href={l.url} target="_blank" rel="noopener">Open</a>
          </div>
        </div>
      ))}
    </article>
  );
}
