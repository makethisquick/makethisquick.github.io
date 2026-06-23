/* =================================================================
   MakeThisQuick — Renter Passport shared runtime
   Vanilla, dependency-free. Exposes window.RP (RenterPassport).

   No database yet: state lives in localStorage. Submissions also POST
   to Netlify Forms (server-side capture, no DB) and — once configured —
   files route to BOX via a Netlify Function (see lib/box adapter).
   ================================================================= */
(function () {
  "use strict";

  var NS = "mtq_rentpass_";
  var KEYS = {
    invites: NS + "invites",
    apps: NS + "applications"
  };

  /* ---------------- storage ---------------- */
  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* ---------------- ids / tokens ---------------- */
  // URL-safe token from the crypto RNG (never Math.random for anything identifying).
  function token(len) {
    len = len || 18;
    var bytes = new Uint8Array(len);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var s = "";
    var abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    for (var i = 0; i < bytes.length; i++) s += abc[bytes[i] % abc.length];
    return s;
  }
  function uid() { return "inv_" + token(14); }

  /* ---------------- invites model ---------------- */
  function allInvites() { return read(KEYS.invites, []); }
  function saveInvites(list) { return write(KEYS.invites, list); }

  function getInvite(tok) {
    return allInvites().filter(function (i) { return i.token === tok; })[0] || null;
  }
  function createInvite(data) {
    var list = allInvites();
    var inv = {
      id: uid(),
      token: token(20),
      tenantName: (data.tenantName || "").trim(),
      tenantEmail: (data.tenantEmail || "").trim().toLowerCase(),
      property: (data.property || "").trim(),
      steps: {
        application: { requested: !!data.application, status: "pending", submittedAt: null },
        lease: { requested: !!data.lease, status: "pending", submittedAt: null }
      },
      createdAt: new Date().toISOString()
    };
    list.unshift(inv);
    saveInvites(list);
    return inv;
  }
  function updateInvite(tok, mutator) {
    var list = allInvites();
    for (var i = 0; i < list.length; i++) {
      if (list[i].token === tok) { mutator(list[i]); saveInvites(list); return list[i]; }
    }
    return null;
  }
  function removeInvite(id) {
    saveInvites(allInvites().filter(function (i) { return i.id !== id; }));
  }
  function markStep(tok, step, status) {
    return updateInvite(tok, function (inv) {
      if (inv.steps[step]) {
        inv.steps[step].status = status;
        if (status === "submitted") inv.steps[step].submittedAt = new Date().toISOString();
      }
    });
  }

  /* ---------------- application drafts ---------------- */
  function getApp(tok) {
    var all = read(KEYS.apps, {});
    return all[tok] || null;
  }
  function saveApp(tok, data) {
    var all = read(KEYS.apps, {});
    all[tok] = Object.assign({}, all[tok], data, { updatedAt: new Date().toISOString() });
    write(KEYS.apps, all);
    return all[tok];
  }

  /* ---------------- links ---------------- */
  // Build absolute links relative to the /app/ base so it works on any host.
  function appBase() {
    var p = location.pathname;
    var idx = p.indexOf("/app/");
    var base = idx >= 0 ? p.slice(0, idx + 5) : "/app/";
    return location.origin + base;
  }
  function applyLink(tok) { return appBase() + "apply.html?invite=" + encodeURIComponent(tok); }
  function leaseLink(tok) { return appBase() + "lease.html?invite=" + encodeURIComponent(tok); }

  /* ---------------- validation ---------------- */
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim()); }

  /* ---------------- file security guard ----------------
     Client-side checks are UX, not the security boundary — the server
     (Netlify Function / BOX) must re-validate. We still enforce here:
       - extension allowlist
       - declared MIME allowlist
       - size cap
       - magic-byte sniff (don't trust the extension)
  -------------------------------------------------------- */
  var MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  var POLICY = {
    // documents: signed contracts, statements, W-2s
    document: {
      ext: ["pdf", "jpg", "jpeg", "png", "heic", "heif"],
      mime: ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"]
    },
    // ID: photo of a license/passport — images + pdf
    id: {
      ext: ["jpg", "jpeg", "png", "heic", "heif", "pdf"],
      mime: ["image/jpeg", "image/png", "image/heic", "image/heif", "application/pdf"]
    }
  };
  var MAGIC = [
    { sig: [0x25, 0x50, 0x44, 0x46], type: "application/pdf" },            // %PDF
    { sig: [0xFF, 0xD8, 0xFF], type: "image/jpeg" },                       // JPEG
    { sig: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], type: "image/png" }
  ];

  function ext(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }
  function sniff(buf) {
    var b = new Uint8Array(buf);
    for (var i = 0; i < MAGIC.length; i++) {
      var sig = MAGIC[i].sig, ok = true;
      for (var j = 0; j < sig.length; j++) { if (b[j] !== sig[j]) { ok = false; break; } }
      if (ok) return MAGIC[i].type;
    }
    // HEIC/HEIF: 'ftyp' box at offset 4 with heic/heif/mif1 brand
    if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      return "image/heic";
    }
    return null;
  }

  // Returns a Promise<{ok, reason}>. kind = 'document' | 'id'
  function validateFile(file, kind) {
    return new Promise(function (resolve) {
      var pol = POLICY[kind] || POLICY.document;
      if (!file) return resolve({ ok: false, reason: "No file selected." });
      if (file.size > MAX_BYTES) return resolve({ ok: false, reason: "File is over 10 MB. Please upload a smaller file." });
      if (file.size === 0) return resolve({ ok: false, reason: "That file looks empty." });
      var e = ext(file.name);
      if (pol.ext.indexOf(e) < 0) return resolve({ ok: false, reason: "Unsupported type ." + e + ". Allowed: " + pol.ext.join(", ") + "." });
      if (file.type && pol.mime.indexOf(file.type) < 0) {
        return resolve({ ok: false, reason: "Unsupported file type (" + file.type + ")." });
      }
      // magic-byte sniff on the first 16 bytes
      var slice = file.slice(0, 16);
      var fr = new FileReader();
      fr.onload = function () {
        var detected = sniff(fr.result);
        if (!detected) return resolve({ ok: false, reason: "Could not verify the file. Please upload a valid PDF or image." });
        if (pol.mime.indexOf(detected) < 0) return resolve({ ok: false, reason: "File contents don't match an allowed type." });
        resolve({ ok: true, reason: "", detected: detected });
      };
      fr.onerror = function () { resolve({ ok: false, reason: "Could not read the file." }); };
      fr.readAsArrayBuffer(slice);
    });
  }

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  /* ---------------- BOX adapter seam ----------------
     Tries the Netlify Function first; if it's not configured (501) or the
     environment can't reach it, callers fall back to local capture so the
     demo always works. See lib/box-adapter.js + BOX-INTEGRATION.md.
  -------------------------------------------------------- */
  var BOX = {
    endpoint: "/.netlify/functions/box-upload",
    signEndpoint: "/.netlify/functions/box-sign",
    // Probe whether BOX is wired up (cached per session).
    available: function () {
      return fetch(BOX.endpoint, { method: "GET" })
        .then(function (r) { return r.status !== 404 && r.status !== 501; })
        .catch(function () { return false; });
    }
  };

  /* ---------------- tiny UI helpers ---------------- */
  function toast(msg, ms) {
    var t = document.getElementById("rp-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "rp-toast"; t.className = "toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span></span>';
    t.querySelector("span").textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("is-on"); }, ms || 2400);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta); resolve();
      } catch (e) { reject(e); }
    });
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- export ---------------- */
  window.RP = {
    KEYS: KEYS,
    // invites
    allInvites: allInvites, getInvite: getInvite, createInvite: createInvite,
    updateInvite: updateInvite, removeInvite: removeInvite, markStep: markStep,
    // apps
    getApp: getApp, saveApp: saveApp,
    // links
    applyLink: applyLink, leaseLink: leaseLink, appBase: appBase,
    // validation + files
    isEmail: isEmail, validateFile: validateFile, humanSize: humanSize, POLICY: POLICY,
    // box
    BOX: BOX,
    // ui
    toast: toast, copy: copy, param: param, esc: esc, token: token
  };

  /* ---------------- common chrome ---------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
