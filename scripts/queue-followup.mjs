#!/usr/bin/env node
// queue-followup.mjs — fire the Make.com follow-up webhook from local or CI
//
// Used by Claude when Riket says "mark submitted: {slug}". Steps:
//   1. Read data/applications.json
//   2. Find the row by --slug
//   3. Build the webhook payload (slug, company, role_title, recipient*,
//      template_id, submitted_at_iso, delay_hours)
//   4. POST to Make.com webhook (URL from MAKE_FOLLOWUP_WEBHOOK_URL env or
//      from config.js)
//
// Usage:
//   node scripts/queue-followup.mjs --slug humin
//   node scripts/queue-followup.mjs --slug humin --template humin_24h_followup
//   node scripts/queue-followup.mjs --slug humin --recipient "Heather <heather@x.com>"
//
// The script DOES NOT update applications.json. That's Claude's job in chat
// (he writes the status flip + commits + pushes BEFORE calling this script).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Args ────────────────────────────────────────────────
function parseArgs() {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = process.argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else { out[key] = true; }
    }
  }
  return out;
}
const args = parseArgs();
if (!args.slug) {
  console.error('Usage: node scripts/queue-followup.mjs --slug {slug} [--template {template_id}] [--recipient "Name <email>"]');
  process.exit(2);
}

// ── Read applications.json + email-templates.json ─────────
const appsPath = path.join(ROOT, 'data', 'applications.json');
const tmplPath = path.join(ROOT, 'data', 'email-templates.json');

const apps = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
const tmpls = JSON.parse(fs.readFileSync(tmplPath, 'utf8'));

const row = (apps.applications || []).find((a) => a.id === args.slug || a.materials_slug === args.slug);
if (!row) {
  console.error(`No row found for slug "${args.slug}". Add it to data/applications.json first.`);
  process.exit(3);
}

// Status must be "submitted" before queuing the follow-up
if (row.status !== 'submitted') {
  console.error(`Row "${args.slug}" has status "${row.status}", not "submitted". Run the status flip first.`);
  process.exit(4);
}

// ── Pick the template ──────────────────────────────────────
// Default: try {materials_slug}_24h_followup, fall back to default_24h_followup
const slug = row.materials_slug || row.id;
const candidateTemplate = `${slug.replace(/-/g, '_')}_24h_followup`;
const templateId = args.template
  || (tmpls.templates[candidateTemplate] ? candidateTemplate : 'default_24h_followup');

const template = tmpls.templates[templateId];
if (!template) {
  console.error(`Template "${templateId}" not found in data/email-templates.json.`);
  process.exit(5);
}

// ── Recipient parsing ──────────────────────────────────────
// Accept either --recipient "Name <email>" or fall back to row.contact_name / contact_email
let recipientName = row.contact_name || 'team';
let recipientEmail = row.contact_email || '';
if (args.recipient) {
  const m = String(args.recipient).match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (m) { recipientName = m[1].trim() || recipientName; recipientEmail = m[2].trim(); }
  else { recipientEmail = String(args.recipient).trim(); }
}
if (!recipientEmail) {
  console.warn('⚠️  No recipient_email set. The Gmail draft will be created without a To: address.');
  console.warn('    Pass --recipient "Name <email>" or set contact_email on the application row.');
}

// ── Build webhook payload ──────────────────────────────────
const payload = {
  slug,
  company: row.company,
  role_title: row.role_title,
  recipient_name: recipientName,
  recipient_email: recipientEmail,
  template_id: templateId,
  submitted_at_iso: row.submitted_at || new Date().toISOString(),
  delay_hours: template.delay_hours || 24,
};

// ── Resolve the webhook URL ────────────────────────────────
let webhookUrl = process.env.MAKE_FOLLOWUP_WEBHOOK_URL;
if (!webhookUrl) {
  // Try to extract from config.js
  try {
    const cfg = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
    const m = cfg.match(/MAKE_FOLLOWUP_WEBHOOK_URL:\s*"([^"]+)"/);
    if (m) webhookUrl = m[1];
  } catch {}
}
if (!webhookUrl || webhookUrl.startsWith('REPLACE_WITH')) {
  console.warn('⚠️  MAKE_FOLLOWUP_WEBHOOK_URL not configured. Skipping webhook call.');
  console.warn('    Set it in config.js (after running scripts/make-com-followup-setup.md)');
  console.warn('    or pass via env: MAKE_FOLLOWUP_WEBHOOK_URL=https://... node scripts/queue-followup.mjs --slug humin');
  console.log('\nPayload that would have been sent:');
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

// ── Fire the webhook ───────────────────────────────────────
console.log(`POST → ${webhookUrl}`);
console.log(JSON.stringify(payload, null, 2));

try {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log(`\n← ${res.status} ${res.statusText}`);
  console.log(text);
  if (!res.ok) process.exit(6);
} catch (e) {
  console.error('Webhook call failed:', e.message);
  process.exit(7);
}

console.log(`\n✓ Follow-up queued for "${slug}" using template "${templateId}".`);
console.log(`  Make.com will create a Gmail draft at ${new Date(Date.parse(payload.submitted_at_iso) + payload.delay_hours * 3600 * 1000).toISOString()}.`);
