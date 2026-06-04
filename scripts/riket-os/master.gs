/**
 * Riket Personal OS — Master Drive sync.
 *
 * One Apps Script that owns the entire "Riket OS" folder in Drive. It:
 *   1. Creates the canonical folder structure (or finds the existing one)
 *   2. Bootstraps Sheets for editable data (wins, todos, outreach) from
 *      GitHub JSON
 *   3. Maintains a README Doc inside the root folder explaining what's
 *      where
 *   4. Exposes a single routing web app endpoint:
 *        GET /?type=wins      → returns wins.json shape
 *        GET /?type=todos     → returns email-todos.json shape
 *        GET /?type=outreach  → returns outreach.json shape
 *        GET /?type=index     → folder map metadata
 *      So the riketpatel.com dashboards have ONE URL to configure.
 *
 * Folder structure:
 *   /Riket OS/
 *     README.gdoc                        (folder map + how this works)
 *     01-Applications/
 *       Wins.gsheet                      (editable: hand-add wins)
 *       Email Todos.gsheet               (editable: hand-track action items)
 *       Outreach.gsheet                  (editable: cold-outreach pipeline)
 *     02-Templates/
 *       (placeholder; future email + cover letter templates)
 *     03-Capability/
 *       (placeholder; future capability statement variants)
 *     04-Interview Prep/
 *       (placeholder; future per-role prep folders)
 *     05-Contacts/
 *       Riket Contacts.gsheet             (existing, from gmail-extractor.gs)
 *     06-Signals/
 *       (placeholder; Supabase remains the source of truth for signals)
 *     07-Output/
 *       (placeholder; daily briefs, weekly summaries, export PDFs)
 *
 * Setup: scripts/riket-os/SETUP.md
 */

// ── Required Script Properties (set once via setupScriptProperties):
//   ROOT_FOLDER_ID  → optional: existing "Riket OS" folder ID. If not set,
//                     a new folder is created on first run.

var ROOT_FOLDER_NAME = "Riket OS";

// Source-of-truth GitHub URLs for the initial bootstrap. After bootstrap,
// the Drive Sheets become editable. Future syncs respect manual edits.
var SOURCE_URLS = {
	wins: "https://riketpatel.com/data/wins.json",
	todos: "https://riketpatel.com/data/email-todos.json",
	outreach: "https://riketpatel.com/data/outreach.json",
};

// Subfolder layout
var FOLDERS = [
	"01-Applications",
	"02-Templates",
	"03-Capability",
	"04-Interview Prep",
	"05-Contacts",
	"06-Signals",
	"07-Output",
];

// Sheets to create + their target subfolder
var SHEETS = {
	"Wins": { folder: "01-Applications", source: "wins" },
	"Email Todos": { folder: "01-Applications", source: "todos" },
	"Outreach": { folder: "01-Applications", source: "outreach" },
};

// ── Folder + file helpers ──────────────────────────────────────────────────

function getOrCreateRootFolder_() {
	var props = PropertiesService.getScriptProperties();
	var existingId = props.getProperty("ROOT_FOLDER_ID");
	if (existingId) {
		try { return DriveApp.getFolderById(existingId); } catch (e) {}
	}
	// Search for existing top-level folder with our name
	var iter = DriveApp.getRootFolder().getFoldersByName(ROOT_FOLDER_NAME);
	if (iter.hasNext()) {
		var found = iter.next();
		props.setProperty("ROOT_FOLDER_ID", found.getId());
		return found;
	}
	// Create new
	var folder = DriveApp.createFolder(ROOT_FOLDER_NAME);
	props.setProperty("ROOT_FOLDER_ID", folder.getId());
	return folder;
}

function ensureSubfolder_(parent, name) {
	var iter = parent.getFoldersByName(name);
	if (iter.hasNext()) return iter.next();
	return parent.createFolder(name);
}

function findFileInFolder_(folder, name, mimeType) {
	var iter = folder.getFilesByName(name);
	while (iter.hasNext()) {
		var f = iter.next();
		if (!mimeType || f.getMimeType() === mimeType) return f;
	}
	return null;
}

function readSourceJson_(key) {
	try {
		var res = UrlFetchApp.fetch(SOURCE_URLS[key], { muteHttpExceptions: true });
		if (res.getResponseCode() !== 200) return null;
		return JSON.parse(res.getContentText());
	} catch (e) {
		Logger.log("Could not fetch " + key + ": " + e.message);
		return null;
	}
}

// ── Sheet bootstrapping ─────────────────────────────────────────────────────

