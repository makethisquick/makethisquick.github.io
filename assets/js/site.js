/* MakeThisQuick — site interactions (vanilla, dependency-free) */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Year stamp ---- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---- Sticky nav shadow ---- */
  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("is-stuck", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Mobile menu ---- */
  var toggle = document.querySelector(".nav__toggle");
  var closeMenu = function () { document.body.classList.remove("menu-open"); if (toggle) toggle.setAttribute("aria-expanded", "false"); };
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.querySelectorAll(".mobile-menu a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }

  /* ---- Scroll reveal (resilient: reveals on load + scroll, never leaves
         content stuck at opacity:0 if a single API misbehaves) ---- */
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  function showReveal(el) { el.classList.add("is-in"); }
  if (reduce) {
    reveals.forEach(showReveal);
  } else {
    var pending = reveals.slice();
    var ticking = false;
    function checkReveals() {
      ticking = false;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      pending = pending.filter(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.94 && r.bottom > 0) { showReveal(el); return false; }
        return true;
      });
      if (!pending.length) {
        window.removeEventListener("scroll", queueCheck);
        window.removeEventListener("resize", queueCheck);
      }
    }
    function queueCheck() {
      if (ticking) return;
      ticking = true;
      (window.requestAnimationFrame || window.setTimeout)(checkReveals, 0);
    }
    window.addEventListener("scroll", queueCheck, { passive: true });
    window.addEventListener("resize", queueCheck, { passive: true });
    window.addEventListener("load", checkReveals);
    checkReveals(); // reveal whatever is already in view right away
    // Safety net: guarantee nothing stays hidden even if scroll never fires.
    setTimeout(function () { reveals.forEach(showReveal); }, 2600);
  }

  /* ---- Filament power-on ---- */
  var filament = document.querySelector(".filament");
  if (filament) {
    // set dash length per trace so the draw animation matches the path
    filament.querySelectorAll(".trace").forEach(function (p) {
      try {
        var len = p.getTotalLength();
        p.style.setProperty("--len", len.toFixed(0));
      } catch (e) {}
    });
    if (reduce) {
      filament.classList.add("is-lit");
    } else {
      // light it up shortly after load for an orchestrated entrance
      window.requestAnimationFrame(function () {
        setTimeout(function () { filament.classList.add("is-lit"); }, 350);
      });
    }
  }

  /* ---- Service card pointer glow ---- */
  document.querySelectorAll(".svc").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
    });
  });

  /* ---- Smooth-close menu when navigating to in-page anchors ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", closeMenu);
  });
})();

/* =================================================================
   Front-door gate controller. Only runs when the inline head script
   set html.gate-on (JS present + first visit + bare root). Everything
   degrades to the full landing if this never runs.
   ================================================================= */
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("gate-on")) return;
  var gate = document.getElementById("mtq-gate");
  if (!gate) { root.classList.remove("gate-on"); return; }

  var DURATION = 10000;                // auto-continue after 10s (pauses on any interaction)
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var forced = /[?&]gate\b/.test(location.search);
  var done = false, raf = null, prev = null, elapsed = 0, paused = false;

  try { if (!forced) sessionStorage.setItem("mtq_gate", "1"); } catch (e) {}

  function track(label) { try { if (window.gtag) gtag("event", "frontdoor", { choice: label }); } catch (e) {} }

  // Trap focus: make everything behind the dialog inert + hidden from AT.
  var bg = [].slice.call(document.body.children).filter(function (el) { return el !== gate; });
  bg.forEach(function (el) { el.setAttribute("inert", ""); el.setAttribute("aria-hidden", "true"); });

  // Prefetch Elvona so picking it feels instant (low priority, post-load).
  try { var pf = document.createElement("link"); pf.rel = "prefetch"; pf.href = "elvona.html"; document.head.appendChild(pf); } catch (e) {}

  // Focus the first choice for keyboard users.
  var first = gate.querySelector('[data-gate="studio"]');
  if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }

  // Countdown ring.
  var prog = gate.querySelector(".gate__ring .prog");
  var C = 0;
  if (prog) { try { C = prog.getTotalLength(); prog.style.strokeDasharray = C; prog.style.strokeDashoffset = C; } catch (e) {} }

  function tick(t) {
    if (done) return;
    if (prev == null) prev = t;
    if (!paused) elapsed += (t - prev);
    prev = t;
    var p = elapsed / DURATION; if (p > 1) p = 1;
    if (prog && C && !reduce) prog.style.strokeDashoffset = C * (1 - p);
    if (p >= 1) { dismiss("auto"); return; }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  // Pause the timer while the visitor is considering / interacting.
  gate.addEventListener("pointerenter", function () { paused = true; });
  gate.addEventListener("pointerleave", function () { paused = false; });
  gate.addEventListener("focusin", function () { paused = true; });
  gate.addEventListener("focusout", function (e) { if (!gate.contains(e.relatedTarget)) paused = false; });

  function cleanup() {
    done = true;
    if (raf) cancelAnimationFrame(raf);
    bg.forEach(function (el) { el.removeAttribute("inert"); el.removeAttribute("aria-hidden"); });
    document.removeEventListener("wheel", onScroll);
    document.removeEventListener("touchmove", onScroll);
    document.removeEventListener("keydown", onKey);
  }

  function dismiss(how) {
    if (done) return;
    track(how);
    cleanup();
    window.scrollTo(0, 0);
    var finish = function () { root.classList.remove("gate-on"); if (gate.parentNode) gate.parentNode.removeChild(gate); };
    if (reduce) { finish(); return; }
    gate.classList.add("is-closing");
    gate.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, 600); // safety net
  }

  function onScroll() { dismiss("scroll"); }
  function focusables() {
    return [].slice.call(gate.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return !el.disabled && el.getClientRects().length; });
  }
  function onKey(e) {
    if (e.key === "Escape") { dismiss("esc"); return; }
    if (e.key === "Tab") {
      // Keyboard navigation: pause the auto-dismiss and keep focus inside the dialog
      // (belt-and-suspenders with `inert` for engines that don't support it).
      paused = true;
      var f = focusables(); if (!f.length) return;
      var aEl = f[0], zEl = f[f.length - 1], cur = document.activeElement;
      if (e.shiftKey && (cur === aEl || !gate.contains(cur))) { e.preventDefault(); zEl.focus(); }
      else if (!e.shiftKey && (cur === zEl || !gate.contains(cur))) { e.preventDefault(); aEl.focus(); }
    }
    // Note: Space/Enter intentionally fall through so they activate the focused choice.
  }
  document.addEventListener("wheel", onScroll, { passive: true });
  document.addEventListener("touchmove", onScroll, { passive: true });
  document.addEventListener("keydown", onKey);

  // Choices.
  gate.querySelectorAll("[data-gate]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      var choice = el.getAttribute("data-gate");
      if (choice === "elvona") { track("elvona"); cleanup(); return; } // let the <a> navigate
      e.preventDefault();
      dismiss(choice === "skip" ? "skip" : "studio");
    });
  });
})();
