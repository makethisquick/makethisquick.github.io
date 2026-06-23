/* Client-side file guard. This is UX, not the security boundary — the
   Netlify Function (box-upload) re-validates server-side. We enforce here:
   extension allowlist + declared MIME allowlist + size cap + magic-byte sniff
   (so a spoofed extension is rejected). */

export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export type FileKind = "document" | "id";

interface Policy {
  ext: string[];
  mime: string[];
}
export const POLICY: Record<FileKind, Policy> = {
  document: {
    ext: ["pdf", "jpg", "jpeg", "png", "heic", "heif"],
    mime: ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"],
  },
  id: {
    ext: ["jpg", "jpeg", "png", "heic", "heif", "pdf"],
    mime: ["image/jpeg", "image/png", "image/heic", "image/heif", "application/pdf"],
  },
};

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function ext(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "";
}

/* HEIC/HEIF brand codes that may appear at offset 8. */
const HEIF_BRANDS = ["heic", "heix", "heif", "hevc", "mif1", "msf1"];

function sniff(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf);
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf"; // %PDF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  // ISO-BMFF: 'ftyp' at offset 4, brand at offset 8 — only accept HEIF brands.
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (HEIF_BRANDS.includes(brand)) return "image/heic";
  }
  return null;
}

export interface ValidateResult {
  ok: boolean;
  reason: string;
  detected?: string;
}

export function validateFile(file: File, kind: FileKind): Promise<ValidateResult> {
  return new Promise((resolve) => {
    const pol = POLICY[kind];
    if (!file) return resolve({ ok: false, reason: "No file selected." });
    if (file.size > MAX_BYTES) return resolve({ ok: false, reason: "File is over 10 MB. Please upload a smaller file." });
    if (file.size === 0) return resolve({ ok: false, reason: "That file looks empty." });
    const e = ext(file.name);
    if (!pol.ext.includes(e)) return resolve({ ok: false, reason: `Unsupported type .${e}. Allowed: ${pol.ext.join(", ")}.` });
    if (file.type && !pol.mime.includes(file.type)) return resolve({ ok: false, reason: `Unsupported file type (${file.type}).` });

    const fr = new FileReader();
    fr.onload = () => {
      const detected = sniff(fr.result as ArrayBuffer);
      if (!detected) return resolve({ ok: false, reason: "Could not verify the file. Please upload a valid PDF or image." });
      if (!pol.mime.includes(detected)) return resolve({ ok: false, reason: "File contents don't match an allowed type." });
      resolve({ ok: true, reason: "", detected });
    };
    fr.onerror = () => resolve({ ok: false, reason: "Could not read the file." });
    fr.readAsArrayBuffer(file.slice(0, 16));
  });
}
