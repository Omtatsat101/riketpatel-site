/**
 * Riket Contacts — Gmail-to-Drive sync.
 *
 * Install one copy of this script in EACH Gmail account you want to scan
 * (riketpatel@gmail.com, riketpatel@hariomtatsatinvestments.com, etc.).
 * All copies write to the same Google Sheet in Drive (the one whose URL you
 * paste into SHEET_URL below). They share an "All Contacts" tab with a
 * source_account column distinguishing where each contact came from.
 *
 * What it does on each daily run:
 *   1. Searches recent Gmail (inbox + sent) for messages newer than
 *      LOOKBACK_DAYS_INCREMENTAL since the last successful sync, or
 *      LOOKBACK_DAYS_FIRST_RUN on the very first run.
 *   2. Extracts every email address that appeared in From / To / Cc.
 *   3. Dedupes by lower-cased email + source_account.
 *   4. For existing rows: increments msg_count, updates last_seen_at if newer.
 *   5. For new contacts: appends a row with first_seen_at, last_seen_at,
 *      domain, auto-inferred tags (recruiter, automated, merck, etc.), notes.
 *
 * Web app endpoint (doGet):
 *   When deployed as a web app, GET / returns the full contact list as JSON
 *   for the riketpatel.com /contacts/ page to consume. CORS-open by design
 *   so the static site can fetch it.
 *
 * Setup runbook: scripts/contacts/SETUP.md in the riketpatel-site repo.
 */

// ── Config ──────────────────────────────────────────────────────────────────

// PASTE the URL of your "Riket Contacts" Sheet here. Create the sheet first
// in Drive, leave the default first tab named "All Contacts" or change SHEET_TAB.
var SHEET_URL = "PASTE_GOOGLE_SHEET_URL_HERE";
var SHEET_TAB = "All Contacts";

var LOOKBACK_DAYS_FIRST_RUN = 365;
var LOOKBACK_DAYS_INCREMENTAL = 3;
var MAX_THREADS_PER_RUN = 500;

// The account label written to the source_account column — change per install
// so each Gmail account writes a distinguishable value.
var SOURCE_ACCOUNT_LABEL = Session.getActiveUser().getEmail() || "unknown";

// Optional CORS allowlist for the web app endpoint. "*" is fine for a
// password-gated static site (the gate is the secret, not the origin).
var CORS_ORIGIN = "*";

// ── Sheet helpers ───────────────────────────────────────────────────────────

var HEADERS = [
	"key",                  // lowercase(email) + "|" + source_account (primary key)
	"email",                // raw email
	"name",                 // best-known display name
	"domain",               // email after @
	"source_account",       // which Gmail account this row came from
	"first_seen_at",        // ISO timestamp
	"last_seen_at",         // ISO timestamp
	"msg_count",            // # of messages contributing
	"tags",                 // comma-separated inferred tags
	"notes",                // free text, manually editable
	"last_synced_at",       // when this row was last touched by the script
];

function getSheet_() {
	if (!SHEET_URL || SHEET_URL.indexOf("PASTE_") === 0) {
		throw new Error("Configure SHEET_URL at the top of the script.");
	}
	var ss = SpreadsheetApp.openByUrl(SHEET_URL);
	var sheet = ss.getSheetByName(SHEET_TAB);
	if (!sheet) sheet = ss.insertSheet(SHEET_TAB);
	// Ensure headers
	if (sheet.getLastRow() === 0) {
		sheet.appendRow(HEADERS);
		sheet.setFrozenRows(1);
	}
	return sheet;
}

function buildIndex_(sheet) {
	// Map key -> row index (1-based, matching sheet API)
	var index = {};
	if (sheet.getLastRow() < 2) return index;
	var range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
	range.forEach(function (row, i) {
		if (row[0]) index[String(row[0])] = i + 2;
	});
	return index;
}

// ── Gmail parsing ──────────────────────────────────────────────────────────

function parseList_(s) {
	if (!s) return [];
	return s.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (p) { return p.trim(); }).filter(Boolean);
}

