import type { ApplicationData, SlotKey } from "./types";

/* BOX adapter seam. Tries the Netlify Functions; off-Netlify or when BOX is
   unconfigured (404/501) callers fall back. See BOX-INTEGRATION.md. */

const UPLOAD = "/.netlify/functions/box-upload";
const SIGN = "/.netlify/functions/box-sign";

/* Origin that BOX Sign's embedded iframe posts completion messages from.
   Used to validate window 'message' events (never trust an unchecked origin). */
export const BOX_EMBED_ORIGIN = "https://app.box.com";

export class BoxNotConfiguredError extends Error {
  constructor() {
    super("not-configured");
    this.name = "BoxNotConfiguredError";
  }
}

/* Best-effort capture with no database: Netlify Forms (text answers) + BOX (files).
   Each request fails silently so a flaky network never blocks the applicant. */
export async function captureApplication(opts: {
  token: string;
  tenantEmail: string;
  data: ApplicationData;
  files: Partial<Record<SlotKey, File>>;
}): Promise<void> {
  const { token, tenantEmail, data, files } = opts;

  const body = new URLSearchParams();
  body.set("form-name", "renter-application");
  body.set("invite", token);
  body.set("tenantEmail", tenantEmail);
  (Object.keys(data) as (keyof ApplicationData)[]).forEach((k) => {
    if (k === "documents") body.set("documents", JSON.stringify(data.documents));
    else body.set(k, String(data[k] ?? ""));
  });

  const jobs: Promise<unknown>[] = [
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }).catch(() => undefined),
  ];

  const email = tenantEmail || data.legalName || "applicant";
  (Object.entries(files) as [SlotKey, File | undefined][]).forEach(([slot, file]) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("invite", token);
    fd.append("email", email);
    fd.append("slot", slot);
    fd.append("file", file, file.name);
    jobs.push(fetch(UPLOAD, { method: "POST", body: fd }).catch(() => undefined));
  });

  await Promise.all(jobs);
}

export interface SignSession {
  embedUrl: string;
  signRequestId?: string;
}

/* Throws BoxNotConfiguredError on 404/501 (caller simulates), a real Error on
   anything else (caller surfaces it — never a false "signed"). */
export async function requestSignSession(opts: { token: string; email: string }): Promise<SignSession> {
  const r = await fetch(SIGN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invite: opts.token, email: opts.email }),
  });
  if (r.status === 404 || r.status === 501) throw new BoxNotConfiguredError();
  if (!r.ok) throw new Error("Could not start signing (" + r.status + ").");
  return (await r.json()) as SignSession;
}
