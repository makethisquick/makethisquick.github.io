/* Renter Passport — landlord panel controller */
(function () {
  "use strict";
  var RP = window.RP;
  var form = document.getElementById("invite-form");
  var listEl = document.getElementById("invite-list");
  var tpl = document.getElementById("invite-tpl");

  var STEP_META = {
    application: { label: "Application", verb: "apply" },
    lease: { label: "Lease", verb: "lease" }
  };

  function badge(status) {
    var map = {
      pending: ["badge--pending", "Not started"],
      sent: ["badge--sent", "Sent"],
      submitted: ["badge--done", "Complete"]
    };
    var m = map[status] || map.pending;
    return '<span class="badge ' + m[0] + '">' + m[1] + "</span>";
  }

  function stepIcon(step) {
    if (step === "lease") {
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3h6l4 4v14H6V5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 3v4h4M9 13h6M9 17h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  function render() {
    var invites = RP.allInvites();
    // stats
    document.getElementById("stat-total").textContent = invites.length;
    document.getElementById("stat-apps").textContent = invites.filter(function (i) {
      return i.steps.application.requested && i.steps.application.status === "submitted";
    }).length;
    document.getElementById("stat-leases").textContent = invites.filter(function (i) {
      return i.steps.lease.requested && i.steps.lease.status === "submitted";
    }).length;

    listEl.innerHTML = "";
    if (!invites.length) {
      listEl.innerHTML =
        '<div class="empty">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16v12H4z" stroke="currentColor" stroke-width="1.5"/><path d="M4 8l8 5 8-5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>' +
        "<b>No invites yet</b>Create your first invite on the left, then share the private link with your tenant.</div>";
      return;
    }

    invites.forEach(function (inv) {
      var node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector("[data-name]").textContent = inv.tenantName || "Unnamed tenant";
      node.querySelector("[data-email]").textContent = inv.tenantEmail || "";
      var prop = node.querySelector("[data-prop]");
      if (inv.property) { prop.textContent = inv.property; } else { prop.remove(); }

      var stepsWrap = node.querySelector("[data-steps]");
      ["application", "lease"].forEach(function (step) {
        if (!inv.steps[step].requested) return;
        var row = document.createElement("div");
        row.className = "invite__step";
        row.innerHTML = stepIcon(step) +
          '<span class="lbl">' + STEP_META[step].label + "</span>" +
          badge(inv.steps[step].status);
        stepsWrap.appendChild(row);
      });

      // first requested step decides the share link target
      var firstStep = inv.steps.application.requested ? "apply" : "lease";
      var link = firstStep === "apply" ? RP.applyLink(inv.token) : RP.leaseLink(inv.token);
      node.querySelector("[data-url]").textContent = link.replace(/^https?:\/\//, "");
      var openA = node.querySelector("[data-open]");
      openA.href = link;

      node.querySelector("[data-copy]").addEventListener("click", function () {
        RP.copy(link).then(function () {
          RP.markStep(inv.token, inv.steps.application.requested ? "application" : "lease", "sent");
          RP.toast("Invite link copied");
          render();
        }).catch(function () { RP.toast("Copy failed — long-press the link"); });
      });

      node.querySelector("[data-del]").addEventListener("click", function () {
        if (confirm("Delete the invite for " + (inv.tenantName || "this tenant") + "?")) {
          RP.removeInvite(inv.id);
          render();
        }
      });

      listEl.appendChild(node);
    });
  }

  /* ---- form ---- */
  function setErr(name, msg) {
    var el = form.querySelector('[data-err="' + name + '"]');
    if (el) el.textContent = msg || "";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    setErr("t-name", ""); setErr("t-email", ""); setErr("steps", "");
    var name = form.tenantName.value.trim();
    var email = form.tenantEmail.value.trim();
    var application = form.application.checked;
    var lease = form.lease.checked;
    var ok = true;

    if (!name) { setErr("t-name", "Enter the tenant's name."); ok = false; }
    if (!RP.isEmail(email)) { setErr("t-email", "Enter a valid email address."); ok = false; }
    if (!application && !lease) { setErr("steps", "Pick at least one step to request."); ok = false; }
    if (!ok) return;

    RP.createInvite({
      tenantName: name,
      tenantEmail: email,
      property: form.property.value,
      application: application,
      lease: lease
    });
    form.reset();
    render();
    RP.toast("Invite created");
    // focus the first field again for fast repeat entry
    form.tenantName.focus();
  });

  /* ---- sample data ---- */
  document.getElementById("seed-btn").addEventListener("click", function () {
    var samples = [
      { tenantName: "Maya Chen", tenantEmail: "maya.chen@email.com", property: "1420 Maple Ave, Unit 3B", application: true, lease: true },
      { tenantName: "Devon Brooks", tenantEmail: "devon.b@email.com", property: "88 Harbor St", application: true, lease: false }
    ];
    samples.forEach(function (s) { RP.createInvite(s); });
    render();
    RP.toast("Sample invites added");
  });

  render();
})();
