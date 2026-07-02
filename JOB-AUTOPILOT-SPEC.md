# Job Autopilot — Spec & Parameters

**Owner:** Riket B. Patel
**Created:** 2026-06-29
**Extends:** `WORKFLOW-APPLY.md` (the riketpatel.com apply pipeline)
**Status:** Active — Phase 1 (Indeed + LinkedIn scan), dashboard-review model

---

## What this is
A mostly-automated job/gig discovery + tailoring pipeline. It scans daily for
remote roles that match Riket's parameters, drafts tailored materials off the
riketpatel.com baseline, and surfaces candidates on a review dashboard. Riket
gives the go-ahead per role; nothing is submitted blind.

## Submit model (hard rule)
- **No fully-autonomous submit.** Reasons: Indeed/job-board ToS prohibit
  automated applying (account-suspension risk), applications are consequential
  actions in Riket's name, and knockout questions need a human eye.
- **Flow:** scan → filter → draft materials → show on dashboard → Riket says
  "go" (per role or batch) → assistant fills + Riket presses final Submit.
- Aligns with Riket's stop-line: no customer-facing publishing without approval.

## Search parameters

### Roles / keywords
- Growth / Lifecycle Marketing (lifecycle, CRM, MarTech, email, retention)
- Product Management (product manager, product owner)
- Operations / Biz Ops (operations, program manager, automation ops)
- AI / Automation (AI ops, automation, agentic workflows, no-code/Make)
- Shopify / store setup / e-commerce hourly help & gigs

### Work types
- Contract, Part-time, Gigs — **always eligible**
- Full-time — **only if the employer is a nonprofit / mission-driven org**

### Location
- Remote, US-based only

### Pay
- **No floor.** Surface stated comp (or "not listed") so Riket judges each.

### Dealbreakers / filters
- Skip: on-site/hybrid-required, non-US, unpaid, MLM / commission-only
- Skip full-time roles at for-profit companies (unless flagged nonprofit)
- Dedupe by company + title

## Sources / tracks
- **Phase 1 (live now):** Indeed (search_jobs MCP), LinkedIn-style search MCP
- **Phase 2:** Upwork, Contra, Fiverr gig tracks (via browser; gigs rarely on Indeed)

## Cadence
- Daily scan (scheduled). New matches appended to the dashboard as `new`.
- Riket reviews → `go` flips to `prep` → assistant tailors → `ready` →
  Riket approves/submits → `submitted` → follow-up scheduled.

## Status state machine
new → reviewed → go → prep → ready → submitted → interview / rejected / offer

## Where things live
- This spec: `riketpatel-site/JOB-AUTOPILOT-SPEC.md`
- Pipeline data: `riketpatel-site/data/applications.json`
- Candidate queue: `riketpatel-site/data/job-candidates.json` (autopilot output)
- Tailored materials: `riketpatel-site/resume/{slug}/`
- Review dashboard: Cowork live artifact ("Job Autopilot")