function bootstrapWinsSheet_(sheet, data) {
	var headers = ["id", "category", "date", "title", "detail", "tags"];
	if (sheet.getLastRow() === 0) {
		sheet.appendRow(headers);
		sheet.setFrozenRows(1);
		(data.wins || []).forEach(function (w) {
			sheet.appendRow([
				w.id || "",
				w.category || "",
				w.date || "",
				w.title || "",
				w.detail || "",
				(w.tags || []).join(","),
			]);
		});
		Logger.log("Wins sheet bootstrapped with " + (data.wins || []).length + " rows.");
	}
}

function bootstrapTodosSheet_(sheet, data) {
	var headers = ["id", "from_name", "from_email", "subject", "received_at", "action", "due_at", "priority", "status", "linked_app", "notes"];
	if (sheet.getLastRow() === 0) {
		sheet.appendRow(headers);
		sheet.setFrozenRows(1);
		(data.todos || []).forEach(function (t) {
			sheet.appendRow([
				t.id || "", t.from_name || "", t.from_email || "", t.subject || "",
				t.received_at || "", t.action || "", t.due_at || "", t.priority || "medium",
				t.status || "open", t.linked_app || "", t.notes || "",
			]);
		});
		Logger.log("Todos sheet bootstrapped with " + (data.todos || []).length + " rows.");
	}
}

function bootstrapOutreachSheet_(sheet, data) {
	var headers = ["id", "target_company", "target_person", "target_title", "target_linkedin", "channel", "purpose", "first_touch_date", "last_touch_date", "touch_count", "status", "next_action_date", "next_action", "notes"];
	if (sheet.getLastRow() === 0) {
		sheet.appendRow(headers);
		sheet.setFrozenRows(1);
		(data.outreach || []).forEach(function (o) {
			sheet.appendRow([
				o.id || "", o.target_company || "", o.target_person || "", o.target_title || "",
				o.target_linkedin || "", o.channel || "", o.purpose || "",
				o.first_touch_date || "", o.last_touch_date || "", o.touch_count || 0,
				o.status || "cold", o.next_action_date || "", o.next_action || "", o.notes || "",
			]);
		});
		Logger.log("Outreach sheet bootstrapped with " + (data.outreach || []).length + " rows.");
	}
}

function getOrCreateSheet_(parentFolder, name) {
	var file = findFileInFolder_(parentFolder, name, MimeType.GOOGLE_SHEETS);
	if (file) return SpreadsheetApp.openById(file.getId()).getSheets()[0];
	var ss = SpreadsheetApp.create(name);
	var file2 = DriveApp.getFileById(ss.getId());
	parentFolder.addFile(file2);
	DriveApp.getRootFolder().removeFile(file2); // move out of root
	var sheet = ss.getSheets()[0];
	sheet.setName(name);
	return sheet;
}

// ── README doc ──────────────────────────────────────────────────────────────

var README_BODY = (
	"# Riket OS — Drive folder map\n\n" +
	"This folder is the durable source of truth for Riket's personal operating system. Updates here propagate to the riketpatel.com dashboards via a single Apps Script web app endpoint.\n\n" +
	"## Subfolders\n\n" +
	"**01-Applications/** — Editable sheets you can hand-edit anytime:\n" +
	"  • Wins — things to be proud of (rotates on /digest/)\n" +
	"  • Email Todos — action items from email\n" +
	"  • Outreach — cold outreach pipeline (separate from job applications)\n\n" +
	"**02-Templates/** — Email templates, cover-letter templates, résumé templates (placeholder for now).\n\n" +
	"**03-Capability/** — Capability Statement variants and 30-60-90 day plan templates.\n\n" +
	"**04-Interview Prep/** — Per-role prep workspaces.\n\n" +
	"**05-Contacts/** — Auto-synced from Gmail by gmail-extractor.gs. Hand-edit tags + notes columns; the daily sync preserves them.\n\n" +
	"**06-Signals/** — Outcome-detector signals from gmail-outcome-detector.gs. Lives primarily in Supabase, but a synced view can be dropped here for reference.\n\n" +
	"**07-Output/** — Generated artifacts: daily brief PDFs, weekly summaries, export bundles.\n\n" +
	"## How edits flow back to riketpatel.com\n\n" +
	"This script's `doGet()` exposes a routing web app:\n" +
	"  • `?type=wins`      → returns wins.json shape\n" +
	"  • `?type=todos`     → returns email-todos.json shape\n" +
	"  • `?type=outreach`  → returns outreach.json shape\n" +
	"  • `?type=index`     → folder map metadata\n\n" +
	"The web app URL is configured in `riketpatel-site/config.js → RIKET_OS_WEB_APP_URL`. Dashboards (`/jobs/`, `/digest/`, `/admin/`, etc.) fetch from this URL with a fall-through to the GitHub JSON if the URL is unset or unreachable.\n\n" +
	"## Resync to GitHub\n\n" +
	"If you want changes here to also update the GitHub JSON (so the repo stays the durable backup), the future-build is a write-back: when this script runs, it can commit the latest sheet contents to riketpatel-site/data/*.json via the GitHub API. Not yet implemented — would require a GitHub PAT in Script Properties.\n\n" +
	"## Hard rules\n\n" +
	"1. Don't delete the sheets. The header row in each is what the routing endpoint depends on.\n" +
	"2. Don't share this folder publicly — the data is personal.\n" +
	"3. If you rename the root folder, update ROOT_FOLDER_NAME at the top of the script and re-run setupScriptProperties.\n"
);

