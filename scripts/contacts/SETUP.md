# Contacts Sync — Setup Runbook

Goal: Gmail-to-Drive contact extraction, exposed as a web app endpoint that the `/contacts/` page on riketpatel.com pulls from.

15-minute setup per Gmail account. Two Gmail accounts you probably want to install in: `riketpatel@gmail.com` and `riketpatel@hariomtatsatinvestments.com`. Both write to the same Drive Sheet (different `source_account` tag per row).

---

## Architecture

```
[Gmail inbox A: riketpatel@gmail.com]
    ↓ daily Apps Script run
[Gmail inbox B: riketpatel@hariomtatsatinvestments.com]
    ↓ daily Apps Script run
    ↓
[Single Google Sheet in Drive: "Riket Contacts" → "All Contacts" tab]
    ↑ doGet() web app endpoint returns JSON
    ↓
[https://riketpatel.com/contacts/ dashboard]
    ↓ fetches the web app URL configured in config.js
[Renders cards / table with filters + search]
```

Each row has a `source_account` column distinguishing which inbox it came from. `notes` and `tags` columns are preserved across syncs so you can hand-edit them in the Sheet.

---

## Step 1 — Create the Sheet in Drive (3 min)

1. Go to https://sheets.new and create a blank sheet.
2. Rename it `Riket Contacts`.
3. Rename the first tab `All Contacts`.
4. Copy the full Sheet URL from the address bar (looks like `https://docs.google.com/spreadsheets/d/{long-id}/edit`).
5. Set the Sheet's sharing to "Only people with access" (default) — this is your private CRM. Don't make it public.

---

## Step 2 — Install Apps Script in Gmail account A (5 min)

1. Sign into the Gmail account where you want to extract contacts (e.g., `riketpatel@gmail.com`).
2. Go to https://script.google.com → **New project**.
3. Name the project `Contacts Sync — gmail.com`.
4. Delete the boilerplate `Code.gs` content and paste the entire contents of `scripts/contacts/gmail-extractor.gs` from this repo.
5. At the top, replace `SHEET_URL` with the URL you copied in Step 1.
6. **Save** (Ctrl+S or 💾 icon).
7. **Run** the function `extractAndSync` once manually:
   - Function dropdown → select `extractAndSync` → click **Run**.
   - Apps Script asks for permissions: Gmail (read), Sheets (read/write), Drive (read). Approve.
   - First run does a 365-day sweep — may take 1-2 minutes for a busy inbox.
8. **Install the daily trigger:**
   - Function dropdown → select `setupDailyTrigger` → click **Run**.
   - This creates a trigger that fires `extractAndSync` daily at 06:00 local time.
9. **Deploy as web app** so the dashboard can read the data:
   - **Deploy** menu → **New deployment** → choose **Web app**.
   - Description: `Contacts JSON endpoint`
   - Execute as: **Me** (the Gmail account running the script — needed to access the Sheet)
   - Who has access: **Anyone** (yes, anyone — but the URL is the secret; treat it like a private API key)
   - Click **Deploy** and copy the **Web app URL** (looks like `https://script.google.com/macros/s/{long-id}/exec`).

---

## Step 3 — Install Apps Script in Gmail account B (5 min)

Repeat Step 2 for the second Gmail account (`riketpatel@hariomtatsatinvestments.com`):

1. Sign into the second account.
2. New Apps Script project at https://script.google.com.
3. Paste the same `gmail-extractor.gs`.
4. Use the **same** `SHEET_URL` — both accounts write to the same Sheet.
5. Run `extractAndSync` once, approve permissions.
6. Run `setupDailyTrigger`.
7. Deploy as web app, copy the URL.

**Important:** since you'll have two web app URLs (one per account), the dashboard fetches both and merges. Or you can pick a primary and only use that one — since both accounts wrote to the same Sheet, either web app returns the full merged data.

**Recommendation:** use only ONE web app URL (the most stable account, probably `riketpatel@gmail.com`) as the canonical read endpoint. The other account's Apps Script just writes to the Sheet but doesn't need to expose a web app.

---

## Step 4 — Wire the web app URL into riketpatel.com

Edit `config.js`:

```js
window.RP_CONFIG = {
  // ...existing config...
  GOOGLE_CONTACTS_WEB_APP_URL: "https://script.google.com/macros/s/{your-id}/exec",
};
```

Commit and push. The `/contacts/` dashboard reads from this URL on load.

---

## Step 5 — Test end-to-end

1. Visit https://riketpatel.com/contacts/ (gate code: `Pipeline137`).
2. After unlocking, the page fetches your web app URL.
3. You should see your contacts populated with name, email, last contact date, source account, tags, message count.
4. Filters and search should work.

If the dashboard shows "Failed to load contacts":
- Check that `GOOGLE_CONTACTS_WEB_APP_URL` is set correctly in `config.js`.
- Try opening the web app URL directly in a browser — should return JSON.
- If JSON looks wrong, check the Apps Script execution log (`Executions` in the left sidebar).

---

## How edits work

The script preserves **`tags`** and **`notes`** columns across daily syncs. So:

- **You can hand-edit `tags`** in the Sheet (add custom labels like `humin-recruiter`, `wife-side-family`, `klaviyo-prospect`) and they survive.
- **You can hand-edit `notes`** (add context: "met at conference 2024", "interested in fractional CMO work") and they survive.
- **The script will not overwrite** anything except `msg_count`, `last_seen_at`, `last_synced_at`.

The Sheet is the editable source of truth. The dashboard is read-only.

---

## Disabling, debugging, rotating

- **Pause sync:** in Apps Script, **Triggers** (clock icon, left sidebar) → delete the `extractAndSync` trigger. Restart via `setupDailyTrigger()`.
- **Force a fresh full sync:** Run the function `resetSyncState()` once, then `extractAndSync()`. This re-scans the full `LOOKBACK_DAYS_FIRST_RUN` window (365 days).
- **Rotate the web app URL:** Deploy menu → **Manage deployments** → New version. The URL stays the same; old clients keep working.
- **Revoke if compromised:** Deploy menu → archive the deployment → redeploy fresh. New URL → update `config.js`.

---

## What's NOT extracted (privacy-by-default)

The script extracts only the email headers (From, To, Cc). It does NOT extract:
- Subject lines
- Body content
- Attachments
- Read state
- Labels

If you ever want richer data (e.g., subject lines for context, or auto-extracted action items for the email-todos panel), add it explicitly to the extraction loop in `extractAndSync`. The minimal default is the safest start.

---

## Future enhancements

1. **Sentiment / categorization** — run each contact through a quick LLM pass to auto-tag relationship type (client, recruiter, family, vendor, prospect)
2. **Calendar enrichment** — cross-reference with Google Calendar to add `last_meeting_at` columns
3. **LinkedIn enrichment** — when a contact has a LinkedIn URL in their email signature, capture it
4. **Email-todos auto-population** — when an inbound email contains "please send", "by Friday", "let me know", etc., create an entry in `email-todos.json` automatically
5. **Cross-property linkage** — when a contact's email matches a recruiter for an active application, link the contact card to the pipeline entry
