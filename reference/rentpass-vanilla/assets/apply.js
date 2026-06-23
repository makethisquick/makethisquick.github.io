/* Renter Passport — tenant application wizard controller */
(function () {
  "use strict";
  var RP = window.RP;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- context: who/what is this for ---- */
  var inviteTok = RP.param("invite") || "";
  var invite = inviteTok ? RP.getInvite(inviteTok) : null;
  var token = inviteTok || "demo";
  if (invite) {
    var ctx = invite.property ? ("For " + invite.property) : "Verified renter onboarding";
    document.getElementById("ctx-line").textContent = ctx;
    RP.markStep(token, "application", "sent"); // they opened the link
  }

  /* ---- step machine ---- */
  var ORDER = ["welcome", "travel", "identity", "household", "uploads", "success"];
  var SEG = { travel: 0, identity: 1, household: 2, uploads: 3 };
  var idx = 0;

  var steps = {};
  document.querySelectorAll(".wiz-step").forEach(function (s) { steps[s.dataset.step] = s; });
  var progress = document.getElementById("progress");
  var actions = document.getElementById("actions");
  var trust = document.getElementById("trust");
  var backBtn = document.getElementById("back-btn");
  var nextBtn = document.getElementById("next-btn");
  var nextLabel = document.getElementById("next-label");

  function show(name) {
    ORDER.forEach(function (k) { steps[k].hidden = (k !== name); });
    var chromeOff = (name === "welcome" || name === "success");
    progress.hidden = chromeOff;
    actions.hidden = chromeOff;
    trust.hidden = chromeOff;

    if (!chromeOff) {
      backBtn.hidden = (name === "travel"); // first real step has no back
      var isLast = (name === "uploads");
      nextLabel.textContent = isLast ? "Submit application" : "Continue";
      nextBtn.classList.toggle("btn--spark", isLast);
      // progress segments
      var seg = SEG[name];
      progress.setAttribute("aria-valuenow", String(seg + 1));
      progress.querySelectorAll(".wiz-progress__seg").forEach(function (el, n) {
        el.classList.toggle("is-done", n < seg);
        el.classList.toggle("is-active", n === seg);
      });
    }
    // focus the step heading for screen-reader continuity
    var h = steps[name].querySelector("h2[tabindex], h1");
    if (h && name !== "welcome") { try { h.focus(); } catch (e) {} }
    window.scrollTo(0, 0);
  }

  function go(name) { idx = ORDER.indexOf(name); show(name); }
  function next() {
    var cur = ORDER[idx];
    if (cur === "uploads") { submit(); return; }
    if (!validateStep(cur)) return;
    idx = Math.min(idx + 1, ORDER.length - 1);
    show(ORDER[idx]);
  }
  function back() { idx = Math.max(idx - 1, 1); show(ORDER[idx]); }

  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", back);

  /* ---- welcome: 5s auto-advance + loading bar ---- */
  (function welcome() {
    var bar = document.getElementById("loadbar");
    var hint = document.getElementById("welcome-hint");
    var startBtn = document.getElementById("start-btn");
    var timer = null, cancelled = false;

    function beginApp() {
      if (timer) clearTimeout(timer);
      go("travel");
    }
    function cancelAuto() {
      if (cancelled) return;
      cancelled = true;
      if (timer) clearTimeout(timer);
      bar.classList.remove("is-running");
      bar.classList.add("is-paused");
      hint.textContent = "Take your time — tap Create My Passport when you're ready.";
    }

    startBtn.addEventListener("click", beginApp);
    // any meaningful interaction cancels the auto-advance
    ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (ev) {
      steps.welcome.addEventListener(ev, function (e) {
        if (e.target === startBtn) return;       // the button has its own handler
        cancelAuto();
      }, { passive: true });
    });

    bar.classList.add("is-running");
    timer = setTimeout(function () { if (!cancelled) beginApp(); }, reduce ? 5000 : 5000);
  })();

  /* ---- conditional reveals in the travel step ---- */
  (function travelConditionals() {
    var t = document.getElementById("form-travel");
    var bizBlock = document.getElementById("biz-block");
    var facilityBlock = document.getElementById("facility-block");
    function sync() {
      var traveling = (t.querySelector('input[name="traveling"]:checked') || {}).value;
      bizBlock.classList.toggle("is-shown", traveling === "yes");
      var domain = t.elements.businessDomain.value;
      var isHealth = (traveling === "yes" && domain === "Healthcare");
      facilityBlock.classList.toggle("is-shown", isHealth);
    }
    t.addEventListener("change", sync);
    sync();
  })();

  /* ---- validation ---- */
  function err(scope, name, msg) {
    var box = scope.querySelector('[data-err="' + name + '"]');
    if (box) box.textContent = msg || "";
    var input = scope.querySelector("#" + name) || scope.querySelector('[name="' + name + '"]');
    if (input) { if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid"); }
    return !msg;
  }
  function ageFrom(dobStr) {
    var d = new Date(dobStr); if (isNaN(d)) return NaN;
    var now = new Date(), a = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a;
  }
  function validateStep(name) {
    if (name === "travel") {
      var t = steps.travel;
      var traveling = (t.querySelector('input[name="traveling"]:checked') || {}).value;
      if (traveling === "yes") {
        var s = t.querySelector("#c-start").value, e = t.querySelector("#c-end").value;
        if (s && e && new Date(e) < new Date(s)) return err(t, "dates", "End date can't be before the start date.");
      }
      err(t, "dates", "");
      return true;
    }
    if (name === "identity") {
      var i = steps.identity, ok = true;
      ok = err(i, "legal-name", i.querySelector("#legal-name").value.trim() ? "" : "Enter your legal full name.") && ok;
      var dob = i.querySelector("#dob").value;
      var age = ageFrom(dob);
      if (!dob) ok = err(i, "dob", "Enter your date of birth.") && ok;
      else if (isNaN(age) || age < 0 || age > 120) ok = err(i, "dob", "Enter a valid date of birth.") && ok;
      else if (age < 18) ok = err(i, "dob", "Applicants must be 18 or older.") && ok;
      else err(i, "dob", "");
      ok = err(i, "tax-home", i.querySelector("#tax-home").value.trim() ? "" : "Enter your permanent tax home address.") && ok;
      if (!ok) { var first = i.querySelector('[aria-invalid="true"]'); if (first) first.focus(); }
      return ok;
    }
    return true; // household + uploads have no hard requirements
  }

  /* ---- uploads ---- */
  var files = {}; // slot -> File
  document.querySelectorAll(".slot").forEach(function (slot) {
    var key = slot.dataset.slot;
    var kind = slot.dataset.kind;
    var input = slot.querySelector('input[type="file"]');
    var fileRow = slot.querySelector(".slot__file");
    var nameEl = fileRow.querySelector(".name");
    var sizeEl = fileRow.querySelector(".size");
    var errEl = slot.querySelector("[data-err]");
    var statusEl = slot.querySelector("[data-status]");
    var removeBtn = fileRow.querySelector(".x");
    var skip = slot.querySelector("[data-skip]");
    var pick = slot.querySelector(".slot__pick");

    function setStatus(text) { if (statusEl) statusEl.textContent = text; }

    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (!f) return;
      slot.classList.remove("is-error"); errEl.textContent = "";
      RP.validateFile(f, kind).then(function (res) {
        if (!res.ok) {
          slot.classList.add("is-error"); errEl.textContent = res.reason;
          input.value = ""; delete files[key];
          slot.classList.remove("is-filled"); setStatus(slot.dataset.skippable ? "Optional" : "Recommended");
          return;
        }
        files[key] = f;
        nameEl.textContent = f.name;
        sizeEl.textContent = RP.humanSize(f.size);
        slot.classList.add("is-filled");
        slot.classList.remove("is-skipped");
        if (skip) skip.checked = false;
        setStatus("Added");
      });
    });

    removeBtn.addEventListener("click", function () {
      delete files[key];
      input.value = "";
      slot.classList.remove("is-filled");
      setStatus(slot.dataset.skippable ? "Optional" : "Recommended");
    });

    if (skip) {
      skip.addEventListener("change", function () {
        if (skip.checked) {
          delete files[key]; input.value = "";
          slot.classList.remove("is-filled", "is-error"); errEl.textContent = "";
          slot.classList.add("is-skipped"); setStatus("Skipped");
          pick.style.opacity = ".5";
        } else {
          slot.classList.remove("is-skipped"); setStatus("Optional");
          pick.style.opacity = "";
        }
      });
    }
  });

  function docMeta() {
    var out = {};
    document.querySelectorAll(".slot").forEach(function (slot) {
      var key = slot.dataset.slot;
      var f = files[key];
      var skipped = slot.classList.contains("is-skipped");
      out[key] = f
        ? { present: true, skipped: false, name: f.name, size: f.size, type: f.type }
        : { present: false, skipped: skipped };
    });
    return out;
  }

  /* ---- collect ---- */
  function radio(form, name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }
  function val(form, name) { var el = form.elements[name]; return el ? String(el.value).trim() : ""; }
  function collect() {
    var t = document.getElementById("form-travel");
    var i = document.getElementById("form-identity");
    var h = document.getElementById("form-household");
    return {
      traveling: radio(t, "traveling"),
      businessDomain: val(t, "businessDomain"),
      facilityName: val(t, "facilityName"),
      contractStart: val(t, "contractStart"),
      contractEnd: val(t, "contractEnd"),
      shift: radio(t, "shift"),
      legalName: val(i, "legalName"),
      aliases: val(i, "aliases"),
      dob: val(i, "dob"),
      taxHome: val(i, "taxHome"),
      household: radio(h, "household"),
      pets: radio(h, "pets"),
      vehicle: radio(h, "vehicle"),
      documents: docMeta()
    };
  }

  /* ---- best-effort server capture (no DB): Netlify Forms (text) + BOX (files) ---- */
  function captureServer(data) {
    var email = (invite && invite.tenantEmail) || data.legalName || "applicant";
    // 1) text capture via Netlify Forms (gracefully ignored off-Netlify)
    var body = new URLSearchParams();
    body.set("form-name", "renter-application");
    body.set("invite", token);
    body.set("tenantEmail", (invite && invite.tenantEmail) || "");
    Object.keys(data).forEach(function (k) {
      if (k === "documents") body.set("documents", JSON.stringify(data.documents));
      else body.set(k, data[k] || "");
    });
    var jobs = [
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }).catch(function () {})
    ];
    // 2) files via BOX function (skipped silently if not configured)
    Object.keys(files).forEach(function (key) {
      var fd = new FormData();
      fd.append("invite", token);
      fd.append("email", email);
      fd.append("slot", key);
      fd.append("file", files[key], files[key].name);
      jobs.push(fetch(RP.BOX.endpoint, { method: "POST", body: fd }).catch(function () {}));
    });
    return Promise.all(jobs);
  }

  /* ---- submit ---- */
  var submitting = false;
  function submit() {
    if (submitting) return;
    if (!files.id && !confirm("You haven't added a government photo ID. You can add it later — submit now anyway?")) return;
    submitting = true;
    nextBtn.disabled = true;
    nextLabel.textContent = "Submitting…";

    var data = collect();
    RP.saveApp(token, {
      invite: token,
      tenantEmail: (invite && invite.tenantEmail) || "",
      data: data,
      status: "submitted",
      submittedAt: new Date().toISOString()
    });
    if (invite) RP.markStep(token, "application", "submitted");

    captureServer(data).then(function () { showSuccess(data); })
      .catch(function () { showSuccess(data); });
  }

  function showSuccess(data) {
    var receipt = document.getElementById("receipt");
    var docs = data.documents;
    function line(label, ok, note) {
      return '<div class="row"><span>' + RP.esc(label) + '</span><b class="' + (ok ? "ok" : "") + '">' + RP.esc(note) + "</b></div>";
    }
    var dn = { contract: "Job contract", id: "Photo ID", bank: "Bank statement", income: "Income" };
    var html = line("Applicant", true, data.legalName || "—");
    Object.keys(dn).forEach(function (k) {
      var d = docs[k] || {};
      html += line(dn[k], d.present, d.present ? "Received" : (d.skipped ? "Skipped" : "Pending"));
    });
    receipt.innerHTML = html;

    if (invite && invite.steps.lease && invite.steps.lease.requested) {
      document.getElementById("lease-next").classList.remove("hidden");
      document.getElementById("lease-link").href = RP.leaseLink(token);
    }
    go("success");
  }

  /* ---- boot ---- */
  show("welcome");
})();
