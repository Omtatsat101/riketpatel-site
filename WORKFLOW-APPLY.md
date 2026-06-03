# Application + Contract Automation Workflow

How the riketpatel.com application pipeline works. The goal: 10 minutes of Riket's attention per opportunity, everything else automated.

## Trigger phrases

In any conversation with Claude / Codex, Riket says one of:

| Phrase | Meaning |
|---|---|
| `apply to [URL]` | A full-time W-2 job. Fetch JD, generate tailored materials, register in pipeline. |
| `bid on [URL]` | A contract / RFP / consulting gig. Same pipeline, different framing. |
| `track partner [URL or name]` | A partner program (Klaviyo, Shopify, etc.) where Riket is registering but doesn't need tailored materials. |
| `track grant [URL or name]` | A grant or RFP. May need a capability statement instead of a résumé. |
| `track referral [name]` | A real estate or business brokerage referral being shopped. |
| `mark submitted: [slug]` | Riket has clicked submit on the ATS. Update status, schedule follow-up. |
| `mark interview: [slug]` | Status update. |
| `mark rejected: [slug]` | Status update. |
| `mark offer: [slug]` | Status update. 🥳 |

## The 6-step automated pipeline

```
[Riket says "apply to URL"]
        ↓
[1. JD parse]        WebFetch pulls the job page, extracts:
                       company, role, location, salary,
                       requirements, contact person.
        ↓
[2. Tailoring]       Claude generates against riketpatel.com baseline:
                       - résumé at /resume/{slug}/index.html
                       - cover letter at /resume/{slug}/cover-letter.html
                       - form answers (if the ATS has long-form Q's)
                       - follow-up email draft
        ↓
[3. Repo push]       git add + commit + push → GH Pages rebuilds
        ↓
[4. Pipeline add]    Append new entry to data/applications.json
                       status: pending_review
        ↓
[5. Riket reviews]   ~2 min eyeball + edits to taste.
                       Replies: "approved" → status flips to approved
        ↓
[6. Riket submits]   Riket prints PDFs, uploads to ATS, hits submit.
                       Replies "mark submitted: [slug]" → status flips
                       to submitted, follow-up scheduled.
```

## Where everything lives

| Thing | Location |
|---|---|
| Source of truth for Riket's voice + numbers | `index.html` + `connect/resume.html` |
| Tailored variants | `resume/{slug}/index.html` + `cover-letter.html` |
| Form answers (long-form ATS questions) | `resume/{slug}/form-answers.html` |
| Lever-style answers (NJII) | `resume/{slug}/lever-answers.html` + `.md` |
| Pipeline data | `data/applications.json` |
| Pipeline dashboard | `jobs/index.html` (live at riketpatel.com/jobs/) |
| Pipeline access code | `config.js` → `JOBS_PIPELINE_PASSWORD` (default: `Pipeline137`) |

## Slug naming convention

`{company-short}-{optional-role-disambig}` — kebab-case, ASCII only.

Examples:
- `humin` (one role at Humin)
- `nj-innovation` (NJ State Office of Innovation)
- `universal-pure` (Universal Pure)
- `adp-597814` (specific ADP job posting number when there might be multiples)

Keep slugs short; they appear in URLs.

## Status state machine

```
pending_review
     ↓ (Riket says "approved")
approved
     ↓ (Riket says "mark submitted: {slug}")
submitted
     ↓ (auto: 24 hours later)
followup_sent
     ↓ (Riket says "mark interview" / "mark rejected" / etc.)
interview → offer → (closed)
        ↘ rejected → (closed)
        ↘ ghosted (auto at +60 days) → (closed)
```

## Privacy + security

- `jobs/index.html` is **password-gated** with a soft lock (`Pipeline137`)
- `data/applications.json` is in a public GitHub repo — **don't include genuinely sensitive data** (salary offers, recruiter cell numbers, NDA'd company names). Use `notes` for context, not secrets.
- Submission credentials, ATS logins, and real recruiter contact info live in your password manager, not here.
- For a serious privacy upgrade later: migrate to Supabase with RLS + magic-link auth on `riketpatel@gmail.com`.

## What's currently automated vs manual

| Step | Auto? | Notes |
|---|---|---|
| Fetch JD from URL | ✅ | WebFetch |
| Generate tailored résumé + cover letter + form answers | ✅ | Claude does the work |
| Push to GitHub Pages | ✅ | `git push` from this conversation |
| Add row to `applications.json` | ✅ | Claude edits the file |
| Show in dashboard | ✅ | The static page reads the JSON |
| Riket review + approve | 🤚 | Human-in-the-loop by design |
| Submit application on the ATS | 🤚 | Riket clicks final submit button |
| Mark status changes | 🤚 + ✅ | Riket says it, Claude updates the JSON |
| Schedule 24h follow-up email | ⚠️ partial | Drafted in form-answers.html; sending is manual |
| Detect outcome emails (rejection / interview) | ❌ not yet | Future: Gmail MCP scans inbox + auto-updates |
| Pre-fill form fields on ATS | ❌ not yet | Future: Chrome MCP per-platform helpers |

## Future upgrades (in priority order)

1. **Make.com follow-up scenario** — webhook fires when Riket says "mark submitted: {slug}", schedules an email at T+24h to the named recruiter contact.
2. **Gmail outcome detection** — Make.com scenario or Gmail MCP runs daily, parses inbox for application-related emails, auto-flips status to `interview`/`rejected`.
3. **Supabase migration** — move `applications.json` to Supabase `applications` table with RLS. Required if Riket wants to share the dashboard with a referral partner, recruiter, or build the SaaS version.
4. **Capability Statement generator** — auto-generate a 1-page PDF for contract bids (different format than a job résumé).
5. **Productize as SaaS** — strip personal data, expose as "AI Job Application Co-Pilot." (Mode 2 in the design.)
