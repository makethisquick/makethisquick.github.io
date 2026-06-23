# Renter Passport

A mobile-first tenant application store layered onto the MakeThisQuick site.
A landlord invites a tenant; the tenant builds a verified **Renter Passport**
(application + documents) and e-signs a **lease**.

Built hand-rolled and dependency-free, reusing the site design system
(`assets/css/site.css`).

## Pages

| File | Who | What |
|---|---|---|
| `app/index.html` | Landlord | Create invites, copy private links, track status |
| `app/apply.html` | Tenant | 4-step application wizard (welcome → Q&A → uploads → done) |
| `app/lease.html` | Tenant | Review + e-sign the lease (BOX Sign) |
| `app/__forms.html` | — | Hidden Netlify Forms detection stub (never linked) |

Shared runtime: `app/assets/app.js` (`window.RP`), styles in `app/assets/app.css`.
Per-page controllers: `landlord.js`, `apply.js`, `lease.js`.

## The flow

1. **Landlord** fills in tenant name/email + which steps to request → gets a
   private link like `/app/apply.html?invite=<token>`.
2. **Tenant** opens it:
   - **Welcome** — auto-advances after 5s (or tap *Create My Passport*).
   - **Q&A** — 3 short screens: travel/business (conditional on field →
     healthcare asks for the facility), identity/KYC, household.
   - **Uploads** — contract, photo ID, bank statement (skippable), income
     (skippable). Each file is type/size/magic-byte checked.
   - **Success** — *Passport Secured!* then optionally on to the lease.
3. **Lease** — consent → embedded BOX Sign → *Lease signed!*

## Storage (no database yet)

| Data | Where | Notes |
|---|---|---|
| Invites + status | `localStorage` (`mtq_rentpass_*`) | Per-browser for now |
| Application answers | `localStorage` **and** Netlify Forms | Netlify = server-side capture, no DB |
| Uploaded files | **BOX** (per-tenant folder) once configured | Falls back to metadata-only locally |
| Signed lease | **BOX Sign** once configured | Falls back to simulated signing |

See [`../BOX-INTEGRATION.md`](../BOX-INTEGRATION.md) to turn on real BOX storage
and e-signature.

## Run locally

```bash
# static only (no functions): any static server works
python3 -m http.server 8080      # → http://localhost:8080/app/

# with functions (BOX): requires the Netlify CLI
cd netlify/functions && npm install && cd ../..
npx netlify dev                  # → http://localhost:8888/app/
```

## Deploy (Netlify)

The repo is already static. `netlify.toml` sets `publish = "."`, wires the
functions dir, and adds security headers. Push to the connected repo (or
`npx netlify deploy --prod`). Set the BOX env vars per `BOX-INTEGRATION.md`.

> GitHub Pages can host the **static** pages but **cannot run the functions** —
> use Netlify for the BOX features.

## Security

- File uploads are validated in the browser **and** re-validated server-side in
  `box-upload` (extension + MIME allowlist + magic bytes + 10 MB cap). Allowed:
  PDF, JPEG, PNG, HEIC/HEIF.
- Tokens are generated with `crypto.getRandomValues`, never `Math.random`.
- App pages are `noindex`; BOX secrets stay in Netlify env (server-side only).

## Known limitations (next iterations)

- **No auth / no cross-device sync.** Invites live in the landlord's browser.
  Real multi-device use needs a backend (Supabase, Netlify Blobs, Firestore,
  DynamoDB…) keyed by invite token, plus a login for the landlord panel.
- **Invite token is the only gate** on the tenant flow. Fine for a prototype;
  before real PII, add per-invite authorization + expiry server-side.
- **Email delivery** isn't wired — the landlord copies the link manually. Add an
  email function (Resend/SendGrid/Netlify email) to send invites automatically.
