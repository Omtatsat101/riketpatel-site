#!/usr/bin/env node
// generate.mjs — scaffold a new interview-prep workspace for a given slug.
//
// Usage:
//   node scripts/interview-prep/generate.mjs --slug nj-innovation
//   node scripts/interview-prep/generate.mjs --slug nj-innovation --force  (overwrite if exists)
//
// What it does:
//   1. Reads data/applications.json
//   2. Finds the row by --slug (matches `id` or `materials_slug`)
//   3. Loads scripts/interview-prep/template.html
//   4. Substitutes {{placeholders}} with the application row's data
//   5. Writes the new file to interview-prep/{slug}/index.html
//
// What it does NOT do:
//   - Run a research pass on the company (you / Claude do that next)
//   - Auto-fill STAR stories (those are Riket's; vary per role)
//   - Auto-fill comp research (Riket should look up actual benchmarks)
//
// Designed to be invoked by Claude when Riket says
//   "interview prep for {slug}"
// in chat. Claude runs the script, then optionally does a research
// pass to populate sections 1-2 with company-specific intel.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

function parseArgs() {
  const out = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = process.argv[i + 1];
      if (next && !next.startsWith("--")) { out[key] = next; i++; }
      else { out[key] = true; }
    }
  }
  return out;
}

function fmtSalary(min, max) {
  if (!min && !max) return "Not posted";
  if (min && max) return `USD $${Math.round(min/1000)}K – $${Math.round(max/1000)}K`;
  if (max) return `Up to USD $${Math.round(max/1000)}K`;
  return `From USD $${Math.round(min/1000)}K`;
}

const args = parseArgs();
if (!args.slug) {
  console.error("Usage: node scripts/interview-prep/generate.mjs --slug {slug} [--force]");
  process.exit(2);
}

const slug = String(args.slug);

// Load applications
const appsPath = path.join(ROOT, "data", "applications.json");
const apps = JSON.parse(fs.readFileSync(appsPath, "utf8"));
const app = (apps.applications || []).find(a => a.materials_slug === slug || a.id === slug);
if (!app) {
  console.error(`Slug "${slug}" not found in data/applications.json.`);
  process.exit(3);
}

// Load template
const tmplPath = path.join(__dirname, "template.html");
const tmpl = fs.readFileSync(tmplPath, "utf8");

// Build replacement map
const contacts = Array.isArray(app.contacts) && app.contacts.length
  ? app.contacts
  : (app.contact_name || app.contact_email
      ? [{ name: app.contact_name, email: app.contact_email, linkedin: app.contact_linkedin }]
      : []);
const contactsHtml = contacts.length
  ? `<ul>${contacts.map(c => {
      const parts = [`<strong>${c.name || "TBD"}</strong>`];
      if (c.title) parts.push(`<em>· ${c.title}</em>`);
      if (c.email) parts.push(`<a href="mailto:${c.email}">${c.email}</a>`);
      if (c.linkedin) parts.push(`<a href="${c.linkedin}" target="_blank">LinkedIn ↗</a>`);
      return `<li>${parts.join(" · ")}${c.notes ? `<br/><span style="font-size:11.5px;color:#5a5a5a;">${c.notes}</span>` : ""}</li>`;
    }).join("\n      ")}</ul>`
  : "<p><em>No named contacts yet. Update via Claude: <code>add contact to " + slug + ": Name, Title, email</code></em></p>";

const replacements = {
  "{{SLUG}}": slug,
  "{{COMPANY}}": app.company || "",
  "{{ROLE_TITLE}}": app.role_title || "",
  "{{SALARY_RANGE}}": fmtSalary(app.salary_min, app.salary_max),
  "{{LOCATION}}": app.location || "Not specified",
  "{{STATUS}}": app.status || "",
  "{{JD_URL}}": app.jd_url || "#",
  "{{JOB_BOARD}}": app.job_board || "",
  "{{NOTES}}": app.notes || "(no notes)",
  "{{ADDED_AT}}": app.added_at || "",
  "{{SUBMITTED_AT}}": app.submitted_at || "Not yet submitted",
  "{{CONTACTS_HTML}}": contactsHtml,
  "{{GENERATED_AT}}": new Date().toISOString().slice(0, 10),
};

let out = tmpl;
for (const [k, v] of Object.entries(replacements)) {
  out = out.split(k).join(v);
}

// Write
const outDir = path.join(ROOT, "interview-prep", slug);
const outFile = path.join(outDir, "index.html");
if (fs.existsSync(outFile) && !args.force) {
  console.error(`File already exists at interview-prep/${slug}/index.html. Pass --force to overwrite.`);
  process.exit(4);
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, out);

console.log(`✓ Wrote interview-prep/${slug}/index.html (${(out.length / 1024).toFixed(1)} KB)`);
console.log(`  Visit https://riketpatel.com/interview-prep/${slug}/ after the next push.`);
console.log("");
console.log("Next steps:");
console.log("  1. Run a research pass on the company (or have Claude do it)");
console.log("  2. Fill in the bullets in sections 1 (Company) and 2 (Role) with specifics");
console.log("  3. Customize section 4 (Q&A) for the role's specific likely questions");
console.log("  4. Update section 7 (Comp) with actual market benchmarks");
console.log("  5. Commit + push");
