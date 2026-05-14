(function () {
  "use strict";

  // ─── Year stamp ──────────────────────────────────────────
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ─── Tab navigation ──────────────────────────────────────
  var tabs = document.querySelectorAll("[data-route]");
  var pages = document.querySelectorAll(".page");

  function go(route, push) {
    var found = false;
    pages.forEach(function (p) {
      var active = p.id === route;
      p.classList.toggle("is-active", active);
      if (active) {
        p.removeAttribute("hidden");
        found = true;
      } else {
        p.setAttribute("hidden", "");
      }
    });
    if (!found) return;

    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t.getAttribute("data-route") === route;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });

    if (push && history.pushState) {
      history.pushState({ route: route }, "", "#" + route);
    }

    // Re-run reveal observer on freshly visible content
    requestAnimationFrame(observeReveals);

    // Reset scroll to top on tab change
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  tabs.forEach(function (el) {
    el.addEventListener("click", function (e) {
      var route = el.getAttribute("data-route");
      if (!route) return;
      e.preventDefault();
      go(route, true);
    });
  });

  window.addEventListener("popstate", function (e) {
    var route = (e.state && e.state.route) || (location.hash || "").replace("#", "") || "professional";
    go(route, false);
  });

  // Initial route from hash
  var initial = (location.hash || "").replace("#", "") || "professional";
  go(initial, false);

  // ─── Reveal on scroll ────────────────────────────────────
  var revealObserver = null;
  function observeReveals() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach(function (n) {
        n.classList.add("is-visible");
      });
      return;
    }
    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    document.querySelectorAll(".page.is-active .reveal:not(.is-visible)").forEach(function (n) {
      revealObserver.observe(n);
    });
  }
  observeReveals();

  // ─── Brag wall (JSON-driven) ─────────────────────────────
  // Renders from data/recommendations.json so the GitHub Actions
  // nightly job can append new entries without touching HTML.
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function liLink(person) {
    if (person.linkedin_url && person.linkedin_url.length > 8) {
      return '<a class="brag-li-link" href="' + escapeHtml(person.linkedin_url) + '" target="_blank" rel="noopener">View on LinkedIn →</a>';
    }
    var q = encodeURIComponent(person.name || "");
    return '<a class="brag-li-link brag-li-search" href="https://www.linkedin.com/search/results/people/?keywords=' + q + '" target="_blank" rel="noopener">Find on LinkedIn →</a>';
  }

  function renderLeads(target, leads) {
    target.innerHTML = leads.map(function (l) {
      return (
        '<figure class="brag-quote reveal">' +
          '<blockquote>&ldquo;' + escapeHtml(l.quote) + '&rdquo;</blockquote>' +
          '<figcaption><strong>' + escapeHtml(l.name) + '</strong> · ' + escapeHtml(l.title) +
            '<br/><span class="brag-source">' + escapeHtml(l.context || "") + '</span>' +
            '<br/>' + liLink(l) +
          '</figcaption>' +
        '</figure>'
      );
    }).join("");
  }

  function renderLinkedIn(target, recs) {
    target.innerHTML = recs.map(function (r) {
      var dir = r.direction === "sent" ? "Sent by Riket" : "Received";
      return (
        '<figure class="brag-card reveal">' +
          '<a href="' + escapeHtml(r.image) + '" target="_blank" rel="noopener">' +
            '<img src="' + escapeHtml(r.image) + '" alt="LinkedIn recommendation from ' + escapeHtml(r.name) + '" decoding="async" />' +
          '</a>' +
          '<figcaption>' +
            '<strong>' + escapeHtml(r.name) + '</strong>' + (r.title ? ' — ' + escapeHtml(r.title) : '') + '<br/>' +
            '<em>' + dir + (r.date ? ' · ' + escapeHtml(r.date) : '') + '</em><br/>' +
            (r.summary ? '<span>&ldquo;' + escapeHtml(r.summary) + '&rdquo;</span>' : '') +
            '<br/>' + liLink(r) +
          '</figcaption>' +
        '</figure>'
      );
    }).join("");
  }

  function renderExtras(target, extras) {
    target.innerHTML = extras.map(function (e) {
      var hintCode = '<code>' + escapeHtml(e.image) + '</code>';
      return (
        '<figure class="brag-card brag-card-pinned reveal">' +
          '<div class="brag-slot" data-slot="' + escapeHtml(e.id) + '">' +
            '<span class="slot-label">' + escapeHtml(e.label) + '</span>' +
            '<span class="slot-hint">Drop the image at ' + hintCode + ' and it appears here automatically.</span>' +
          '</div>' +
          '<img class="brag-slot-img" src="' + escapeHtml(e.image) + '" alt="' + escapeHtml(e.label) + '" decoding="async" ' +
            'onload="this.previousElementSibling.style.display=\'none\';" ' +
            'onerror="this.style.display=\'none\';" />' +
          '<figcaption>' +
            '<strong>' + escapeHtml(e.label) + '</strong>' + (e.caption ? '<br/>' + escapeHtml(e.caption) : '') +
            (e.context ? '<br/><em>' + escapeHtml(e.context) + '</em>' : '') +
          '</figcaption>' +
        '</figure>'
      );
    }).join("");
  }

  function renderStats(target, stats) {
    target.innerHTML = stats.map(function (s) {
      return (
        '<div class="brag-stat">' +
          '<span class="brag-num">' + escapeHtml(s.num) + '</span>' +
          '<span class="brag-lbl">' + escapeHtml(s.label) + '</span>' +
        '</div>'
      );
    }).join("");
  }

  function renderBrags(data) {
    var leads   = document.querySelector('[data-render="leads"]');
    var grid    = document.querySelector('[data-render="linkedin"]');
    var extras  = document.querySelector('[data-render="extras"]');
    var stats   = document.querySelector('[data-render="stats"]');
    var updated = document.querySelector('[data-render="updated_at"]');
    if (leads && data.leads)         renderLeads(leads, data.leads);
    if (grid && data.linkedin)       renderLinkedIn(grid, data.linkedin);
    if (extras && data.extras)       renderExtras(extras, data.extras);
    if (stats && data.stats)         renderStats(stats, data.stats);
    if (updated && data.updated_at)  updated.textContent = data.updated_at;
    // Re-observe newly inserted .reveal nodes
    requestAnimationFrame(observeReveals);
  }

  function loadBrags() {
    var section = document.querySelector('#brags[data-json]');
    if (!section) return;
    var url = section.getAttribute('data-json');
    fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(renderBrags)
      .catch(function (err) {
        console.warn("[brags] failed to load " + url + ":", err);
        var fallback = section.querySelector('.brag-fallback');
        if (fallback) fallback.style.display = "block";
      });
  }
  loadBrags();

  // ─── Admin gate (secret-click on the name in the topbar) ─
  var ADMIN_KEY = "rp_admin_unlocked";
  function isAdminUnlocked() {
    try { return sessionStorage.getItem(ADMIN_KEY) === "1"; } catch (e) { return false; }
  }
  function setAdminUnlocked(v) {
    try {
      if (v) sessionStorage.setItem(ADMIN_KEY, "1");
      else sessionStorage.removeItem(ADMIN_KEY);
    } catch (e) {}
  }
  function openAdminOverlay() {
    var ov = document.getElementById("admin-overlay");
    if (!ov) return;
    ov.removeAttribute("hidden");
    var pwView = document.getElementById("admin-pw-view");
    var panelView = document.getElementById("admin-panel-view");
    if (isAdminUnlocked()) {
      if (pwView) pwView.hidden = true;
      if (panelView) panelView.hidden = false;
      hydrateAdminEditLinks();
    } else {
      if (pwView) pwView.hidden = false;
      if (panelView) panelView.hidden = true;
      setTimeout(function () { var i = document.getElementById("admin-pw-input"); if (i) i.focus(); }, 50);
    }
  }
  function closeAdminOverlay() {
    var ov = document.getElementById("admin-overlay");
    if (ov) ov.setAttribute("hidden", "");
  }
  function hydrateAdminEditLinks() {
    var cfg = window.RP_CONFIG || {};
    var repo = cfg.GITHUB_REPO || "Omtatsat101/riketpatel-site";
    document.querySelectorAll("[data-admin-edit]").forEach(function (a) {
      var path = a.getAttribute("data-admin-edit");
      a.href = "https://github.com/" + repo + "/edit/main/" + path;
    });
  }

  // Secret-click trigger on .brand-name (the name in the topbar)
  var brandName = document.querySelector(".brand-name");
  if (brandName) {
    brandName.style.cursor = "pointer";
    brandName.setAttribute("title", "");
    var clicks = 0;
    var clickTimer = null;
    brandName.addEventListener("click", function (e) {
      // Don't override navigation if user is on a different page
      e.stopPropagation();
      clicks++;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(function () { clicks = 0; }, 1400);
      if (clicks >= 5) {
        clicks = 0;
        clearTimeout(clickTimer);
        e.preventDefault();
        openAdminOverlay();
      }
    });
    // Long-press on touch / mouse — alt trigger
    var pressTimer = null;
    var triggerLongPress = function () {
      pressTimer = setTimeout(function () { openAdminOverlay(); }, 2000);
    };
    var cancelLongPress = function () { if (pressTimer) clearTimeout(pressTimer); };
    brandName.addEventListener("mousedown", triggerLongPress);
    brandName.addEventListener("mouseup", cancelLongPress);
    brandName.addEventListener("mouseleave", cancelLongPress);
    brandName.addEventListener("touchstart", triggerLongPress);
    brandName.addEventListener("touchend", cancelLongPress);
    brandName.addEventListener("touchcancel", cancelLongPress);
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-admin-close]")) {
      e.preventDefault();
      closeAdminOverlay();
    }
  });

  var adminForm = document.getElementById("admin-pw-form");
  if (adminForm) {
    adminForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var cfg = window.RP_CONFIG || {};
      var expected = cfg.ADMIN_PASSWORD || "Admin137";
      var input = document.getElementById("admin-pw-input");
      var status = document.getElementById("admin-status");
      if ((input.value || "").trim() === expected) {
        setAdminUnlocked(true);
        if (status) { status.textContent = "Welcome."; status.className = "admin-status is-ok"; }
        if (window.gtag) gtag("event", "admin_unlocked");
        var pwView = document.getElementById("admin-pw-view");
        var panelView = document.getElementById("admin-panel-view");
        if (pwView) pwView.hidden = true;
        if (panelView) panelView.hidden = false;
        hydrateAdminEditLinks();
      } else {
        if (status) { status.textContent = "That's not it."; status.className = "admin-status is-error"; }
      }
    });
  }

  var adminLogout = document.getElementById("admin-logout");
  if (adminLogout) {
    adminLogout.addEventListener("click", function () {
      setAdminUnlocked(false);
      closeAdminOverlay();
    });
  }

  // ESC closes the admin overlay
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var ov = document.getElementById("admin-overlay");
      if (ov && !ov.hasAttribute("hidden")) closeAdminOverlay();
    }
  });

  // ─── Family tab password gate ───────────────────────────
  // Not real security — anyone can read source. It's a courtesy lock to
  // keep the Family tab off the front-line view for casual / search visitors.
  var FAMILY_PW = (window.RP_CONFIG && window.RP_CONFIG.ADMIN_FAMILY_PASSWORD) || "Family137";
  var FAMILY_KEY = "rp_family_unlocked";

  function isFamilyUnlocked() {
    try { return localStorage.getItem(FAMILY_KEY) === "1"; }
    catch (e) { return false; }
  }
  function setFamilyUnlocked(v) {
    try {
      if (v) localStorage.setItem(FAMILY_KEY, "1");
      else localStorage.removeItem(FAMILY_KEY);
    } catch (e) {}
    applyFamilyLockState();
  }
  function applyFamilyLockState() {
    var gate = document.getElementById("family-gate");
    var content = document.getElementById("family-content");
    var lockBadge = document.getElementById("family-tab-lock");
    var unlocked = isFamilyUnlocked();
    if (gate)    gate.style.display    = unlocked ? "none" : "";
    if (content) content.hidden        = !unlocked;
    if (lockBadge) lockBadge.textContent = unlocked ? "" : "🔒";
  }

  var gateForm = document.getElementById("family-gate-form");
  if (gateForm) {
    gateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("family-gate-input");
      var status = document.getElementById("family-gate-status");
      if ((input.value || "").trim() === FAMILY_PW) {
        if (status) { status.textContent = "Unlocked."; status.className = "family-gate-status is-ok"; }
        setFamilyUnlocked(true);
        if (window.gtag) gtag("event", "family_unlocked", { domain: "riketpatel.com" });
        // Re-fire any deferred renders that target Family content
        setTimeout(function () {
          if (typeof renderInstagram === "function") renderInstagram();
          requestAnimationFrame(observeReveals);
        }, 50);
      } else {
        if (status) { status.textContent = "That's not it."; status.className = "family-gate-status is-error"; }
      }
    });
  }
  var lockAgain = document.getElementById("family-lock-again");
  if (lockAgain) {
    lockAgain.addEventListener("click", function (e) {
      e.preventDefault();
      setFamilyUnlocked(false);
      // Stay on family page so they see the gate immediately
    });
  }
  applyFamilyLockState();

  // ─── Instagram feed render ──────────────────────────────
  function renderInstagram() {
    var mount = document.getElementById("ig-mount");
    if (!mount) return;
    var cfg = window.RP_CONFIG || {};
    var handle = cfg.INSTAGRAM_HANDLE || "";
    var link = document.getElementById("ig-link");
    if (link && handle) link.href = "https://instagram.com/" + handle;
    if (link && handle) link.textContent = "@" + handle;

    // Mode 1: LightWidget / iframe embed
    if (cfg.INSTAGRAM_EMBED_URL && cfg.INSTAGRAM_EMBED_URL.indexOf("REPLACE_WITH") !== 0 && cfg.INSTAGRAM_EMBED_URL.length > 10) {
      mount.innerHTML = '<iframe class="ig-embed" src="' + cfg.INSTAGRAM_EMBED_URL + '" frameborder="0" scrolling="no" allowtransparency="true" loading="lazy" title="Riket on Instagram"></iframe>';
      return;
    }

    // Mode 2: JSON-driven grid
    fetch("data/instagram.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.posts) || data.posts.length === 0) {
          mount.innerHTML = '<div class="ig-placeholder">' +
            '<strong>Instagram feed not connected yet.</strong>' +
            'Either paste a LightWidget iframe src into <code>config.js</code> as <code>INSTAGRAM_EMBED_URL</code>, or drop posts into <code>data/instagram.json</code>.' +
            '</div>';
          return;
        }
        var posts = data.posts.slice(0, 9);
        mount.innerHTML = '<div class="ig-grid">' + posts.map(function (p) {
          var href = p.url || ("https://instagram.com/" + (data.handle || handle));
          return '<a class="ig-tile" href="' + href + '" target="_blank" rel="noopener">' +
            '<img src="' + p.image + '" alt="' + (p.alt || "Instagram post") + '" loading="lazy" />' +
            (p.caption ? '<span class="ig-caption">' + p.caption + '</span>' : '') +
            '</a>';
        }).join("") + '</div>';
      })
      .catch(function () {
        mount.innerHTML = '<div class="ig-placeholder">Couldn\'t load the feed right now.</div>';
      });
  }
  renderInstagram();

  // ─── Contact modal ───────────────────────────────────────
  var modal = document.getElementById("contact-modal");
  function openModal() {
    if (!modal) return;
    modal.removeAttribute("hidden");
    setTimeout(function () {
      var first = modal.querySelector('input[name="name"]');
      if (first) first.focus();
    }, 50);
    document.addEventListener("keydown", onKeyDown);
  }
  function closeModal() {
    if (!modal) return;
    modal.setAttribute("hidden", "");
    document.removeEventListener("keydown", onKeyDown);
  }
  function onKeyDown(e) { if (e.key === "Escape") closeModal(); }

  document.addEventListener("click", function (e) {
    var openBtn = e.target.closest("[data-cm-open]");
    if (openBtn) { e.preventDefault(); openModal(); return; }
    var closeBtn = e.target.closest("[data-cm-close]");
    if (closeBtn) { e.preventDefault(); closeModal(); return; }
    if (modal && !modal.hasAttribute("hidden") && e.target === modal) closeModal();
  });

  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var status = document.getElementById("cm-status");
      var cfg = window.RP_CONFIG || {};
      if (form.botcheck && form.botcheck.checked) return;

      if (status) { status.textContent = "Sending…"; status.className = "cm-status"; }
      var fd = new FormData(form);
      var lead = {
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone") || null,
        message: fd.get("message") || null,
        source: "contact_riketpatel",
        domain: "riketpatel.com",
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
        metadata: { page: location.pathname }
      };

      var results = await Promise.allSettled([
        // 1. Supabase insert
        cfg.SUPABASE_URL ? fetch(cfg.SUPABASE_URL + "/rest/v1/leads", {
          method: "POST",
          headers: {
            "apikey": cfg.SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(lead)
        }) : Promise.reject("supabase-not-configured"),
        // 2. Web3Forms email
        (function(){
          var w = new FormData();
          w.append("access_key", cfg.WEB3FORMS_KEY_RIKETPATEL || "REPLACE_WITH_WEB3FORMS_KEY_RIKETPATEL");
          w.append("subject", "riketpatel.com — new message from " + lead.name);
          w.append("from_name", "riketpatel.com");
          w.append("name", lead.name);
          w.append("email", lead.email);
          w.append("phone", lead.phone || "");
          w.append("message", lead.message || "");
          return fetch("https://api.web3forms.com/submit", { method: "POST", body: w });
        })(),
        // 3. Google Sheets via Apps Script webhook (fire-and-forget; Apps Script doesn't send CORS headers)
        (cfg.GOOGLE_SHEETS_WEBHOOK_URL && cfg.GOOGLE_SHEETS_WEBHOOK_URL.indexOf("REPLACE_WITH") !== 0)
          ? fetch(cfg.GOOGLE_SHEETS_WEBHOOK_URL, {
              method: "POST",
              mode: "no-cors",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(lead)
            })
          : Promise.reject("sheets-webhook-not-configured")
      ]);

      var anyOk = results.some(function(r){
        return r.status === "fulfilled" && (r.value === undefined || (r.value && (r.value.ok || r.value.type === "opaque")));
      });
      if (anyOk) {
        if (status) { status.textContent = "Sent. I'll reply within a day."; status.className = "cm-status is-ok"; }
        form.reset();
        if (window.gtag) gtag("event", "contact_submit", { domain: "riketpatel.com" });
        setTimeout(closeModal, 1800);
      } else {
        if (status) { status.textContent = "Something broke. Email hey@riketpatel.com directly."; status.className = "cm-status is-error"; }
      }
    });
  }
})();
