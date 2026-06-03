# Make.com Follow-up Scenarios — Setup Runbook

20-minute setup. Two scenarios + one Data Store + a Slack channel. After this, every application Riket marks as `submitted` automatically gets a follow-up Gmail draft created at T+24h, with Riket pinged on Slack to review and send.

Per the **Drafts-Only rule**: Make.com creates Gmail DRAFTS. Riket clicks Send.

---

## Architecture in one diagram

```
[Claude updates applications.json → status: submitted]
        ↓
[Claude posts to Make.com Webhook A]
        ↓
[Scenario A: "RP — Queue Follow-up"]
   - Receives slug, template_id, recipient
   - Adds row to Data Store: rp_followup_queue
   - Returns 200
        ↓ ⏰ time passes (24h, 7d, 30d depending on template)
        ↓
[Scenario B: "RP — Process Follow-up Queue"]  ←  Runs every 30 min on schedule
   - Searches Data Store for rows where run_at < now AND status = pending
   - For each:
     - Fetches email-templates.json from riketpatel.com
     - Interpolates {recipient_name}, {role_title}, etc.
     - Creates Gmail DRAFT in riketpatel@gmail.com (account)
     - Posts a Slack message to #applications-pipeline (or wherever Riket configured)
       with company / role / subject preview / direct link to Gmail Drafts
     - Marks Data Store row status = draft_created
```

The Slack notification is the only signal Riket needs — it surfaces the draft, has a one-click link to Gmail, and stays in the workspace context Riket already lives in. No more email-to-self pings.

---

## Prerequisites

| | What | Notes |
|---|---|---|
| ☐ | Make.com account with Core plan or better | $9/mo. You already have this per primer.md (11 active scenarios). |
| ☐ | Gmail OAuth connection in Make for `riketpatel@gmail.com` | Used to create the Gmail drafts. |
| ☐ | Slack OAuth connection in Make for your main workspace | Used to ping you on Slack when a draft is ready. |
| ☐ | A Slack channel for these notifications | Recommended: a dedicated `#applications-pipeline` channel (clean signal), OR your main org channel if you want it visible to your team. Decide before Step 3. |
| ☐ | The slug for this scenario suite: `rp-followup` | Use this prefix on all module names so they group cleanly in Make. |

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

## Step 1 — Create the Data Store

In Make.com → **Data Stores → Add data store**.

| Setting | Value |
|---|---|
| Name | `rp_followup_queue` |
| Data structure | Create new (see below) |
| Data storage size | 1 MB is fine — each row is ~1KB so this holds 1000+ queued follow-ups |

**Data structure** (call it `rp_followup_row`):

| Field name | Type | Notes |
|---|---|---|
| `id` | Text | Primary key. Format: `{slug}__{template_id}__{submitted_at_iso}` |
| `slug` | Text | e.g. `humin` |
| `company` | Text | |
| `role_title` | Text | |
| `recipient_name` | Text | Defaults to `team` if missing |
| `recipient_email` | Text | Gmail To: field |
| `template_id` | Text | e.g. `humin_24h_followup` |
| `submitted_at_iso` | Date | When the app was submitted |
| `run_at_iso` | Date | When to create the draft (submitted_at + template.delay_hours) |
| `status` | Text | `pending` → `draft_created` → `sent` (Riket can update manually) |
| `drafted_at_iso` | Date | When Make created the draft |
| `notes` | Text | Free text |

---

## Step 2 — Create Scenario A: "RP — Queue Follow-up"

This is the webhook receiver. It runs once per submission.

### Module 1 — Custom Webhook (trigger)

Add module → **Webhooks → Custom Webhook**.

- Click **Add** to create a new webhook
- Name: `rp-followup-queue`
- Click **Save** and copy the URL Make.com gives you
- This URL becomes `RP_CONFIG.MAKE_FOLLOWUP_WEBHOOK_URL` in config.js

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

Click **Run once** with a sample payload to let Make learn the structure.

### Module 2 — Tools → Set Variables

- Variable: `run_at_iso`
  - Value: `{{addHours(parseDate(1.submitted_at_iso; "YYYY-MM-DDTHH:mm:ssZ"); 1.delay_hours)}}`
- Variable: `id`
  - Value: `{{1.slug}}__{{1.template_id}}__{{1.submitted_at_iso}}`

### Module 3 — Data Stores → Add/Replace a Record

- Data store: `rp_followup_queue`
- Key: `{{2.id}}` (the id from Module 2)
- Record:
  - `id`: `{{2.id}}`
  - `slug`: `{{1.slug}}`
  - `company`: `{{1.company}}`
  - `role_title`: `{{1.role_title}}`
  - `recipient_name`: `{{1.recipient_name}}`
  - `recipient_email`: `{{1.recipient_email}}`
  - `template_id`: `{{1.template_id}}`
  - `submitted_at_iso`: `{{1.submitted_at_iso}}`
  - `run_at_iso`: `{{2.run_at_iso}}`
  - `status`: `pending`

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

### Module 2 — Data Stores → Search Records

- Data store: `rp_followup_queue`
- Filter:
  - `status` equals `pending`
  - AND `run_at_iso` less than `{{now}}`
- Limit: `20` rows per run (defensive)

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

### Module 8 — Data Stores → Update a Record

- Data store: `rp_followup_queue`
- Key: `{{4.id}}`
- Record updates:
  - `status`: `draft_created`
  - `drafted_at_iso`: `{{now}}`

### Schedule for Scenario B

Already set in Module 1 (every 30 min). Click **Save** and **Activate**.

---

## Step 4 — Wire the webhook URL into riketpatel.com

After Scenario A is created, Make.com gives you a URL like:

```
https://hook.us2.make.com/abc123def456...
```

Edit `config.js` in the repo:

```js
window.RP_CONFIG = {
  // ...existing config...

  // Make.com follow-up webhook (Scenario A). Posting here queues a
  // follow-up. Keep this value out of public Git if you can — even
  // though it's a write-only endpoint, anyone with the URL can spam
  // it. For now it lives in config.js as a soft secret.
  MAKE_FOLLOWUP_WEBHOOK_URL: "PASTE_YOUR_MAKE_WEBHOOK_URL_HERE",
};
```

Commit and push.

---

## Step 5 — Test the end-to-end flow

Run this curl from any terminal (or have Claude do it):

```bash
curl -X POST "$MAKE_FOLLOWUP_WEBHOOK_URL" \
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
3. Within 30 min, Scenario B fires and creates a Gmail draft
4. A Slack message lands in `#applications-pipeline` (or your chosen channel) from Pipeline Bot with the 3-button card
5. The draft is in `riketpatel@gmail.com` → Drafts folder
6. The Data Store row's status flipped to `draft_created`

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
