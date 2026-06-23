/* ============================================================
   POST /.netlify/functions/box-upload
     multipart/form-data: file, email, invite, slot
   Validates the file server-side, then stores it in the tenant's
   private BOX subfolder (organized by email under BOX_ROOT_FOLDER_ID).

   GET  -> availability probe used by the front-end:
            200 when configured, 501 when not.

   Degrades gracefully: if BOX deps/env are missing, returns 501 so the
   client falls back to local capture. See BOX-INTEGRATION.md.
   ============================================================ */

"use strict";
var box = require("./_box");

/* Minimal multipart parser via busboy (lazy-loaded). */
function parseMultipart(event) {
  return new Promise(function (resolve, reject) {
    var Busboy;
    try { Busboy = require("busboy"); } catch (e) { return reject(new Error("busboy not installed")); }
    var contentType = event.headers["content-type"] || event.headers["Content-Type"];
    if (!contentType || contentType.indexOf("multipart/form-data") < 0) {
      return reject(new Error("expected multipart/form-data"));
    }
    var bb = Busboy({
      headers: { "content-type": contentType },
      // Bound everything so a malicious multipart body can't exhaust memory.
      limits: { files: 1, fileSize: box.MAX_BYTES, parts: 12, fields: 10, fieldSize: 100 * 1024, fieldNameSize: 200 }
    });
    var fields = {};
    var fileBuf = null, fileName = null, fileMime = null, tooBig = false;

    bb.on("field", function (name, val) { fields[name] = val; });
    bb.on("file", function (name, stream, info) {
      fileName = info.filename;
      fileMime = info.mimeType || info.mime;
      var chunks = [];
      stream.on("data", function (d) { chunks.push(d); });
      stream.on("limit", function () { tooBig = true; });
      stream.on("end", function () { fileBuf = Buffer.concat(chunks); });
    });
    bb.on("close", function () {
      if (tooBig) return reject(new Error("file too large"));
      resolve({ fields: fields, fileBuf: fileBuf, fileName: fileName, fileMime: fileMime });
    });
    bb.on("error", reject);

    var body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body || "");
    bb.end(body);
  });
}

exports.handler = async function (event) {
  // availability probe
  if (event.httpMethod === "GET") {
    return box.isConfigured()
      ? box.json(200, { configured: true })
      : box.json(501, { configured: false, message: "BOX not configured" });
  }
  if (event.httpMethod !== "POST") return box.json(405, { error: "method not allowed" });
  if (!box.isConfigured()) return box.json(501, { error: "BOX not configured" });

  // Reject oversized bodies before buffering them into memory.
  var declaredLen = parseInt(event.headers["content-length"] || event.headers["Content-Length"] || "0", 10);
  if (declaredLen && declaredLen > box.MAX_BYTES + 1024 * 1024) return box.json(413, { error: "payload too large" });

  var parsed;
  try { parsed = await parseMultipart(event); }
  catch (e) { return box.json(400, { error: e.message }); }

  if (!parsed.fileBuf || !parsed.fileBuf.length) return box.json(400, { error: "no file" });

  var check = box.validateBuffer(parsed.fileBuf, parsed.fileMime);
  if (!check.ok) return box.json(415, { error: check.reason });

  var email = parsed.fields.email || parsed.fields.invite || "applicant";
  var slot = box.safeName(parsed.fields.slot || "document");

  try {
    var client = box.getClient();
    var folderId = await box.ensureUserFolder(client, email);
    // Prefix with the slot so the folder reads cleanly.
    var stamp = new Date().toISOString().replace(/[:.]/g, "-");
    var safeOriginal = box.safeName(parsed.fileName || "file");
    var storedName = slot + "__" + stamp + "__" + safeOriginal;
    var res = await client.files.uploadFile(folderId, storedName, parsed.fileBuf);
    // box-node-sdk uploadFile resolves to { entries: [file] }.
    var entry = (res && res.entries && res.entries[0]) || {};
    return box.json(200, {
      ok: true,
      folderId: folderId,
      fileId: entry.id || null,
      name: storedName,
      detected: check.detected
    });
  } catch (e) {
    return box.json(502, { error: "box upload failed", detail: String(e && e.message || e) });
  }
};
