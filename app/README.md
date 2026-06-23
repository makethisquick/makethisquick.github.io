# Renter Passport

A mobile-first tenant application + lease app. A landlord invites a tenant; the
tenant builds a verified **Renter Passport** (application + documents) and
e-signs a **lease**.

Built with **Vite + React + TypeScript**, deployed as **its own Netlify site**.
The marketing site (makethisquick.com) is a separate, untouched deploy. The
design system (cobalt + blueprint grid + amber spark; Bricolage / Inter / Space
Mono) is self-contained in `src/index.css`.

> A fully-working dependency-free vanilla version is preserved at
> `../reference/rentpass-vanilla/` — it was the locked spec for this port.

## Routes

| Path | Who | What |
|---|---|---|
| `/` | Landlord | Create invites, copy **per-step direct links** (+ QR), track status |
| `/apply?invite=<token>` | Tenant | Welcome → Q&A (2A/2B/2C) → uploads → done |
| `/lease?invite=<token>` | Tenant | Consent → BOX Sign embed → signed |

`src/lib` holds the store (localStorage), validation (file magic-byte guard),
and the BOX adapter. `src/components` holds shared UI; `src/routes` the screens.

## Invite links (no "send" feature needed)

Every invite renders a **direct link per requested step** — Application and Lease
each get their own copyable URL, an **Open** button, and a **QR** (generated
locally so the tokenized URL never leaves the device). Share the link any way you
like; no email integration required.

## Storage (no database yet)

| Data | Where | Notes |
|---|---|---|
| Invites + status | `localStorage` (`mtq_rentpass_*`) | Per-browser for now |
| Application answers | `localStorage` **and** Netlify Forms | Netlify = server capture, no DB |
| Uploaded files | **BOX** per-tenant folder once configured | Falls back to metadata-only |
| Signed lease | **BOX Sign** once configured | Falls back to simulated signing |

See [`BOX-INTEGRATION.md`](BOX-INTEGRATION.md) to turn on real BOX storage + e-sign.

## Develop

```bash
cd app
npm install
npm run dev          # http://localhost:5180
npm run build        # typecheck + production build to dist/
npm run preview      # serve the built app

# with BOX functions (needs the Netlify CLI):
npx netlify dev      # serves the app + functions
```

## Deploy (its own Netlify site)

1. New Netlify site from this repo.
2. **Base directory:** `app`
3. **Build command:** `npm run build` · **Publish directory:** `app/dist`
   (Netlify reads these from `app/netlify.toml` once base = `app`.)
4. Functions deploy automatically from `app/netlify/functions`.
5. Set the BOX env vars per `BOX-INTEGRATION.md`. Point a subdomain
   (e.g. `app.makethisquick.com`) at the site if you want.

The marketing site keeps its own separate deploy — nothing here touches it.

## Review fixes baked in

This build incorporates the adversarial review of the prototype:
- **postMessage origin check** on the BOX Sign iframe (no forged "signed").
- Lease fallback simulates **only** on 404/501; real errors surface.
- **Contract + government ID are required** to submit (hard block, not a prompt).
- 44px tap targets, focus-visible on the upload control, readable status text,
  sticky bar clearance, reduced-motion = manual welcome advance.
- Server-side: HEIC brand-byte check, bounded busboy limits, early 413 on
  oversized bodies, simplified BOX upload response handling.

## Known limitations (next iterations)

- **No auth / no cross-device sync.** Invites live in the landlord's browser.
  Add a backend (Supabase / Netlify Blobs / Firestore) keyed by invite token,
  plus a landlord login.
- **Invite token is the only gate.** Add per-invite authorization + expiry
  server-side before real PII traffic.
- **Email delivery** isn't wired — share the direct link. Add an email function
  (Resend / SendGrid) to auto-send invites.
