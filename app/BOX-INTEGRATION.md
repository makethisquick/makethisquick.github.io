# BOX integration — what I need from you

The Renter Passport app already calls BOX through two Netlify Functions. They
**degrade gracefully**: until BOX is configured they return `501`, and the
front-end falls back to local capture so everything is still testable. To go
live, give me (or set yourself) the items below.

---

## 1. A BOX app (one-time)

1. Go to the [BOX Developer Console](https://app.box.com/developers/console) →
   **Create Platform App** → **Custom App**.
2. Pick an auth method:
   - **Server Authentication (with JWT)** — recommended. Most robust for
     unattended server-to-server uploads.
   - **Client Credentials Grant (CCG)** — simpler, also fine.
3. Under the app's **Configuration**:
   - **Application Scopes:** check **Read and write all files and folders**.
   - For e-signing, also enable **Manage Sign Requests** (BOX Sign).
   - **App Access Level:** *App + Enterprise Access*.
4. **Authorize the app**: an admin must approve it under
   **Admin Console → Apps → Custom Apps Manager → Authorize** using the app's
   **Client ID**. (Nothing works until this approval happens.)

### If you chose JWT
- In the app config, **Generate a Public/Private Keypair**. BOX downloads a
  `*_config.json`. That's all I need.

### If you chose CCG
- Copy the **Client ID**, **Client Secret**, and your **Enterprise ID**
  (Admin Console → Account & Billing).

---

## 2. A root folder for applications

- In BOX, create a folder, e.g. **`Renter Passport / Applications`**.
- Open it and copy the **Folder ID** from the URL
  (`https://app.box.com/folder/<THIS_NUMBER>`).
- If you used JWT, the app authenticates as a **service account**
  (`AutomationUser_…@boxdevedu`). **Invite that service account as a
  co-owner/editor** of this folder, or create the folder *as* that user, so it
  has somewhere to write. (CCG service accounts have their own root; sharing the
  folder is still the cleanest setup.)

The function creates **one subfolder per tenant**, named from their email
(sanitized), e.g. `maya.chen@email.com` → `maya.chen_email.com`. Files inside are
named `slot__timestamp__originalname` (e.g. `id__2026-06-22T18-04-…__license.jpg`),
so each tenant's folder is self-explanatory and searchable.

---

## 3. (For the lease) a BOX Sign template

- Upload your blank lease to BOX and copy its **File ID**.
- Set it as `BOX_LEASE_TEMPLATE_FILE_ID`. The function copies it into the
  tenant's folder, adds them as an **embedded signer**, and returns an
  `iframeable_embed_url` that `lease.html` displays in an iframe.
- BOX Sign **embedded signing** must be enabled for your enterprise (it is by
  default on most Business+ plans; confirm in Admin Console if the call 4xxs).

---

## 4. Netlify environment variables

Set these in **Netlify → Site settings → Environment variables**:

| Variable | Needed for | Value |
|---|---|---|
| `BOX_ROOT_FOLDER_ID` | uploads + sign | Folder ID from step 2 |
| `BOX_CONFIG_JSON` | JWT auth | **base64** of the downloaded `*_config.json` |
| `BOX_CLIENT_ID` | CCG auth | from the app |
| `BOX_CLIENT_SECRET` | CCG auth | from the app |
| `BOX_ENTERPRISE_ID` | CCG auth | your enterprise id |
| `BOX_LEASE_TEMPLATE_FILE_ID` | lease e-sign | File ID from step 3 |
| `BOX_WEBHOOK_PRIMARY_KEY` | webhook (optional) | from BOX webhook config |
| `BOX_WEBHOOK_SECONDARY_KEY` | webhook (optional) | from BOX webhook config |

> Use **either** `BOX_CONFIG_JSON` (JWT) **or** the three CCG vars — not both.

To base64 the JWT config on macOS:

```bash
base64 -i 12345_abcde_config.json | tr -d '\n' | pbcopy   # now paste into Netlify
```

---

## 5. Install the function dependencies

The functions use `box-node-sdk` and `busboy`. Netlify installs them
automatically from the app's `package.json` (`box-node-sdk`, `busboy`) at deploy
time — Netlify's base directory is `app`. To run locally:

```bash
cd app && npm install
npx netlify dev      # serves the app + functions at :8888
```

### Large files (Netlify limit)

Netlify **synchronous** functions cap the request body at ~6 MB and run up to 10s.
That comfortably covers IDs and statement pages. If you need to accept files up to
the 10 MB client cap, switch to a **pre-authorized direct-to-BOX upload**: add a
small function that returns a BOX upload URL/token, and have the browser PUT the
file straight to BOX (bypassing Netlify's body limit). Wire it into
`src/lib/box.ts` → `captureApplication`.

---

## 6. (Optional) the completion webhook

To flip the landlord's "Lease signed" status automatically:

1. BOX Developer Console → your app → **Webhooks** (or BOX Sign notifications).
2. Add a webhook to `https://<your-site>/.netlify/functions/box-sign-webhook`
   for the **Sign Request completed** trigger.
3. Copy the primary/secondary signature keys into the env vars above.

---

## How the fallback behaves today (no BOX yet)

- `box-upload` / `box-sign` return **501** → the wizard validates files
  client-side, records their metadata, and posts the text answers to
  **Netlify Forms** (server-side capture, visible in the Netlify dashboard).
- The lease page **simulates** signing and marks the step complete locally.

Once the env vars above are present, the same code paths light up for real —
no front-end changes needed.

---

## Security notes (already implemented)

- Files are validated **twice**: in the browser (extension + MIME + magic-byte
  sniff + 10 MB cap) and **again on the server** in `box-upload` before anything
  touches BOX. The server check is the real boundary.
- Allowed types: **PDF, JPEG, PNG, HEIC/HEIF** only. No executables, no SVG, no
  arbitrary types.
- Secrets live only in Netlify env vars and are read server-side; nothing
  BOX-related is exposed to the browser.
- The lease page only accepts a "signing complete" `postMessage` from
  `https://app.box.com` (`BOX_EMBED_ORIGIN` in `src/lib/box.ts`) — a forged
  message from another origin can't mark a lease signed. If your enterprise's
  BOX Sign embed posts from a different host, update that constant.
- App pages are `noindex` and sit behind their own headers in `netlify.toml`.

> **Still to harden before real PII traffic:** add authentication to the
> landlord panel and tie invites to a database with per-invite authorization
> (see `app/README.md` → *Known limitations*). The current prototype trusts the
> invite token alone.
