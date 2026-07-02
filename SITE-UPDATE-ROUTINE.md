# riketpatel.com — Site Update Routine (for Claude Code / agents)

**Purpose:** keep riketpatel.com current so that anyone Riket shares a link with
(recruiters, hiring managers like Ivan at Humin) always sees accurate, up-to-date
information. This is a repeatable routine an agent can run on request or on a
schedule.

**Owner:** Riket B. Patel · **Repo:** `Omtatsat101/riketpatel-site` · **Host:** GitHub Pages
**Related:** `WORKFLOW-APPLY.md` (application pipeline), `JOB-AUTOPILOT-SPEC.md`

---

## Golden rules (read first)
- **Non-destructive by default.** Add and edit; never delete pages, move folders, or
  rewrite history without explicit Riket approval.
- **Publishing is gated.** You may stage all changes (edit files, `git add`, commit to a
  local/working branch) but **do NOT `git push` to the live branch / deploy without
  Riket's explicit "publish" approval.** Publishing is customer-facing.
- **Never expose internal secrets.** No internal credential (admin gate, jobs-pipeline
  gate, API keys) may ever be written into this repo — every file here ships to the
  public. Internal credentials live only in the local key store
  (`projects/API-KEYS.env`). The ONLY shareable value is the visitor/résumé access key
  `Family137` (intentionally public). Note: the repo's admin gate is disabled by design —
  `config.js` must never define `ADMIN_PASSWORD` (two prior values were leaked from this
  public file and are burned).
- **Facts must stay true.** Do not invent metrics, titles, or credentials. Mirror the
  canonical numbers below.

## Canonical facts (single source of truth — keep every page consistent)
- Name: Riket B. Patel · Location: Edgewater Park, NJ · Eastern Time · U.S. Citizen · Indian-American
- Contact: riketpatel.com · Riketpatel@gmail.com · (267) 408-6295 · linkedin.com/in/riketpatel
- Largest email list: ~9,000 (Kiddie Brands, concentrated on KiddieSketch)
- Largest social: KiddieSketch YouTube — 250,000 subscribers (youtube.com/@KiddieSketchTV)
- Do NOT reference Klaviyo (not in use). Email stack: Mailchimp / HubSpot / Make.com / Shopify Flow.
- Merck: 7 years, Product Manager; ~10,000 hrs/yr manual effort removed; audit-clean, zero findings.
- Identity line on résumés/letters: "U.S. Citizen · Indian-American · written personally by a human, not AI."

## What to keep updated (checklist each run)
1. **Pipeline data** — `data/applications.json` and `data/job-candidates.json`: reflect
   current statuses (new → reviewed → ready → submitted → interview / offer / rejected).
2. **Tailored packets** — `resume/{slug}/` (index.html résumé, cover-letter.html, form-answers.html).
   Confirm each is free of leftover tokens from the template it was cloned from
   (search for stray `Humin`, `Klaviyo`, `[FILL]`, another company's name).
3. **Interview assets** (Humin, current): `resume/humin/` also holds `fit.html`,
   `Humin-Growth-Strategy-Riket-Patel.docx`, `Humin-First-Year-Growth-Roadmap-Riket-Patel.docx`.
4. **Core résumé + capstone** — `connect/resume.html`, `index.html`, and the AIPM capstone
   under `assets/downloads/private/`.
5. **Access** — visitor key `Family137` unlocks the résumé gate + capstone download.

## Routine — how to add / refresh a tailored packet
1. Clone the closest existing packet folder (e.g. `cp -r resume/humin resume/{new-slug}`).
2. In BOTH `index.html` and `cover-letter.html` of the new slug, replace: `<title>`,
   toolbar label, gtag `variant`, salutation, dateline (today), body, and the
   `resume/{slug}` self-link. Rewrite the "mapped to the role" bullets and summary to the JD.
3. Keep the identity line and contact block from Canonical Facts.
4. Add/append the role to `data/applications.json` with `status: "ready"`.
5. Verify (below), then STOP and report — publishing is gated.

## Publish flow (only after Riket says "publish")
```
git add -A
git commit -m "site: <what changed>"
git push origin main        # ← gated: run ONLY on explicit approval; GH Pages rebuilds
```
Then confirm the live URL renders and the résumé/capstone gate accepts `Family137`.

## Verification (run before reporting)
- `grep -rInE "Klaviyo|\[FILL|\[paste|TODO" resume/ index.html` → expect no hits.
- Confirm canonical numbers (9,000 / 250,000) and the identity line are present and consistent.
- Confirm no internal credential appears in any committed page: `grep -rIn "ADMIN_PASSWORD\s*:" config.js` must show the key is NOT defined, and no value from `projects/API-KEYS.env` may appear anywhere in the repo.
- Open each changed HTML once (or Print/Save-as-PDF) to eyeball layout.

## End-of-run report (always output)
- **What changed** (files touched)
- **What was verified**
- **What remains gated** (e.g., awaiting "publish" approval)
- **Next safest step** for Riket / Codex / Claude

## Suggested cadence
- On demand after any new application or interview asset.
- Optional weekly sweep: reconcile pipeline statuses, check for stale packets, verify links.