function parseAddress_(raw) {
	if (!raw) return null;
	var m = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
	if (m) {
		var name = (m[1] || "").replace(/^["']|["']$/g, "").trim();
		var email = (m[2] || "").trim().toLowerCase();
		return email ? { name: name, email: email } : null;
	}
	var bare = raw.trim().toLowerCase();
	if (bare.indexOf("@") < 0) return null;
	return { name: "", email: bare };
}

function inferTags_(email, name) {
	var tags = [];
	var bag = (email + " " + (name || "")).toLowerCase();
	if (/recruiter|talent|sourcer|hiring/.test(bag)) tags.push("recruiter");
	if (/^(no.?reply|donotreply|notifications?|noreply|alerts?|system|mailer|info|support)@/.test(email)) tags.push("automated");
	if (/@merck\.com$/.test(email)) tags.push("merck");
	if (/@(gmail|yahoo|hotmail|outlook|icloud|aol|me)\.com$/.test(email)) tags.push("personal");
	if (/@(humin|healthyminds|hminnovations)/.test(email)) tags.push("humin");
	if (/@(innovation\.nj\.gov|nj\.gov|state\.nj\.us)$/.test(email)) tags.push("nj-government");
	if (/@(linkedin)\.com$/.test(email)) tags.push("linkedin");
	if (/@(shopify|klaviyo|mailchimp|make\.com|cloudflare|supabase|stripe|github|anthropic)/.test(email)) tags.push("vendor");
	if (/@(hariomtatsatinvestments|riketpatel|mettarealtypartners|mettalegacypartners|kiddiesketch|kiddiego|kiddiewordle|customsketch|legacybridge|safeink)/.test(email)) tags.push("self-domain");
	return tags.join(",");
}

// ── Sync logic ──────────────────────────────────────────────────────────────

function extractAndSync() {
	var sheet = getSheet_();
	var props = PropertiesService.getScriptProperties();
	var lastSyncIso = props.getProperty("last_sync_iso");
	var lookbackDays = lastSyncIso ? LOOKBACK_DAYS_INCREMENTAL : LOOKBACK_DAYS_FIRST_RUN;

	var afterEpoch = Math.floor((Date.now() - lookbackDays * 86400 * 1000) / 1000);
	var query = "after:" + afterEpoch;

	var threads = GmailApp.search(query, 0, MAX_THREADS_PER_RUN);
	if (!threads.length) {
		Logger.log("No new threads. Nothing to do.");
		props.setProperty("last_sync_iso", new Date().toISOString());
		return;
	}

	var index = buildIndex_(sheet);
	var pending = {}; // key -> { row data }
	var nowIso = new Date().toISOString();

	for (var t = 0; t < threads.length; t++) {
		var msgs = threads[t].getMessages();
		for (var m = 0; m < msgs.length; m++) {
			var msg = msgs[m];
			var dateIso = msg.getDate().toISOString();
			var participants = [];
			try { participants.push(msg.getFrom()); } catch (e) {}
			try { participants = participants.concat(parseList_(msg.getTo())); } catch (e) {}
			try { participants = participants.concat(parseList_(msg.getCc())); } catch (e) {}

			for (var p = 0; p < participants.length; p++) {
				var parsed = parseAddress_(participants[p]);
				if (!parsed) continue;
				if (parsed.email === SOURCE_ACCOUNT_LABEL.toLowerCase()) continue; // skip self
				var key = parsed.email + "|" + SOURCE_ACCOUNT_LABEL;

				if (pending[key]) {
					pending[key].msg_count += 1;
					if (dateIso > pending[key].last_seen_at) pending[key].last_seen_at = dateIso;
					if (dateIso < pending[key].first_seen_at) pending[key].first_seen_at = dateIso;
					if (parsed.name && !pending[key].name) pending[key].name = parsed.name;
				} else {
					pending[key] = {
						key: key,
						email: parsed.email,
						name: parsed.name,
						domain: parsed.email.split("@")[1] || "",
						source_account: SOURCE_ACCOUNT_LABEL,
						first_seen_at: dateIso,
						last_seen_at: dateIso,
						msg_count: 1,
						tags: inferTags_(parsed.email, parsed.name),
						notes: "",
						last_synced_at: nowIso,
					};
				}
			}
		}
	}

	// Apply: update existing rows, append new
	var newRows = [];
	Object.keys(pending).forEach(function (key) {
		var row = pending[key];
		var existingRowNum = index[key];
		if (existingRowNum) {
			// Read existing row, merge counts + dates, leave manual notes/tags alone
			var existing = sheet.getRange(existingRowNum, 1, 1, HEADERS.length).getValues()[0];
			var existingCount = Number(existing[7]) || 0;
			var existingFirstSeen = existing[5] || row.first_seen_at;
			var existingLastSeen = existing[6] || row.last_seen_at;
			var existingTags = existing[8] || row.tags;
			var existingNotes = existing[9] || "";
			var existingName = existing[2] || row.name;

			var newLastSeen = row.last_seen_at > existingLastSeen ? row.last_seen_at : existingLastSeen;
			var newFirstSeen = row.first_seen_at < existingFirstSeen ? row.first_seen_at : existingFirstSeen;
			var newCount = existingCount + row.msg_count;
			var mergedRow = [
				key,
				row.email,
				existingName || row.name,
				row.domain,
				row.source_account,
				newFirstSeen,
				newLastSeen,
				newCount,
				existingTags,    // preserve manually edited tags
				existingNotes,   // preserve manually edited notes
				nowIso,
			];
			sheet.getRange(existingRowNum, 1, 1, HEADERS.length).setValues([mergedRow]);
		} else {
			newRows.push([
				row.key, row.email, row.name, row.domain, row.source_account,
				row.first_seen_at, row.last_seen_at, row.msg_count, row.tags, row.notes, row.last_synced_at,
			]);
		}
	});
	if (newRows.length) {
		sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, HEADERS.length).setValues(newRows);
	}

	props.setProperty("last_sync_iso", nowIso);
	Logger.log("Synced. Updated existing: " + (Object.keys(pending).length - newRows.length) + ", new: " + newRows.length);
}

// ── Web app endpoint ────────────────────────────────────────────────────────

function doGet(e) {
	var sheet = getSheet_();
	if (sheet.getLastRow() < 2) {
		return jsonResponse_({ schema_version: 1, fetched_at: new Date().toISOString(), count: 0, contacts: [] });
	}
	var values = sheet.getRange(1, 1, sheet.getLastRow(), HEADERS.length).getValues();
	var headers = values[0];
	var contacts = values.slice(1).map(function (row) {
		var obj = {};
		headers.forEach(function (h, i) { obj[h] = row[i]; });
		// Normalize msg_count to number
		obj.msg_count = Number(obj.msg_count) || 0;
		return obj;
	});

	return jsonResponse_({
		schema_version: 1,
		fetched_at: new Date().toISOString(),
		count: contacts.length,
		source_account: SOURCE_ACCOUNT_LABEL,
		contacts: contacts,
	});
}

function jsonResponse_(obj) {
	var out = ContentService.createTextOutput(JSON.stringify(obj));
	out.setMimeType(ContentService.MimeType.JSON);
	// Apps Script web apps don't allow custom headers like CORS via setHeader,
	// but JSON responses are CORS-allowed for GET when "Anyone" execution is set.
	return out;
}

// ── Manual setup helpers ────────────────────────────────────────────────────

function setupDailyTrigger() {
	// Remove existing triggers for this function first to avoid duplicates
	var triggers = ScriptApp.getProjectTriggers();
	triggers.forEach(function (t) {
		if (t.getHandlerFunction() === "extractAndSync") ScriptApp.deleteTrigger(t);
	});
	ScriptApp.newTrigger("extractAndSync").timeBased().everyDays(1).atHour(6).create();
	Logger.log("Daily trigger installed: extractAndSync at 06:00 local time.");
}

function resetSyncState() {
	// Forces the next run to do a full LOOKBACK_DAYS_FIRST_RUN sweep
	PropertiesService.getScriptProperties().deleteProperty("last_sync_iso");
	Logger.log("Sync state reset. Next extractAndSync() run will look back " + LOOKBACK_DAYS_FIRST_RUN + " days.");
}
