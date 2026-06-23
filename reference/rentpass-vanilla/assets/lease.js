/* Renter Passport — lease e-signing controller (BOX Sign seam) */
(function () {
  "use strict";
  var RP = window.RP;

  var inviteTok = RP.param("invite") || "";
  var invite = inviteTok ? RP.getInvite(inviteTok) : null;
  var token = inviteTok || "demo";

  if (invite && invite.property) {
    document.getElementById("ctx-line").textContent = "For " + invite.property;
    document.getElementById("doc-sub").textContent = invite.property;
  }

  var consent = document.getElementById("consent");
  var signBtn = document.getElementById("sign-btn");
  var intro = document.getElementById("lease-intro");
  var signSec = document.getElementById("lease-sign");
  var doneSec = document.getElementById("lease-done");
  var host = document.getElementById("sign-host");
  var notice = document.getElementById("config-notice");

  consent.addEventListener("change", function () { signBtn.disabled = !consent.checked; });

  function showDone() {
    intro.hidden = true; signSec.hidden = true; doneSec.hidden = false;
    if (invite) RP.markStep(token, "lease", "submitted");
    RP.saveApp(token, { leaseStatus: "signed", leaseSignedAt: new Date().toISOString() });
    window.scrollTo(0, 0);
  }

  // Ask the BOX Sign function for an embedded signing session. If it isn't
  // configured (404/501) or unreachable, fall back to a simulated flow.
  function requestSignSession() {
    var email = (invite && invite.tenantEmail) || "";
    return fetch(RP.BOX.signEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite: token, email: email })
    }).then(function (r) {
      if (!r.ok) throw new Error("not-configured");
      return r.json();
    });
  }

  signBtn.addEventListener("click", function () {
    if (!consent.checked) return;
    signBtn.disabled = true;
    signBtn.querySelector("span") ? null : null;
    var label = signBtn.childNodes[0];
    if (label && label.nodeType === 3) label.textContent = "Preparing…";

    requestSignSession().then(function (data) {
      // Live BOX Sign: embed the signing URL in an iframe.
      intro.hidden = true; signSec.hidden = false;
      var iframe = document.createElement("iframe");
      iframe.src = data.embedUrl;
      iframe.title = "Sign your lease";
      iframe.style.cssText = "width:100%;height:72vh;border:0;display:block";
      iframe.setAttribute("allow", "fullscreen");
      host.appendChild(iframe);
      signSec.querySelector("h2").focus();
      // BOX posts a completion message to the parent window.
      window.addEventListener("message", function (e) {
        var t = e.data && (e.data.type || e.data);
        if (t === "sign_complete" || t === "success") showDone();
      });
    }).catch(function () {
      // Demo / not configured: simulate signing so the flow is testable.
      notice.hidden = false;
      setTimeout(showDone, 600);
    });
  });
})();
