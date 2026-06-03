# Make.com Follow-up Scenarios — Setup Runbook

15-minute setup. Two scenarios + a Slack channel. The queue lives in Supabase (NOT a Make Data Store — your Make quota is full as of 2026-05-25 so we use Supabase as the queue). After this, every application Riket marks as `submitted` automatically gets a follow-up Gmail draft created at T+24h, with Riket pinged on Slack to review and send.

Per the **Drafts-Only rule**: Make.com creates Gmail DRAFTS. Riket clicks Send.

---

## Pre-built infrastructure (already done)

| Component | Status | Identifier |
|---|---|---|
| Webhook URL (Scenario A trigger) | ✅ Created via Make API | `https://hook.us2.make.com/7x9fftdphh64z0bdwhg91sme9hgp1uvn` |
| Webhook name in Make UI | ✅ | `RP \| Application Follow-up Queue Trigger` (hook id 2406027) |
| Supabase queue table | ✅ Migration applied | `public.application_followups` in project `doxmbwizpsyqruyrmffs` |
| Data structure for legacy Data Store approach | Created but unused | id 390536 (kept for future if quota frees up) |

You only need to do the steps below for **Scenarios A and B and the Slack bot**.

---

## Architecture in one diagram

```
[Claude says "mark submitted: humin"]
        ↓
[Claude updates applications.json → status: submitted, submitted_at: now]
[Claude commits + pushes]
[Claude POSTs to Make webhook → URL above]
        ↓
[Scenario A: "RP — Queue Follow-up"]
   - Receives slug, template_id, recipient, submitted_at_iso
   - Inserts row into Supabase application_followups
     (uses Riket's existing Supabase connection in Make, service_role key)
   - Returns 200
        ↓ ⏰ time passes (24h, 7d, 30d depending on template)
        ↓
[Scenario B: "RP — Process Follow-up Queue"]  ← Schedule every 30 min
   - Supabase: SELECT * FROM application_followups
              WHERE status = 'pending' AND run_at < now()
   - For each:
     - Fetches email-templates.json from riketpatel.com (live, always fresh)
     - Interpolates {recipient_name}, {role_title}, {company}, {slug}
     - Creates Gmail DRAFT in riketpatel@gmail.com
     - Posts a Slack Block Kit card to #applications-pipeline via Pipeline Bot
     - Supabase: UPDATE application_followups
                SET status='draft_created', drafted_at=now(), gmail_draft_id=...
                WHERE id = current
```

The Slack notification is the only signal Riket needs — it surfaces the draft, has a one-click link to Gmail, and stays in the workspace context Riket already lives in. No more email-to-self pings.

---

## Prerequisites

| | What | Notes |
|---|---|---|
| ✅ | Make.com account with Core plan | 11 active scenarios per primer.md. |
| ☐ | Gmail OAuth connection in Make for `riketpatel@gmail.com` | Used to create the Gmail drafts. May already exist. |
| ☐ | Slack OAuth connection in Make for your main workspace | Used to ping you on Slack when a draft is ready. |
| ☐ | Supabase connection in Make for project `doxmbwizpsyqruyrmffs` | Use service_role key (full access to public schema). May already exist. |
| ☐ | A Slack channel for these notifications | Recommended: dedicated `#applications-pipeline` channel (clean signal), OR your main org channel for team visibility. Decide before Step 3. |
| ✅ | Webhook URL `https://hook.us2.make.com/7x9fftdphh64z0bdwhg91sme9hgp1uvn` | Already created via Make API (hook id 2406027). Bind to Scenario A in Step 2. |
| ✅ | Supabase table `public.application_followups` | Already migrated. |

### Slack channel + bot decision (5-min consideration before setup)

You have three reasonable options for **who/what posts the message in Slack**:

1. **Make.com app integration (default)** — Make's built-in Slack module posts as "Make" / "Make.com" using your personal OAuth. Simple, no extra setup, but the sender name is "Make".

