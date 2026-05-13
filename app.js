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

  function renderLeads(target, leads) {
    target.innerHTML = leads.map(function (l) {
      return (
        '<figure class="brag-quote reveal">' +
          '<blockquote>&ldquo;' + escapeHtml(l.quote) + '&rdquo;</blockquote>' +
          '<figcaption><strong>' + escapeHtml(l.name) + '</strong> · ' + escapeHtml(l.title) +
            '<br/><span class="brag-source">' + escapeHtml(l.context || "") + '</span>' +
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
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("cm-status");
      var key = form.querySelector('[name="access_key"]').value;
      if (!key || key.indexOf("REPLACE_WITH") === 0) {
        if (status) {
          status.textContent = "Form not configured yet — emailing directly works too.";
          status.className = "cm-status is-error";
        }
        return;
      }
      if (status) { status.textContent = "Sending…"; status.className = "cm-status"; }
      var fd = new FormData(form);
      fetch(form.action, { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.success) {
            if (status) { status.textContent = "Sent. I'll reply within a day."; status.className = "cm-status is-ok"; }
            form.reset();
            setTimeout(closeModal, 1800);
          } else {
            if (status) { status.textContent = (data && data.message) || "Something broke — try emailing instead."; status.className = "cm-status is-error"; }
          }
        })
        .catch(function () {
          if (status) { status.textContent = "Network error — try emailing instead."; status.className = "cm-status is-error"; }
        });
    });
  }
})();