function ensureReadmeDoc_(rootFolder) {
	var existing = findFileInFolder_(rootFolder, "README — Riket OS", MimeType.GOOGLE_DOCS);
	if (existing) return existing;
	var doc = DocumentApp.create("README — Riket OS");
	doc.getBody().setText(README_BODY);
	var file = DriveApp.getFileById(doc.getId());
	rootFolder.addFile(file);
	DriveApp.getRootFolder().removeFile(file);
	return file;
}

// ── Main setup ──────────────────────────────────────────────────────────────

function setupRiketOS() {
	var root = getOrCreateRootFolder_();
	Logger.log("Root folder: " + root.getName() + " (id=" + root.getId() + ")");

	// Subfolders
	var subs = {};
	FOLDERS.forEach(function (name) { subs[name] = ensureSubfolder_(root, name); });
	Logger.log("Subfolders ensured: " + FOLDERS.join(", "));

	// Sheets
	Object.keys(SHEETS).forEach(function (name) {
		var meta = SHEETS[name];
		var parent = subs[meta.folder];
		var sheet = getOrCreateSheet_(parent, name);
		var data = readSourceJson_(meta.source);
		if (data) {
			if (meta.source === "wins") bootstrapWinsSheet_(sheet, data);
			else if (meta.source === "todos") bootstrapTodosSheet_(sheet, data);
			else if (meta.source === "outreach") bootstrapOutreachSheet_(sheet, data);
		}
		PropertiesService.getScriptProperties().setProperty("SHEET_ID_" + meta.source, sheet.getParent().getId());
	});

	// README
	ensureReadmeDoc_(root);

	Logger.log("Setup complete. Open Drive → Riket OS to verify.");
}

// ── Routing web app ─────────────────────────────────────────────────────────

function doGet(e) {
	var type = (e && e.parameter && e.parameter.type) || "index";
	var props = PropertiesService.getScriptProperties();

	if (type === "index") {
		return jsonResponse_({
			schema_version: 1,
			fetched_at: new Date().toISOString(),
			folder_id: props.getProperty("ROOT_FOLDER_ID") || null,
			sheets: {
				wins: props.getProperty("SHEET_ID_wins") || null,
				todos: props.getProperty("SHEET_ID_todos") || null,
				outreach: props.getProperty("SHEET_ID_outreach") || null,
			},
		});
	}

	var sheetId = props.getProperty("SHEET_ID_" + type);
	if (!sheetId) return jsonResponse_({ error: "Unknown type: " + type + ". Valid: wins, todos, outreach, index." }, 400);

	var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
	if (sheet.getLastRow() < 2) {
		return jsonResponse_({ schema_version: 1, fetched_at: new Date().toISOString(), type: type, count: 0, items: [] });
	}
	var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
	var headers = values[0];
	var items = values.slice(1).map(function (row) {
		var obj = {};
		headers.forEach(function (h, i) { obj[String(h)] = row[i]; });
		return obj;
	});

	// Normalize the response to match the existing JSON shapes the dashboards expect
	var response;
	if (type === "wins") {
		response = { schema_version: 1, fetched_at: new Date().toISOString(), source: "drive", wins: items };
	} else if (type === "todos") {
		response = { schema_version: 1, fetched_at: new Date().toISOString(), source: "drive", todos: items };
	} else if (type === "outreach") {
		response = { schema_version: 1, fetched_at: new Date().toISOString(), source: "drive", outreach: items };
	} else {
		response = { schema_version: 1, fetched_at: new Date().toISOString(), source: "drive", type: type, items: items };
	}
	return jsonResponse_(response);
}