2. **Custom Slack app / bot (recommended)** — Create a Slack app in your workspace called something like "Pipeline Bot" or "Application Tracker" with a friendly icon. Posts under that name. Looks like a real agent. Takes 5 extra min.

3. **Incoming webhook** — Slack's old-school incoming webhook URL, fully customizable sender name + icon per-post. Simplest of all but loses Block Kit interactivity.

**Recommended:** Option 2 (Custom Slack app). The 5 extra minutes pay off forever in clarity. Quick steps in Step 0 below.

---

## Step 0 — Create the Pipeline Bot in Slack (5 min, optional but recommended)

Skip this if you picked Option 1 (default Make integration) above.

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. **App name:** `Pipeline Bot` (or `Application Tracker`, or whatever you want)
3. **Workspace:** select your main org workspace
4. After creation, go to **OAuth & Permissions** in the left sidebar
5. Under **Bot Token Scopes**, add:
   - `chat:write` (post messages)
   - `chat:write.customize` (use custom username/icon per post — optional)
   - `channels:read` (find channels)
6. Click **Install to Workspace** at the top, authorize
7. Copy the **Bot User OAuth Token** (starts with `xoxb-`) — you'll paste this in Make's Slack connection setup
8. Optional polish: under **Basic Information** → **Display Information**, give the bot a name, icon, and short description. The icon shows up on every message.
9. In Slack itself, invite the bot to your target channel: `/invite @Pipeline Bot` from the channel

---

## Step 1 — (Skipped: queue lives in Supabase, not Make Data Store)

Make Data Store quota was full as of 2026-05-25 so this scenario suite uses Supabase as the queue. The migration creating `public.application_followups` in project `doxmbwizpsyqruyrmffs` has already been applied via the Supabase MCP. Schema:

| Field | Type | Notes |
|---|---|---|
| `id` | text PK | Format: `{slug}__{template_id}__{submitted_at_iso}` |
| `created_at` | timestamptz | auto-default `now()` |
| `slug` | text NOT NULL | e.g. `humin` |
| `company` | text NOT NULL | |
| `role_title` | text NOT NULL | |
| `recipient_name` | text | defaults to `team` at template-render time |
| `recipient_email` | text | Gmail To: field |
| `template_id` | text NOT NULL | e.g. `humin_24h_followup` |
| `submitted_at` | timestamptz NOT NULL | when the app was submitted |
| `run_at` | timestamptz NOT NULL | when to create the draft (submitted_at + template.delay_hours) |
| `status` | text NOT NULL | `pending` → `draft_created` → `sent` |
| `drafted_at` | timestamptz | when Make created the draft |
| `sent_at` | timestamptz | manually set when Riket actually sends from Gmail |
| `gmail_draft_id` | text | the Gmail message ID for direct linkback from dashboard |
| `notes` | text | free text |

RLS is enabled with no anon policies — only Make.com (via service_role connection) can read or write this table.

---

## Step 2 — Create Scenario A: "RP — Queue Follow-up"

This is the webhook receiver. It runs once per submission.

### Module 1 — Custom Webhook (trigger)

Add module → **Webhooks → Custom Webhook**.

