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

  /* Web3Forms — register at https://web3forms.com with hey@riketpatel.com */
  WEB3FORMS_KEY_RIKETPATEL: "REPLACE_WITH_WEB3FORMS_KEY_RIKETPATEL",

  /* Google Apps Script web app endpoint — see GOOGLE-WORKSPACE-SETUP.md */
  GOOGLE_SHEETS_WEBHOOK_URL: "REPLACE_WITH_APPS_SCRIPT_WEBAPP_URL",

  /* Google Calendar Appointment Schedule public URL — see GOOGLE-WORKSPACE-SETUP.md */
  GOOGLE_CALENDAR_APPT_URL: "REPLACE_WITH_GOOGLE_CALENDAR_APPT_URL"
};
