import type { Invite, StepKey, StepStatus, AppRecord } from "./types";

/* No database yet: invites + drafts live in localStorage. Submissions also
   post to Netlify Forms (server capture) and files route to BOX once configured. */

const NS = "mtq_rentpass_";
const KEYS = {
  invites: NS + "invites",
  apps: NS + "applications",
};

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* quota / private mode — non-fatal for the prototype */
  }
}

/* URL-safe token from the crypto RNG (never Math.random for identifiers). */
export function token(len = 20): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += abc[bytes[i] % abc.length];
  return s;
}

export function allInvites(): Invite[] {
  return read<Invite[]>(KEYS.invites, []);
}
function saveInvites(list: Invite[]): void {
  write(KEYS.invites, list);
}

export function getInvite(tok: string): Invite | null {
  return allInvites().find((i) => i.token === tok) ?? null;
}

export interface CreateInviteInput {
  tenantName: string;
  tenantEmail: string;
  property?: string;
  application: boolean;
  lease: boolean;
}

export function createInvite(data: CreateInviteInput): Invite {
  const list = allInvites();
  const inv: Invite = {
    id: "inv_" + token(14),
    token: token(20),
    tenantName: data.tenantName.trim(),
    tenantEmail: data.tenantEmail.trim().toLowerCase(),
    property: (data.property ?? "").trim(),
    steps: {
      application: { requested: !!data.application, status: "pending", submittedAt: null },
      lease: { requested: !!data.lease, status: "pending", submittedAt: null },
    },
    createdAt: new Date().toISOString(),
  };
  list.unshift(inv);
  saveInvites(list);
  return inv;
}

export function updateInvite(tok: string, mutate: (inv: Invite) => void): Invite | null {
  const list = allInvites();
  const idx = list.findIndex((i) => i.token === tok);
  if (idx < 0) return null;
  mutate(list[idx]);
  saveInvites(list);
  return list[idx];
}

export function removeInvite(id: string): void {
  saveInvites(allInvites().filter((i) => i.id !== id));
}

export function markStep(tok: string, step: StepKey, status: StepStatus): Invite | null {
  return updateInvite(tok, (inv) => {
    const s = inv.steps[step];
    if (!s) return;
    s.status = status;
    if (status === "submitted") s.submittedAt = new Date().toISOString();
  });
}

/* ---- application drafts / submissions ---- */
export function getApp(tok: string): AppRecord | null {
  const all = read<Record<string, AppRecord>>(KEYS.apps, {});
  return all[tok] ?? null;
}
export function saveApp(tok: string, patch: Partial<AppRecord>): AppRecord {
  const all = read<Record<string, AppRecord>>(KEYS.apps, {});
  const merged = { ...(all[tok] ?? {}), ...patch, updatedAt: new Date().toISOString() } as AppRecord;
  all[tok] = merged;
  write(KEYS.apps, all);
  return merged;
}

/* ---- links (absolute, host-agnostic) ---- */
export function appOrigin(): string {
  return location.origin;
}
export function applyLink(tok: string): string {
  return `${appOrigin()}/apply?invite=${encodeURIComponent(tok)}`;
}
export function leaseLink(tok: string): string {
  return `${appOrigin()}/lease?invite=${encodeURIComponent(tok)}`;
}
