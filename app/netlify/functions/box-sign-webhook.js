/* ============================================================
   POST /.netlify/functions/box-sign-webhook
   Receives BOX Sign status callbacks (sign request completed, declined,
   expired, etc.). Verify the signature, then update your store / notify
   the landlord.

   Configure a BOX webhook (or BOX Sign notification) pointing here and
   set BOX_WEBHOOK_PRIMARY_KEY / BOX_WEBHOOK_SECONDARY_KEY to verify.

   This is a scaffold: with no database yet, it just validates + logs.
   ============================================================ */

"use strict";
var crypto = require("crypto");
var box = require("./_box");

/* BOX signs webhooks with HMAC-SHA256 over (body + timestamp). */
function verify(event) {
  var primary = process.env.BOX_WEBHOOK_PRIMARY_KEY;
  var secondary = process.env.BOX_WEBHOOK_SECONDARY_KEY;
  if (!primary && !secondary) return true; // not enforced until keys are set

  var h = event.headers || {};
  var ts = h["box-delivery-timestamp"] || h["Box-Delivery-Timestamp"];
  var sigPrimary = h["box-signature-primary"] || h["Box-Signature-Primary"];
  var sigSecondary = h["box-signature-secondary"] || h["Box-Signature-Secondary"];
  var body = event.body || "";

  function sign(key) {
    return crypto.createHmac("sha256", key).update(body + (ts || "")).digest("base64");
  }
  if (primary && sigPrimary && safeEq(sign(primary), sigPrimary)) return true;
  if (secondary && sigSecondary && safeEq(sign(secondary), sigSecondary)) return true;
  return false;
}
function safeEq(a, b) {
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch (e) { return false; }
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return box.json(405, { error: "method not allowed" });
  if (!verify(event)) return box.json(403, { error: "invalid signature" });

  var payload = {};
  try { payload = JSON.parse(event.body || "{}"); } catch (e) {}
  var trigger = payload.trigger || (payload.webhook && payload.webhook.trigger) || "unknown";

  // TODO (when a DB exists): mark the invite's lease step complete, store
  // the signed file id, email the landlord. For now we acknowledge.
  console.log("[box-sign-webhook]", trigger, payload.id || "");

  return box.json(200, { received: true, trigger: trigger });
};
