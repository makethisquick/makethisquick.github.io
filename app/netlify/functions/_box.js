/* ============================================================
   Shared BOX helper for Netlify Functions.

   Auth options (set in Netlify env — see BOX-INTEGRATION.md):
     A) JWT  : BOX_CONFIG_JSON  = base64 of your app's config .json
     B) CCG  : BOX_CLIENT_ID, BOX_CLIENT_SECRET, BOX_ENTERPRISE_ID

   Plus: BOX_ROOT_FOLDER_ID = the folder all tenant subfolders live in.

   Everything is loaded lazily so the static site still deploys even
   before `npm install` runs in netlify/functions or env vars are set.
   ============================================================ */

"use strict";

function isConfigured() {
  return !!(
    process.env.BOX_ROOT_FOLDER_ID &&
    (process.env.BOX_CONFIG_JSON ||
      (process.env.BOX_CLIENT_ID && process.env.BOX_CLIENT_SECRET && process.env.BOX_ENTERPRISE_ID))
  );
}

/* Build an authenticated box-node-sdk client. Throws if deps/env missing. */
function getClient() {
  // Lazy require so a missing dependency degrades to "not configured"
  // instead of crashing the bundle.
  var BoxSDK = require("box-node-sdk");

  if (process.env.BOX_CONFIG_JSON) {
    var cfg = JSON.parse(Buffer.from(process.env.BOX_CONFIG_JSON, "base64").toString("utf8"));
    var sdk = BoxSDK.getPreconfiguredInstance(cfg);
    return sdk.getAppAuthClient("enterprise");
  }

  // Client Credentials Grant (service account / enterprise).
  var ccgSdk = new BoxSDK({
    clientID: process.env.BOX_CLIENT_ID,
    clientSecret: process.env.BOX_CLIENT_SECRET
  });
  // box-node-sdk >= 2.x
  return ccgSdk.getCCGClientForEnterprise(process.env.BOX_ENTERPRISE_ID);
}

/* Make a filesystem-safe folder name from an email/identifier. */
function safeName(s) {
  return String(s || "applicant")
    .toLowerCase()
    .replace(/[^a-z0-9._@+-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "applicant";
}

/* Find-or-create a per-tenant subfolder under the root, keyed by email. */
async function ensureUserFolder(client, email) {
  var root = process.env.BOX_ROOT_FOLDER_ID;
  var name = safeName(email);
  var offset = 0;
  // Look for an existing folder with this name.
  /* eslint-disable no-constant-condition */
  while (true) {
    var page = await client.folders.getItems(root, {
      fields: "name,type",
      limit: 1000,
      offset: offset
    });
    var hit = (page.entries || []).filter(function (e) {
      return e.type === "folder" && e.name === name;
    })[0];
    if (hit) return hit.id;
    if (!page.entries || page.entries.length < 1000) break;
    offset += 1000;
  }
  // Not found — create it. Handle the race where it was just created.
  try {
    var created = await client.folders.create(root, name);
    return created.id;
  } catch (e) {
    if (e.statusCode === 409 && e.response && e.response.body &&
        e.response.body.context_info && e.response.body.context_info.conflicts) {
      return e.response.body.context_info.conflicts[0].id;
    }
    throw e;
  }
}

/* ---- server-side file validation (defense in depth) ---- */
var MAX_BYTES = 10 * 1024 * 1024;
var ALLOWED_MIME = [
  "application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"
];
var HEIF_BRANDS = ["heic", "heix", "heif", "hevc", "mif1", "msf1"];
function sniff(buf) {
  var b = buf;
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";       // %PDF
  if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "image/jpeg";                            // JPEG
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
      b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return "image/png";                             // full PNG signature
  // ISO-BMFF 'ftyp' at offset 4; require a HEIF brand at offset 8 so MP4/MOV/AVIF are rejected.
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    var brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (HEIF_BRANDS.indexOf(brand) >= 0) return "image/heic";
  }
  return null;
}
function validateBuffer(buf, declaredMime) {
  if (!buf || !buf.length) return { ok: false, reason: "empty file" };
  if (buf.length > MAX_BYTES) return { ok: false, reason: "file too large" };
  var detected = sniff(buf);
  if (!detected) return { ok: false, reason: "unrecognized file type" };
  if (ALLOWED_MIME.indexOf(detected) < 0) return { ok: false, reason: "type not allowed" };
  if (declaredMime && ALLOWED_MIME.indexOf(declaredMime) < 0) return { ok: false, reason: "declared type not allowed" };
  return { ok: true, detected: detected };
}

function json(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(obj)
  };
}

module.exports = {
  isConfigured: isConfigured,
  getClient: getClient,
  ensureUserFolder: ensureUserFolder,
  safeName: safeName,
  validateBuffer: validateBuffer,
  MAX_BYTES: MAX_BYTES,
  ALLOWED_MIME: ALLOWED_MIME,
  json: json
};
