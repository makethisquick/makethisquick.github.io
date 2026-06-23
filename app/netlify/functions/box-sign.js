/* ============================================================
   POST /.netlify/functions/box-sign
     JSON: { invite, email }
   Creates a BOX Sign request for the tenant's lease and returns an
   embedded signing URL the front-end iframes.

   Requires (in addition to the BOX auth in _box.js):
     BOX_LEASE_TEMPLATE_FILE_ID  — the lease document/template file id
                                    in BOX to send for signature.

   GET -> availability probe (200 configured / 501 not).
   Degrades to 501 when not configured so the client simulates signing.
   See BOX-INTEGRATION.md.
   ============================================================ */

"use strict";
var box = require("./_box");

function signConfigured() {
  return box.isConfigured() && !!process.env.BOX_LEASE_TEMPLATE_FILE_ID;
}

exports.handler = async function (event) {
  if (event.httpMethod === "GET") {
    return signConfigured()
      ? box.json(200, { configured: true })
      : box.json(501, { configured: false, message: "BOX Sign not configured" });
  }
  if (event.httpMethod !== "POST") return box.json(405, { error: "method not allowed" });
  if (!signConfigured()) return box.json(501, { error: "BOX Sign not configured" });

  var payload = {};
  try { payload = JSON.parse(event.body || "{}"); } catch (e) {}
  var email = (payload.email || "").trim();
  if (!email) return box.json(400, { error: "signer email required" });

  try {
    var client = box.getClient();
    var folderId = await box.ensureUserFolder(client, email);

    // Create a BOX Sign request: copy the lease template into the tenant
    // folder, add the tenant as an embedded signer, and return the embed URL.
    var signRequest = await client.signRequests.create({
      source_files: [{ type: "file", id: process.env.BOX_LEASE_TEMPLATE_FILE_ID }],
      parent_folder: { type: "folder", id: folderId },
      signers: [
        {
          email: email,
          role: "signer",
          // embed_url_external_user_id makes this signer "embedded" so we can
          // iframe the signing experience instead of emailing a link.
          embed_url_external_user_id: "tenant-" + box.safeName(payload.invite || email)
        }
      ],
      // Notify the landlord/back-office on completion.
      are_reminders_enabled: true
    });

    var signer = (signRequest.signers || []).filter(function (s) {
      return s.embed_url || s.iframeable_embed_url;
    })[0] || {};

    var embedUrl = signer.iframeable_embed_url || signer.embed_url;
    if (!embedUrl) return box.json(502, { error: "no embed url returned" });

    return box.json(200, {
      ok: true,
      signRequestId: signRequest.id,
      embedUrl: embedUrl
    });
  } catch (e) {
    return box.json(502, { error: "box sign failed", detail: String(e && e.message || e) });
  }
};
