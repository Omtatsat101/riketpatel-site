/* riketpatel.com — public client config.
 *
 * Everything here is intentionally public-facing:
 *  - Supabase anon key is gated by row-level-security policies (insert-only on `leads`).
 *  - GA4 measurement IDs are public by design.
 *  - Web3Forms access keys are public; spam protection is server-side.
 *
 * Anything sensitive (service_role keys, secrets) MUST stay out of this file.
 */
window.RP_CONFIG = {
  SUPABASE_URL: "https://doxmbwizpsyqruyrmffs.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveG1id2l6cHN5cXJ1eXJtZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDUwNjMsImV4cCI6MjA5MTYyMTA2M30.o9o4UCBib6L1w3glbSi97fyxTQQH548ACZ8nut91CwI",
  GA4_MEASUREMENT_ID: "G-383FDKRG70",
  WEB3FORMS_KEY_RIKETPATEL: "REPLACE_WITH_WEB3FORMS_KEY_RIKETPATEL"
};