function jsonResponse_(obj, status) {
	var out = ContentService.createTextOutput(JSON.stringify(obj));
	out.setMimeType(ContentService.MimeType.JSON);
	return out;
}

// ── GitHub write-back (Drive → GitHub JSON) ────────────────────────────────
//
// When you hand-edit a sheet in Drive, this serializes the current Drive
// state back into the GitHub repo's data/*.json files so:
//   1. Git remains the durable backup
//   2. The dashboards work even if the Apps Script web app is unreachable
//   3. The repo log shows the diff per edit (small audit trail)
//
// Required Script Property:
//   GITHUB_TOKEN  → a fine-grained PAT for Omtatsat101/riketpatel-site with
//                    Contents: read+write on the data/ folder. Generate at
//                    https://github.com/settings/tokens?type=beta
//
// Optional Script Properties:
//   GITHUB_REPO_OWNER  → defaults to "Omtatsat101"
//   GITHUB_REPO_NAME   → defaults to "riketpatel-site"
//   GITHUB_BRANCH      → defaults to "main"

var GITHUB_DEFAULT_OWNER  = "Omtatsat101";
var GITHUB_DEFAULT_REPO   = "riketpatel-site";
var GITHUB_DEFAULT_BRANCH = "main";

function getGitHubConfig_() {
	var props = PropertiesService.getScriptProperties();
	var token = props.getProperty("GITHUB_TOKEN");
	if (!token) throw new Error("Set GITHUB_TOKEN in Script Properties (Apps Script → Project Settings → Script properties).");
	return {
		token: token,
		owner: props.getProperty("GITHUB_REPO_OWNER") || GITHUB_DEFAULT_OWNER,
		repo:  props.getProperty("GITHUB_REPO_NAME")  || GITHUB_DEFAULT_REPO,
		branch: props.getProperty("GITHUB_BRANCH")    || GITHUB_DEFAULT_BRANCH,
	};
}

// Serializers per source key. Each takes raw sheet rows and returns the
// JSON shape the dashboards expect.

function serializeWins_(rows) {
	return {
		schema_version: 1,
		last_updated: new Date().toISOString().slice(0, 10),
		_note: "Source of truth: Drive sheet 'Wins'. Synced via riket-os/master.gs syncSheetsToGitHub.",
		wins: rows.map(function (r) {
			return {
				id: String(r.id || ""),
				category: String(r.category || ""),
				date: String(r.date || ""),
				title: String(r.title || ""),
				detail: String(r.detail || ""),
				tags: String(r.tags || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean),
			};
		}).filter(function (w) { return w.title; }),
	};
}

function serializeTodos_(rows) {
	return {
		schema_version: 1,
		last_updated: new Date().toISOString().slice(0, 10),
		_note: "Source of truth: Drive sheet 'Email Todos'. Synced via riket-os/master.gs syncSheetsToGitHub.",
		todos: rows.map(function (r) {
			return {
				id: String(r.id || ""),
				from_name: r.from_name || null,
				from_email: r.from_email || null,
				subject: r.subject || null,
				received_at: r.received_at || null,
				action: String(r.action || ""),
				due_at: r.due_at || null,
				priority: String(r.priority || "medium"),
				status: String(r.status || "open"),
				linked_app: r.linked_app || null,
				notes: r.notes || null,
			};
		}).filter(function (t) { return t.action; }),
	};
}

function serializeOutreach_(rows) {
	return {
		schema_version: 1,
		last_updated: new Date().toISOString().slice(0, 10),
		_note: "Source of truth: Drive sheet 'Outreach'. Synced via riket-os/master.gs syncSheetsToGitHub.",
		outreach: rows.map(function (r) {
			return {
				id: String(r.id || ""),
				target_company: String(r.target_company || ""),
				target_person: r.target_person || null,
				target_title: r.target_title || null,
				target_linkedin: r.target_linkedin || null,
				channel: String(r.channel || ""),
				purpose: r.purpose || null,
				first_touch_date: r.first_touch_date || null,
				last_touch_date: r.last_touch_date || null,
				touch_count: Number(r.touch_count) || 0,
				status: String(r.status || "cold"),
				next_action_date: r.next_action_date || null,
				next_action: r.next_action || null,
				notes: r.notes || null,
			};
		}).filter(function (o) { return o.target_company; }),
	};
}