- Click **Add hook** → select the pre-existing webhook **`RP | Application Follow-up Queue Trigger`**. URL: `https://hook.us2.make.com/7x9fftdphh64z0bdwhg91sme9hgp1uvn`
- (If for some reason the pre-existing hook isn't visible, create one with name `RP | Application Follow-up Queue Trigger` and paste the URL into `config.js → MAKE_FOLLOWUP_WEBHOOK_URL` — already done at the existing URL.)

**Expected payload Make will receive:**

```json
{
  "slug": "humin",
  "company": "Humin (Healthy Minds Innovations)",
  "role_title": "Growth Marketing Manager, Lifecycle & MarTech",
  "recipient_name": "Humin team",
  "recipient_email": "hr@hminnovations.org",
  "template_id": "humin_24h_followup",
  "submitted_at_iso": "2026-05-25T18:00:00Z",
  "delay_hours": 24
}
```

Click **Determine data structure → Run once** with a sample payload to let Make learn the structure.

### Module 2 — Tools → Set Variables

- Variable: `run_at_iso`
  - Value: `{{addHours(parseDate(1.submitted_at_iso; "YYYY-MM-DDTHH:mm:ssZ"); 1.delay_hours)}}`
- Variable: `id`
  - Value: `{{1.slug}}__{{1.template_id}}__{{1.submitted_at_iso}}`

### Module 3 — Supabase → Insert a Row (new module type)

- Connection: your existing Supabase connection (or add one with the service_role key from `API-KEYS.env → SUPABASE_SERVICE_ROLE_KEY`, base URL `https://doxmbwizpsyqruyrmffs.supabase.co`)
- Table: `application_followups`
- Columns to insert:
  - `id`: `{{2.id}}`
  - `slug`: `{{1.slug}}`
  - `company`: `{{1.company}}`
  - `role_title`: `{{1.role_title}}`
  - `recipient_name`: `{{1.recipient_name}}`
  - `recipient_email`: `{{1.recipient_email}}`
  - `template_id`: `{{1.template_id}}`
  - `submitted_at`: `{{1.submitted_at_iso}}`
  - `run_at`: `{{2.run_at_iso}}`
  - `status`: `pending`

If Make.com's Supabase module is unavailable, use **HTTP → Make a request** instead:
- URL: `https://doxmbwizpsyqruyrmffs.supabase.co/rest/v1/application_followups`
- Method: `POST`
- Headers:
  - `apikey`: `{{SUPABASE_SERVICE_ROLE_KEY}}`
  - `Authorization`: `Bearer {{SUPABASE_SERVICE_ROLE_KEY}}`
  - `Content-Type`: `application/json`
  - `Prefer`: `resolution=merge-duplicates` (upsert on id collision)
- Body: JSON with all the columns above

### Module 4 — Webhook Response

- Status code: `200`
- Body:
  ```json
  { "queued": true, "id": "{{2.id}}", "run_at": "{{2.run_at_iso}}" }
  ```

### Schedule for Scenario A

Set to **On-Demand** (triggered by webhook). No cron.

Click **Save** and **Activate** the scenario. Test by sending a curl to the webhook URL (see Step 4).

---

## Step 3 — Create Scenario B: "RP — Process Follow-up Queue"

This runs on a schedule and converts pending rows into Gmail drafts.

### Module 1 — Scheduler (trigger)

Add module → **Tools → Scheduler**.

- Run scenario: **At regular intervals**
- Interval: **30 minutes**

### Module 2 — Supabase → Select Rows (or HTTP GET)

If Make's Supabase module is available:
- Connection: same service_role connection from Scenario A
- Table: `application_followups`
- Filter:
  - `status` = `pending`
  - AND `run_at` less than `now()`
- Limit: `20` rows per run

If using HTTP fallback (no Supabase module):
- URL: `https://doxmbwizpsyqruyrmffs.supabase.co/rest/v1/application_followups?status=eq.pending&run_at=lt.{{formatDate(now; "YYYY-MM-DDTHH:mm:ssZ")}}&limit=20&order=run_at.asc`
- Method: `GET`
- Headers:
  - `apikey`: `{{SUPABASE_SERVICE_ROLE_KEY}}`
  - `Authorization`: `Bearer {{SUPABASE_SERVICE_ROLE_KEY}}`
- Parse response: `Yes` (JSON array of rows)

### Module 3 — HTTP → Make a request

- URL: `https://riketpatel.com/data/email-templates.json`
- Method: `GET`
- Parse response: `Yes` (JSON)

This pulls the latest templates each run, so editing the JSON in the repo updates the workflow automatically — no redeploy of Make.

### Module 4 — Iterator (over Module 2's output, the queued rows)

This loops through each pending row.

### Module 5 — Tools → Set Variables

For each queued row, pick the right template from Module 3's output:

- Variable: `template`
  - Value: `{{get(3.templates; 4.template_id)}}` (looks up the template by id)
- Variable: `recipient_name_or_team`
  - Value: `{{if(length(4.recipient_name) > 0; 4.recipient_name; "team")}}`
- Variable: `subject_filled`
  - Value:
    ```
    {{replace(replace(replace(replace(
      5.template.subject;
      "{recipient_name}"; 5.recipient_name_or_team);
      "{role_title}"; 4.role_title);
      "{company}"; 4.company);
      "{slug}"; 4.slug)}}
    ```
- Variable: `body_filled`
  - Value: same chain of `replace()` calls, plus `{submitted_date}` → `"yesterday"`:
    ```
    {{replace(replace(replace(replace(replace(
      5.template.body;
      "{recipient_name}"; 5.recipient_name_or_team);
      "{role_title}"; 4.role_title);
      "{company}"; 4.company);
      "{slug}"; 4.slug);
      "{submitted_date}"; "yesterday")}}
    ```

(Make.com's expression language uses `replace(str; needle; replacement)`. Chain them.)

### Module 6 — Gmail → Create a Draft

- Connection: `riketpatel@gmail.com`
- To: `{{4.recipient_email}}`
- Subject: `{{5.subject_filled}}`
- Content: `{{5.body_filled}}`
- Content type: `Text` (not HTML)

### Module 7 — Slack → Create a Message (notification)

This is the ping that surfaces the draft in your workspace. Use the Pipeline Bot from Step 0 if you set one up, otherwise the default Make integration.

- **Connection:** the Slack connection you set up (Pipeline Bot or Make default)
- **Channel:** the channel you picked. Make supports either:
  - Channel name: `#applications-pipeline` (or your main org channel)
  - Or channel ID: `C0123ABCDEF` (more reliable; copy from Slack channel details)
- **Message text** (used as the fallback for notifications and the search index):
  ```
  📬 Follow-up draft ready: {{4.company}} — {{4.role_title}}
  ```
- **Blocks** (Block Kit JSON — paste this in the Blocks field):

```json
[
  {
    "type": "header",
    "text": {
      "type": "plain_text",
      "text": "📬 Follow-up draft ready",
      "emoji": true
    }
  },
  {
    "type": "section",
    "fields": [
      {
        "type": "mrkdwn",
        "text": "*Company:*\n{{4.company}}"
      },
      {
        "type": "mrkdwn",
        "text": "*Role:*\n{{4.role_title}}"
      },
      {
        "type": "mrkdwn",
        "text": "*Slug:*\n`{{4.slug}}`"
      },
      {
        "type": "mrkdwn",
        "text": "*Template:*\n`{{4.template_id}}`"
      }
    ]
  },
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "*Subject preview:*\n{{5.subject_filled}}"
    }
  },
  {
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "Open Gmail Drafts",
          "emoji": true
        },
        "url": "https://mail.google.com/mail/u/0/#drafts",
        "style": "primary"
      },
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "View materials",
          "emoji": true
        },
        "url": "https://riketpatel.com/resume/{{4.slug}}/"
      },
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "Pipeline",
          "emoji": true
        },
        "url": "https://riketpatel.com/jobs/"
      }
    ]
  },
  {
    "type": "context",
    "elements": [
      {
        "type": "mrkdwn",
        "text": "Review the draft, edit the parts that need your voice, click send. Then reply in Claude chat: `mark followup sent: {{4.slug}}`"
      }
    ]
  }
]
```

Notes:
- The 3-button row gives you one-click access to: the Gmail draft, the tailored materials, and the dashboard
- The context line at the bottom reminds you of the chat trigger to flip status
- `{{4.slug}}` and `{{4.company}}` etc. are Make.com variables from the iterator (Module 4)
- `{{5.subject_filled}}` is the interpolated subject from Module 5

### Module 8 — Supabase → Update Row (or HTTP PATCH)

If Make's Supabase module is available:
- Connection: same service_role connection
- Table: `application_followups`
- Filter: `id` equals `{{4.id}}`
- Set columns:
  - `status`: `draft_created`
  - `drafted_at`: `{{now}}`
  - `gmail_draft_id`: `{{6.id}}` (the Gmail draft ID from Module 6)

If using HTTP fallback:
- URL: `https://doxmbwizpsyqruyrmffs.supabase.co/rest/v1/application_followups?id=eq.{{4.id}}`
- Method: `PATCH`
- Headers:
  - `apikey`: `{{SUPABASE_SERVICE_ROLE_KEY}}`
  - `Authorization`: `Bearer {{SUPABASE_SERVICE_ROLE_KEY}}`
  - `Content-Type`: `application/json`
- Body:
  ```json
  {
    "status": "draft_created",
    "drafted_at": "{{formatDate(now; \"YYYY-MM-DDTHH:mm:ssZ\")}}",
    "gmail_draft_id": "{{6.id}}"
  }
  ```

### Schedule for Scenario B

Already set in Module 1 (every 30 min). Click **Save** and **Activate**.

---

## Step 4 — Wire the webhook URL into riketpatel.com

✅ Already done. `config.js → MAKE_FOLLOWUP_WEBHOOK_URL` is set to the live URL:

```
https://hook.us2.make.com/7x9fftdphh64z0bdwhg91sme9hgp1uvn
```

---

## Step 5 — Test the end-to-end flow

Run this curl from any terminal (or have Claude do it from chat):

```bash
curl -X POST "https://hook.us2.make.com/7x9fftdphh64z0bdwhg91sme9hgp1uvn" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test",
    "company": "Test Co",
    "role_title": "Test Role",
    "recipient_name": "Test team",
    "recipient_email": "riketpatel+test@gmail.com",
    "template_id": "default_24h_followup",
    "submitted_at_iso": "2026-05-25T00:00:00Z",
    "delay_hours": 0
  }'
```

`delay_hours: 0` means the row is immediately eligible — the next run of Scenario B (within 30 min) should pick it up and create a draft.

**Success looks like:**
1. Curl returns 200 with `{"queued": true, ...}`
2. Make.com → Scenario A history shows 1 execution, green
3. Supabase: `select * from application_followups where slug='test'` returns the row
4. Within 30 min, Scenario B fires and creates a Gmail draft
5. A Slack message lands in `#applications-pipeline` (or your chosen channel) from Pipeline Bot with the 3-button card
6. The draft is in `riketpatel@gmail.com` → Drafts folder
7. The Supabase row's status flipped to `draft_created` with `gmail_draft_id` populated

---

## Step 6 — Wire the trigger to Claude's chat workflow

In conversation with Claude (this assistant), the trigger phrase is:

> `mark submitted: {slug}`

Example: `mark submitted: humin`

When Claude sees this, it:
1. Updates `data/applications.json` → status: `submitted`, `submitted_at`: now
2. Commits + pushes
3. Posts to the Make.com webhook with the slug + template_id + recipient info from the application's row

The webhook payload Claude sends is built from the application's row in `applications.json`. The `template_id` defaults to `{slug}_24h_followup` if a custom template exists, otherwise `default_24h_followup`.

---

## Future upgrades

**v2 — 7-day check-in:** add a second template (`default_7d_checkin`) that auto-queues if status hasn't progressed beyond `followup_sent` after 7 days.

**v3 — Outcome detection:** new Make scenario watches `riketpatel@gmail.com` inbox for messages matching application-related patterns (interview invites, rejection emails, "next steps") and auto-updates the application status in `applications.json` via the GitHub API.

**v4 — Recruiter LinkedIn enrichment:** when a row is added with no `recipient_email`, use Apollo / Hunter API to look up the hiring manager and populate the field.

**v5 — Dashboard write-back:** add Data Store rows to the `/jobs/` dashboard so Riket can see "follow-up queued for T+24h" inline with the application card.
