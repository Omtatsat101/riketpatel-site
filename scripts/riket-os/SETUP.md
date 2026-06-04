# Riket OS — Drive Folder Setup Runbook

10-minute setup. Creates a master folder hierarchy in Google Drive where everything Riket-OS-related lives in one place: editable Sheets, document templates, signals, output artifacts.

## Why this exists

Before this script, your operating data was split across:
- GitHub JSON files (versioned but Git-only edits)
- Supabase tables (great for automation, opaque for hand-editing)
- Various Drive folders + Sheets (Personal Development, Contacts)

This script consolidates them under one **`Riket OS`** folder in your Drive root, with editable Sheets for the things you might want to hand-edit (wins, todos, outreach). The riketpatel.com dashboards read from a single routing web app URL, with graceful fallback to the GitHub JSON if the URL isn't configured.

## What it creates

```
/Riket OS/
  README — Riket OS.gdoc           ← folder map + how-it-works
  01-Applications/
    Wins.gsheet                    ← bootstrapped from data/wins.json
    Email Todos.gsheet             ← bootstrapped from data/email-todos.json
    Outreach.gsheet                ← bootstrapped from data/outreach.json
  02-Templates/                    ← placeholder
  03-Capability/                   ← placeholder
  04-Interview Prep/               ← placeholder
  05-Contacts/                     ← move existing Riket Contacts sheet here (manual)
  06-Signals/                      ← placeholder (signals live in Supabase)
  07-Output/                       ← placeholder for daily briefs / weekly summaries
```

After bootstrap, the Sheets become the source of truth for those three data types. Edits in Drive propagate to the dashboards via the routing web app.

---

## Step 1 — Create the Apps Script (5 min)

1. Sign into the Gmail account whose Drive should own the folder (recommended: `riketpatel@gmail.com`).
2. Go to https://script.google.com → **New project**.
3. Name: `Riket OS — Master`.
4. Delete the boilerplate and paste the entire contents of `scripts/riket-os/master.gs`.
5. **Save**.

## Step 2 — First run

1. Function dropdown → `setupRiketOS` → **Run**.
2. Apps Script requests permissions:
   - **Drive** (create + read folders and files)
   - **Sheets** (read + write the new sheets)
   - **Docs** (create the README doc)
   - **External requests** (fetch the bootstrap JSON from riketpatel.com)
3. Approve all.
4. Watch the execution log:
   - `Root folder: Riket OS (id=...)`
   - `Subfolders ensured: 01-Applications, 02-Templates, ...`
   - `Wins sheet bootstrapped with 25 rows.`
   - `Todos sheet bootstrapped with 7 rows.`
   - `Outreach sheet bootstrapped with 1 rows.`
   - `Setup complete.`
5. Open Drive (https://drive.google.com) — you should see the new **Riket OS** folder at the top level.
6. Click into it, open the README doc, browse the subfolders.

## Step 3 — (Optional) Move existing Contacts sheet under Riket OS

The contacts sync (from `gmail-extractor.gs`) wrote to a sheet titled "Riket Contacts" earlier in your Drive. To consolidate:

1. In Drive, find the `Riket Contacts` sheet.
2. Right-click → **Move to** → navigate to **Riket OS / 05-Contacts**.

This is purely organizational — the existing `gmail-extractor.gs` keeps working since it references the sheet by URL.

## Step 4 — Deploy as routing web app

1. In the Apps Script editor: **Deploy** → **New deployment** → choose **Web app**.
2. Description: `Riket OS routing endpoint`.
3. Execute as: **Me**.
4. Who has access: **Anyone** (URL is the secret — treat like a private API key).
5. Click **Deploy** and copy the web app URL.

The URL looks like `https://script.google.com/macros/s/{long-id}/exec`.

## Step 5 — Wire the URL into riketpatel.com

Edit `riketpatel-site/config.js`:

```js
window.RP_CONFIG = {
  // ...existing config...
  RIKET_OS_WEB_APP_URL: "https://script.google.com/macros/s/{your-id}/exec",
};
```

Commit and push.

## Step 6 — Test the routing endpoint

Open in a browser (or curl):

- `https://script.google.com/macros/s/{your-id}/exec?type=index` — returns folder + sheet IDs
- `?type=wins` — returns the wins shape
- `?type=todos` — returns the todos shape
- `?type=outreach` — returns the outreach shape

If JSON renders, you're done.

---

## How the dashboards use this

Dashboards (`/jobs/`, `/admin/`, `/digest/`, `/outreach/`) pull data with this fallback chain:

```
1. Try fetch RIKET_OS_WEB_APP_URL?type=<x>  (live, editable in Drive)
2. If fail → fall back to data/<x>.json     (versioned in GitHub)
```

If you edit a value in the Drive sheet, the dashboards reflect it on next page load (no Git commit needed). If you want the change to persist into the GitHub repo (e.g., for the long-term archive), tell Claude in chat: `sync drive to repo: wins` and the JSON file gets regenerated and committed.

---

## What does NOT live in Drive

These stay in their current homes by design:

| Data | Lives where | Why |
|---|---|---|
| `applications.json` | GitHub repo | Frequently mutated by Claude in chat (status flips, new applications) — Git is the right log here |
| `application_followups` | Supabase | Worker-driven queue; needs SQL-style filtering by `run_at` and `status` |
| `application_status_signals` | Supabase | Same as above; signals need a unique index on `gmail_message_id` |
| `recommendations.json` | GitHub repo | Static brag-wall data; rarely changes |
| `blog-posts.json` | GitHub repo | Manifest paired with static HTML files on disk |
| `email-templates.json` | GitHub repo | Versioned; the Make/Worker scenarios fetch directly from riketpatel.com |
| Riket Contacts sheet | Drive (separate sheet) | Written by `gmail-extractor.gs` on a daily schedule |

The split is: **automated/frequent → Git or Supabase. Manual/occasional → Drive.**

---

## Disable / debug / rotate

- **Disable a sheet from the routing endpoint:** remove its `SHEET_ID_<source>` property from Script Properties.
- **Force a fresh bootstrap (re-pull from GitHub):** delete the relevant Sheet in Drive + delete its `SHEET_ID_<source>` property, then re-run `setupRiketOS`.
- **Rotate the web app URL (if leaked):** Deploy → **Manage deployments** → archive the existing one, create new. Update `config.js` with the new URL.
- **Show me where the folder is:** run `showFolderUrl()` — it logs the Drive URL.

---

## Future enhancements

1. **Write-back to GitHub** — when a Drive sheet changes, this script commits the regenerated JSON to `riketpatel-site/data/*.json` via the GitHub API. Requires a PAT in Script Properties.
2. **Daily snapshot to 07-Output/** — generate a PDF of `/digest/` content and drop it in `07-Output/Daily Briefs/{YYYY-MM-DD}.pdf` every morning. Email the link.
3. **Weekly summary** — every Friday, generate a summary doc covering shipped wins this week + applied jobs + drafted follow-ups + interviews scheduled.
4. **Move Personal Development structure under here** — migrate `5 - Personal Development/` from local Desktop into `Riket OS / 03-Capability` so it's all in one tree.