function readSheetRows_(sheetId) {
	var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
	if (sheet.getLastRow() < 2) return [];
	var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
	var headers = values[0];
	return values.slice(1).map(function (row) {
		var obj = {};
		headers.forEach(function (h, i) { obj[String(h)] = row[i]; });
		return obj;
	});
}

// Encode for GitHub Contents API (base64 of UTF-8 bytes).
function base64Utf8_(str) {
	return Utilities.base64Encode(str, Utilities.Charset.UTF_8);
}

function githubGetFile_(cfg, path) {
	var url = "https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + "/contents/" + path + "?ref=" + cfg.branch;
	var res = UrlFetchApp.fetch(url, {
		method: "get",
		muteHttpExceptions: true,
		headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
	});
	if (res.getResponseCode() === 404) return null;
	if (res.getResponseCode() !== 200) throw new Error("GET " + path + " → " + res.getResponseCode() + " " + res.getContentText().slice(0, 200));
	return JSON.parse(res.getContentText());
}

function githubPutFile_(cfg, path, content, sha, message) {
	var url = "https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + "/contents/" + path;
	var payload = {
		message: message,
		content: base64Utf8_(content),
		branch: cfg.branch,
	};
	if (sha) payload.sha = sha;
	var res = UrlFetchApp.fetch(url, {
		method: "put",
		contentType: "application/json",
		muteHttpExceptions: true,
		headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
		payload: JSON.stringify(payload),
	});
	var code = res.getResponseCode();
	if (code !== 200 && code !== 201) throw new Error("PUT " + path + " → " + code + " " + res.getContentText().slice(0, 300));
	return JSON.parse(res.getContentText());
}

function syncOneToGitHub_(cfg, sourceKey, path, serializer) {
	var props = PropertiesService.getScriptProperties();
	var sheetId = props.getProperty("SHEET_ID_" + sourceKey);
	if (!sheetId) { Logger.log("Skip " + sourceKey + " — no sheet id."); return { skipped: true }; }
	var rows = readSheetRows_(sheetId);
	var data = serializer(rows);
	var nextJson = JSON.stringify(data, null, 2) + "\n";

	var existing = githubGetFile_(cfg, path);
	if (existing) {
		var currentJson = Utilities.newBlob(Utilities.base64Decode(existing.content.replace(/\n/g, ""))).getDataAsString("UTF-8");
		if (currentJson === nextJson) {
			Logger.log("No diff for " + path + ", skipping commit.");
			return { unchanged: true };
		}
	}
	var msg = "riket-os: sync " + path + " from Drive (" + rows.length + " rows)";
	var result = githubPutFile_(cfg, path, nextJson, existing ? existing.sha : null, msg);
	Logger.log("Committed " + path + " → sha " + result.content.sha.slice(0, 7));
	return { committed: true, sha: result.content.sha };
}

function syncSheetsToGitHub() {
	var cfg = getGitHubConfig_();
	var results = {
		wins:     syncOneToGitHub_(cfg, "wins",     "data/wins.json",        serializeWins_),
		todos:    syncOneToGitHub_(cfg, "todos",    "data/email-todos.json", serializeTodos_),
		outreach: syncOneToGitHub_(cfg, "outreach", "data/outreach.json",    serializeOutreach_),
	};
	PropertiesService.getScriptProperties().setProperty("last_sync_to_github_iso", new Date().toISOString());
	Logger.log("Sync complete: " + JSON.stringify(results, null, 2));
	return results;
}

function setupGitHubSyncTrigger() {
	var triggers = ScriptApp.getProjectTriggers();
	triggers.forEach(function (t) {
		if (t.getHandlerFunction() === "syncSheetsToGitHub") ScriptApp.deleteTrigger(t);
	});
	ScriptApp.newTrigger("syncSheetsToGitHub").timeBased().everyHours(6).create();
	Logger.log("6-hour trigger installed for syncSheetsToGitHub.");
}

// ── Manual helpers ──────────────────────────────────────────────────────────

function setupScriptProperties() {
	// Optional: paste a GitHub PAT so syncSheetsToGitHub can commit:
	//   PropertiesService.getScriptProperties().setProperty("GITHUB_TOKEN", "ghp_...");
	Logger.log("Run setupRiketOS() first. For Drive→GitHub sync, also set GITHUB_TOKEN in Script Properties.");
}

function showFolderUrl() {
	var folder = getOrCreateRootFolder_();
	Logger.log("Open in Drive: https://drive.google.com/drive/folders/" + folder.getId());
}
