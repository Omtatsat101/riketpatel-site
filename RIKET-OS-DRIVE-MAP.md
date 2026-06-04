# Riket OS — Where Everything Lives

The complete map of Riket's personal operating system across Drive, GitHub, and Supabase.

The principle: **automated/frequent data → Git or Supabase. Manual/occasional data → Drive.**

---

## 📁 Google Drive — manual + occasional editing

Root folder: `/Riket OS/` (created by `scripts/riket-os/master.gs`)

```
/Riket OS/
├── README — Riket OS.gdoc       Auto-maintained folder map
├── 01-Applications/
│   ├── Wins.gsheet              25+ wins, hand-editable, feeds /digest/
│   ├── Email Todos.gsheet        Action items from email, drives admin to-dos
│   └── Outreach.gsheet          Cold outreach pipeline (separate from /jobs/)
├── 02-Templates/                Email + cover-letter + résumé templates
├── 03-Capability/               Capability Statement variants + 30-60-90 plans
├── 04-Interview Prep/           Per-role prep workspaces
├── 05-Contacts/
│   └── Riket Contacts.gsheet    Auto-synced from Gmail by gmail-extractor.gs
├── 06-Signals/                  (Supabase remains primary; reference views OK here)
└── 07-Output/                   Generated artifacts: daily briefs, weekly summaries
```

Single routing web app exposes the editable Sheets to riketpatel.com dashboards:
- `?type=wins` → wins.json shape
- `?type=todos` → todos.json shape
- `?type=outreach` → outreach.json shape
- `?type=index` → folder + sheet IDs

URL stored in `config.js → RIKET_OS_WEB_APP_URL`.

Setup: `scripts/riket-os/SETUP.md`.

---

## 🐙 GitHub — automated, versioned, frequently mutated

Repo: `Omtatsat101/riketpatel-site`

```
data/
├── applications.json            Pipeline state (Claude mutates via chat)
├── outreach.json                Cold outreach (mirrors Drive sheet, durable backup)
├── wins.json                    Wins (mirrors Drive sheet, durable backup)
├── email-todos.json             To-dos (mirrors Drive sheet, durable backup)
├── email-templates.json         Follow-up email templates (versioned)
├── blog-posts.json              Blog manifest (paired with static HTML)
├── recommendations.json         Wall-of-brags data (LinkedIn rec screenshots)
└── instagram.json               Family page IG feed

blog/                            Static HTML per post (SEO-friendly)
jobs/                            Pipeline dashboard
admin/                           Master admin
digest/                          Morning brief aggregate
outreach/                        Cold outreach Kanban
interview-prep/                  Per-role workspaces
contacts/                        Gmail-Drive contacts dashboard
negotiate/                       Salary + script toolkit
capability-statement/            Print-ready 1-page artifact

scripts/
├── riket-os/
│   ├── master.gs                Folder-structure Apps Script
│   └── SETUP.md
├── contacts/
│   ├── gmail-extractor.gs       Contacts sync to Drive Sheet
│   ├── SETUP.md
│   ├── gmail-outcome-detector.gs Outcome signals → Supabase
│   └── SETUP-OUTCOMES.md
├── make-com-followup-setup.md   Make.com scenario runbook (alternative to Worker)
├── queue-followup.mjs           CLI helper to fire the Make webhook
└── build_resume_docx.py         .docx generator for résumé variants
```

---

## 🗄 Supabase — dynamic queues + signal events

Project: `doxmbwizpsyqruyrmffs`

| Table / view | Owner | Purpose |
|---|---|---|
| `application_followups` | Worker + Make.com | Follow-up email queue. `status` flows pending → draft_created → sent. Unique on id. |
| `application_followups_admin` (view) | Worker + dashboards | PII-trimmed view granted SELECT to anon for the dashboards |
| `application_status_signals` | Apps Script outcome detector | Detected status changes from Gmail (interview / rejected / offer / next_steps). Unique on `gmail_message_id` for dedup. |
| `application_status_signals_admin` (view) | Dashboards | PII-trimmed view granted SELECT to anon |
| `leads` | Web forms | Contact form submissions from riketpatel.com / mettarealtypartners.com / mettalegacypartners.com |

RLS enabled everywhere. Service role bypasses (used by Worker + Apps Script). Anon has SELECT only on the `_admin` views.

---

## ☁️ Cloudflare Worker `ohm-homes`

Project root: `projects/ohm-homes/`

```
src/index.ts                     Router + env declarations
src/pipeline.ts                  Application follow-up pipeline (alternative to Make.com)
public/                          Static admin / read / dashboard pages
wrangler.jsonc                   Cron triggers + bindings
docs/PIPELINE-DEPLOY.md          Deployment guide
```

Endpoints:
- `POST /api/pipeline/queue-followup` — receive a follow-up request (alternative to Make webhook)
- `POST /api/pipeline/process-queue` — manual cron trigger
- `POST /api/pipeline/slack-interact` — Slack button interactions (Mark sent)
- `POST /api/pipeline/enqueue-checkins` — manual 7-day check-in sweep

Cron triggers:
- `*/30 * * * *` — drains pending queue, posts Slack cards
- `15 9 * * *` — daily 7-day check-in auto-queue

---

## ⚙️ Make.com — alternative Worker path

Team: 2081617 · Org: 7107999

| Hook | Purpose |
|---|---|
| 2406027 (`RP \| Application Follow-up Queue Trigger`) | Drop-in for `POST /api/pipeline/queue-followup`. Currently bound to no scenario — use Worker, OR build Scenarios A and B per `scripts/make-com-followup-setup.md`. |

If running both Worker AND Make scenarios, Supabase primary-key dedup handles double-processing safely.

---

## 🤖 The data flow rule of thumb

When Riket asks where some piece of data lives:

| Question | Answer |
|---|---|
| Where do I see my pending follow-ups? | `riketpatel.com/jobs/` (read live from Supabase admin view) |
| Where do I edit my wins? | Drive → Riket OS / 01-Applications / Wins.gsheet (hand-edit) OR tell Claude in chat |
| Where do I add an email to-do? | Drive → Riket OS / 01-Applications / Email Todos.gsheet OR tell Claude |
| Where do I see what's happening across everything? | `riketpatel.com/digest/` (morning brief, password Pipeline137) |
| Where do I track a new contact? | Auto-extracted by `gmail-extractor.gs` to Drive contacts sheet hourly |
| Where do I see detected outcome signals? | `riketpatel.com/admin/` Signals panel (reads Supabase admin view) |
| Where do I configure templates? | Edit `data/email-templates.json` in GitHub (versioned) |
| Where do I park a new application? | Tell Claude in chat: `apply to [URL]` |

Single mental model: **read live → fall back to versioned → fall back to "ask Claude".**
