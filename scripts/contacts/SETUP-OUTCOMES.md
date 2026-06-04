# Gmail Outcome Detector — Setup Runbook

Pairs with `gmail-extractor.gs` (contacts sync). Different script, different purpose:

| | Contacts extractor | Outcome detector |
|---|---|---|
| What | Build a directory of every person you've emailed with | Detect status changes on active applications |
| Output | Google Sheet | Supabase `application_status_signals` table |
| Trigger | Daily at 06:00 | Hourly |
| Confirmation | None — auto-syncs | Each signal needs Riket's eyeball + manual confirm |

This script writes CANDIDATES. Confirmed signals flow back to `applications.json` via Claude in chat (`mark interview: humin`).

---

## Pre-built infrastructure (already done)

- ✅ Supabase table `public.application_status_signals` migrated
- ✅ Anon-readable view `public.application_status_signals_admin` (PII-trimmed)
- ✅ Apps Script written at `scripts/contacts/gmail-outcome-detector.gs`

You only need to install + configure the script.

---

## Step 1 — Install in your primary Gmail (10 min)

Use `riketpatel@gmail.com` (or whichever inbox gets the most application-related mail).

1. https://script.google.com → **New project**
2. Name: `Outcome Detector — gmail.com`
3. Delete the boilerplate and paste the entire contents of `scripts/contacts/gmail-outcome-detector.gs`
4. **Save**

## Step 2 — Configure script properties

In the editor:

1. Open the function `setupScriptProperties` (top right dropdown).
2. **Edit line 244 (the placeholder line)** — replace `PASTE_SUPABASE_SERVICE_ROLE_KEY_HERE` with your real key from `projects/API-KEYS.env → SUPABASE_SERVICE_ROLE_KEY`.
3. Run `setupScriptProperties` once.
4. Approve permissions when prompted (UrlFetchApp + Properties + Gmail).
5. After it runs, **delete the actual key from the function body** (Apps Script keeps the value in encrypted Properties storage; the line in code is no longer needed and you don't want it sitting in plaintext in the source).

Save again.

## Step 3 — First test run

1. Function dropdown → `detectOutcomes` → **Run**.
2. Approve Gmail + external URL fetch permissions if prompted.
3. Open **Executions** in the left sidebar — should see "Posted N signals to Supabase." or "No new signals."
4. If you have an active application in `applications.json` with `status` in {pending_review, approved, submitted, followup_sent, interview} AND your inbox has a recent email from the matching company domain, a signal should appear in Supabase.

Verify the row exists:

```sql
select id, slug, detected_status, confidence, gmail_subject, gmail_date, status
from application_status_signals
order by created_at desc
limit 10;
```

## Step 4 — Install the hourly trigger

1. Function dropdown → `setupHourlyTrigger` → **Run**.
2. Approve trigger permission.
3. Confirm in **Triggers** (clock icon, left sidebar) — should see `detectOutcomes` running every hour.

---

## How signals flow back to applications.json

The detector writes signals as `status='pending'`. These appear in `/admin/` under a new "📨 Signals" panel.

For each signal Riket reviews:

| If signal is real | Tell Claude in chat | Result |
|---|---|---|
| Confirmed interview invite | `mark interview: humin` | applications.json status → `interview`; signal `status` → `confirmed` |
| Confirmed rejection | `mark rejected: humin` | applications.json status → `rejected`; signal → `confirmed` |
| Confirmed offer | `mark offer: humin` | applications.json status → `offer`; signal → `confirmed` |
| False positive | `dismiss signal: {signal id}` | signal `status` → `dismissed` |

The dedup index (`gmail_message_id` unique constraint) prevents the same message from creating a new signal every hour.

---

## Pattern tuning

Patterns are hardcoded in the script under the `PATTERNS` dictionary. Edit + redeploy when:

- A signal is being missed → add a new regex to the relevant category
- A pattern is overmatching → tighten the regex
- A new outcome category emerges (e.g., "case study assignment") → add a new dictionary entry + map it in the classifier

Future enhancement: replace the regex layer with a single LLM call (Claude or Gemini) per matching message. Higher precision, slightly slower, marginal cost. Worth it once volume justifies.

---

## Privacy notes

The script reads:
- Sender (From header)
- Subject
- First 8KB of plain body (regex-only; never persisted)

The script writes to Supabase:
- Sender email + name
- Subject (truncated to 200 chars)
- Pattern-match evidence (which regex fired)
- Gmail message + thread IDs (so you can jump back to the original)

The script does NOT write:
- Body content
- Attachments
- Other participants on the thread
- Labels or starred state

If something feels too revealing for the dashboard, the underlying Supabase column is fine to redact via a view definition update.

---

## Disabling

- **Pause:** Apps Script → **Triggers** → delete the `detectOutcomes` trigger
- **Resume:** run `setupHourlyTrigger` again
- **Reset and rerun:** clear the dedupe index by deleting rows where `status='pending'` AND `created_at < now() - interval '7 days'`. The script's unique index on `gmail_message_id` will otherwise prevent re-detection.
