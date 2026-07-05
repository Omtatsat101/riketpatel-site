# riketpatel.com autonomous loop — checkpoints

Scheduled task `riketpatel-card-72h-loop` (every 4h, local). 72h window ends ~2026-07-06 18:00 ET.
Each run: monitor the card deploy, do ONE scoped verified improvement from the backlog, log here.
Stop-lines and backlog live in the task prompt (`~/.claude/scheduled-tasks/riketpatel-card-72h-loop/SKILL.md`).

---

## 2026-07-05 — seed (manual, in-session)

**Deploy issue found & being fixed:** `/card/print/` and its PDF had been 404 for ~2 days —
the GitHub Pages build for commit `dbf9437` was never created (the live site was stuck at the
`cc667ec` tree, which has `/card/` and `/card/qr/` but not `/card/print/`). Root cause: a dropped
Pages auto-build, not throttling. Fix: a fresh push (this commit) re-triggers the Pages build and
should deploy the current HEAD tree, publishing `/card/print/` + the PDF.

**This commit also does backlog item D:** added a discreet "Digital card ॐ" link to the homepage
footer → `/card/`, so the card is reachable from the site (fixes Riket's original "I can't see it").

**Live now (before this push):** `/` 200, `/card/` 200, `/card/qr/` 200, `/card/print/` 404, PDF 404.

**Remaining backlog:** A (optimize heavy images son-elmo-car.jpg ~7MB + family-mural ~8MB),
B (tablist arrow-key nav), C (dns-prefetch on resume subpages), E (sitemap lastmod refresh),
F (obfuscate footer mailto).

**Needs Riket:** config.js WEB3FORMS_KEY is still a placeholder (contact-form email notifications
won't fire until Riket sets the real key) — do NOT invent it.
