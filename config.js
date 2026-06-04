/* riketpatel.com — public client config.
 *
 * Everything here is intentionally public-facing:
 *  - Supabase anon key is gated by row-level-security policies (insert-only on `leads`).
 *  - GA4 measurement IDs are public by design.
 *  - Web3Forms access keys are public; spam protection is server-side.
 *  - Google Apps Script web-app URL is public; the script runs as Riket and
 *    appends to a private Sheet.
 *  - Google Calendar Appointment Schedule URL is the same URL you'd share with
 *    anyone you want to book you.
 *
 * Anything sensitive (Supabase service_role, OAuth client secrets) MUST stay
 * out of this file.
 */
window.RP_CONFIG = {
  /* Supabase — leads table (INSERT-only RLS for anon role). */
  SUPABASE_URL: "https://doxmbwizpsyqruyrmffs.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveG1id2l6cHN5cXJ1eXJtZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDUwNjMsImV4cCI6MjA5MTYyMTA2M30.o9o4UCBib6L1w3glbSi97fyxTQQH548ACZ8nut91CwI",

  /* GA4 — single property for now (the Kiddie Brand property); split later when warranted. */
  GA4_MEASUREMENT_ID: "G-383FDKRG70",

  /* Web3Forms — register at https://web3forms.com USING
   *   riketpatel@hariomtatsatinvestments.com  (your master inbox)
   * as the destination email. That's where every form submission lands.
   * Visible public email on the site is Riketpatel@gmail.com; form
   * notifications stay on the master so everything funnels into one inbox.
   */
  WEB3FORMS_KEY_RIKETPATEL: "REPLACE_WITH_WEB3FORMS_KEY_RIKETPATEL",

  /* Google Apps Script web app endpoint — see GOOGLE-WORKSPACE-SETUP.md */
  GOOGLE_SHEETS_WEBHOOK_URL: "REPLACE_WITH_APPS_SCRIPT_WEBAPP_URL",

  /* Google Calendar Appointment Schedule public URL — see GOOGLE-WORKSPACE-SETUP.md */
  GOOGLE_CALENDAR_APPT_URL: "REPLACE_WITH_GOOGLE_CALENDAR_APPT_URL",

  /* Instagram — see INSTAGRAM-SETUP.md.
   * Pick ONE of three render modes:
   *   1) "lightwidget"  — paste the LightWidget iframe src into INSTAGRAM_EMBED_URL
   *   2) "json"         — leave embed empty; data/instagram.json drives the grid
   *   3) "" (default)   — empty; the grid shows a placeholder until you wire it
   */
  INSTAGRAM_HANDLE: "riket.patel",
  INSTAGRAM_EMBED_URL: "",
  INSTAGRAM_MODE: "json",

  /* Admin gate moved to ohm.homes/admin (Cloudflare Worker, env-var gated).
   * This site no longer hosts an admin endpoint — see commit 8cdc030.
   * The old ADMIN_PASSWORD key has been removed (was leaked in this public file).
   *
   * Family tab password stays here on purpose — it's a SOFT lock (the password
   * is shown on the page itself so family who land here can click in). Defeats
   * casual / search-engine visitors, not real attackers. Do NOT reuse this
   * value anywhere that needs real security.
   */
  ADMIN_FAMILY_PASSWORD: "Family137",

  /* AI Product Management capstone download — separate password.
   * Files live at assets/downloads/private/ with obfuscated filenames so
   * they're not casually crawlable. Share the password with people you
   * want to give the deck to (recruiters, future teammates). To rotate:
   * change this value AND rename the two files in the private folder.
   */
  AIPM_DOWNLOAD_PASSWORD: "AIPM137",

  /* Applications pipeline dashboard at /jobs/ — separate password.
   * Soft lock; the dashboard reads from data/applications.json which is
   * publicly available in the repo. The point is to keep the URL out of
   * search results + casual visitors, not to hide from a real attacker.
   * Don't put genuinely sensitive data in the JSON.
   */
  JOBS_PIPELINE_PASSWORD: "Pipeline137",

  /* Make.com webhook for queuing follow-up emails. POST a payload
   * matching scripts/make-com-followup-setup.md to this URL when an
   * application status flips to "submitted". Make.com queues the
   * follow-up, creates a Gmail DRAFT at T+24h (Drafts-Only rule), and
   * pings the Slack channel below.
   *
   * IMPORTANT: paste your real Make.com webhook URL here after running
   * scripts/make-com-followup-setup.md. Until then, the queue-followup
   * helper script will skip the webhook call and just print a warning.
   */
  MAKE_FOLLOWUP_WEBHOOK_URL: "https://hook.us2.make.com/7x9fftdphh64z0bdwhg91sme9hgp1uvn",

  /* Slack channel where Pipeline Bot posts the follow-up draft ping.
   * Configured in Make.com Scenario B Module 7. This value is reference
   * only (Make.com is the actual source of truth). Update both here and
   * in Make if you change channels.
   *
   * Recommended: a dedicated channel like #applications-pipeline so the
   * signal stays clean. Or use your main org channel if you want the
   * team to see it.
   */
  SLACK_PIPELINE_CHANNEL: "#applications-pipeline",
  SLACK_PIPELINE_BOT_NAME: "Pipeline Bot",

  /* Admin module at /admin/ — single password gate for Riket only.
   * Hidden by obscurity (URL not linked from public pages) + this soft
   * lock. For real privacy upgrades later: Supabase magic-link auth
   * sending to riketpatel@hariomtatsatinvestments.com.
   *
   * To rotate: change this value here, push, and remember the new
   * password. The localStorage key resets on the next visit.
   */
  ADMIN_PASSWORD: "RPAdmin2026",

  /* Google Apps Script web app URL that returns contacts JSON from the
   * "Riket Contacts" Sheet in Drive. Installed per Gmail account.
   * Setup: scripts/contacts/SETUP.md. Until configured, /contacts/
   * shows a setup banner with instructions.
   *
   * The URL is the soft secret — anyone with it can hit the endpoint and
   * read the contacts JSON. The dashboard is gated by Pipeline137. If
   * the URL leaks, redeploy from Apps Script (new ID, paste new URL here).
   */
  GOOGLE_CONTACTS_WEB_APP_URL: "REPLACE_WITH_APPS_SCRIPT_WEB_APP_URL",

  /* GitHub repo identifier used for deep-linking to the web editor. */
  GITHUB_REPO: "Omtatsat101/riketpatel-site"
};
