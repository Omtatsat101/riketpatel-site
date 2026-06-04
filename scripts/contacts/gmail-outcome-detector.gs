/**
 * Riket Outcome Detector — Gmail → Supabase application status signals.
 *
 * Sister script to gmail-extractor.gs. Where the extractor builds a contacts
 * directory, this one detects status changes for active applications.
 *
 * What it does on each scheduled run (default: hourly):
 *   1. Fetches https://riketpatel.com/data/applications.json
 *   2. Builds an index of active apps (those still in pending_review,
 *      approved, submitted, followup_sent, interview status)
 *   3. Searches Gmail inbox for messages newer than LOOKBACK_DAYS where the
 *      sender domain plausibly matches any active app's company
 *   4. For each candidate message, applies regex patterns to classify:
 *      - interview  (phone screen / schedule / "next steps")
 *      - rejected   (rejection language)
 *      - offer      (offer / extend / compensation package)
 *      - next_steps (engaged but no specific outcome yet)
 *   5. Calculates confidence (high if domain match + pattern match;
 *      medium if pattern only; low if weak match)
 *   6. POSTs the signal to Supabase application_status_signals table
 *      (deduped via unique constraint on gmail_message_id)
 *
 * Signals are CANDIDATES, not commitments. Riket reviews them in the
 * /admin/ Signals panel and confirms each one — only confirmed signals
 * flow back to applications.json (via Claude in chat).
 *
 * Setup: scripts/contacts/SETUP-OUTCOMES.md
 */

// ── Required Script Properties (set via PropertiesService at install time):
//   SUPABASE_URL              → https://doxmbwizpsyqruyrmffs.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY → from API-KEYS.env
//   APPS_JSON_URL             → https://riketpatel.com/data/applications.json

var LOOKBACK_DAYS = 14;
var MAX_THREADS_PER_RUN = 200;

// ── Pattern dictionaries ────────────────────────────────────────────────────

var PATTERNS = {
	interview: [
		/\b(phone|video|recruiter|hiring manager|first round|screen|chat|call)\b.{0,40}\b(schedule|book|time|availability|calendar)\b/i,
		/\binterview\b.{0,30}\b(invite|invitation|scheduled|confirm)\b/i,
		/\bnext steps?\b/i,
		/\bwe(\s|')d? (love|like) to (chat|talk|meet|speak)\b/i,
		/\bset up a (call|time|meeting|chat)\b/i,
		/\bavailable\b.{0,30}\b(week|days?)\b/i,
		/\bcalendly\b/i,
	],
	rejected: [
		/\b(decided to (move forward|go) with (another|other) candidate)/i,
		/\b(unfortunately|regrettably|sorry to inform|sorry to share)/i,
		/\bnot move(\s|d)? forward\b/i,
		/\bbest of luck (in|on|with) your (search|job hunt)/i,
		/\b(after careful (consideration|review)|at this time)\b.{0,80}\b(other|stronger) (candidate|applicant|fit)/i,
		/\bdifferent direction\b/i,
		/\bposition has been (filled|closed)\b/i,
	],
	offer: [
		/\bpleased to (extend|offer)/i,
		/\boffer of employment\b/i,
		/\bcompensation (package|details)\b/i,
		/\bbase salary\b.{0,60}\b(annually|per year|yearly)\b/i,
		/\bsigning bonus\b/i,
	],
	next_steps: [
		/\bthank you for (applying|your application|your interest)/i,
		/\bwe(\s|')(?:ve|will) (received|got) your application/i,
		/\bunder review\b/i,
		/\bteam is reviewing\b/i,
	],
};

// Self-domains to never classify as outcome senders
var SELF_DOMAINS = [
	"gmail.com", "googlemail.com",
	"riketpatel.com", "hariomtatsatinvestments.com",
	"mettarealtypartners.com", "mettalegacypartners.com",
	"kiddiesketch.com", "kiddiego.com", "kiddiewordle.com",
	"customsketch.com", "safeink.app", "legacybridgealliancegroup.com",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getProp_(key) {
	var v = PropertiesService.getScriptProperties().getProperty(key);
	if (!v) throw new Error("Script property '" + key + "' is not set. Run setupScriptProperties() once.");
	return v;
}

function parseAddress_(raw) {
	if (!raw) return null;
	var m = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
	if (m) return { name: (m[1] || "").trim(), email: (m[2] || "").trim().toLowerCase() };
	var bare = raw.trim().toLowerCase();
	if (bare.indexOf("@") < 0) return null;
	return { name: "", email: bare };
}

function domainOf_(email) {
	if (!email) return "";
	var parts = email.split("@");
	return parts.length === 2 ? parts[1].toLowerCase() : "";
}

function isSelfDomain_(domain) {
	for (var i = 0; i < SELF_DOMAINS.length; i++) {
		if (domain === SELF_DOMAINS[i] || domain.indexOf("." + SELF_DOMAINS[i]) > 0) return true;
	}
	return false;
}

function companyDomainGuesses_(app) {
	// Try to guess a sender domain from the application row
	var guesses = [];
	if (app.contact_email) {
		var d = domainOf_(app.contact_email);
		if (d) guesses.push(d);
	}
	if (app.jd_url) {
		try {
			var m = String(app.jd_url).match(/^https?:\/\/([^/]+)/i);
			if (m) {
				var host = m[1].toLowerCase().replace(/^www\./, "");
				guesses.push(host);
				// Also the second-level (humin.applicantpro.com → applicantpro.com is generic, skip it though)
			}
		} catch (e) {}
	}
	// Best-effort company-name → likely domain
	if (app.company) {
		var simple = String(app.company).toLowerCase()
			.replace(/[^a-z0-9 ]/g, "")
			.split(/\s+/)
			.filter(function (w) { return w.length > 2; })[0];
		if (simple) guesses.push(simple + ".com");
	}
	return guesses;
}

function classify_(subject, body) {
	var text = subject + "\n" + body;
	var results = [];
	Object.keys(PATTERNS).forEach(function (kind) {
		PATTERNS[kind].forEach(function (rx) {
			if (rx.test(text)) results.push({ kind: kind, pattern: String(rx) });
		});
	});
	if (!results.length) return null;
	// Priority: rejected > offer > interview > next_steps
	var pri = { rejected: 0, offer: 1, interview: 2, next_steps: 3 };
	results.sort(function (a, b) { return pri[a.kind] - pri[b.kind]; });
	return results[0];
}

// ── Main ───────────────────────────────────────────────────────────────────

function detectOutcomes() {
	var SUPABASE_URL = getProp_("SUPABASE_URL");
	var SUPABASE_KEY = getProp_("SUPABASE_SERVICE_ROLE_KEY");
	var APPS_URL = getProp_("APPS_JSON_URL");

	// 1. Fetch applications.json
	var appsRes = UrlFetchApp.fetch(APPS_URL, { muteHttpExceptions: true });
	if (appsRes.getResponseCode() !== 200) {
		Logger.log("Could not fetch applications.json: " + appsRes.getResponseCode());
		return;
	}
	var appsData = JSON.parse(appsRes.getContentText());
	var activeStatuses = ["pending_review", "approved", "submitted", "followup_sent", "interview"];
	var active = (appsData.applications || []).filter(function (a) {
		return activeStatuses.indexOf(a.status) >= 0;
	});
	if (!active.length) {
		Logger.log("No active applications. Nothing to detect against.");
		return;
	}

	// 2. Build a domain → app[] index
	var domainIndex = {};
	active.forEach(function (a) {
		companyDomainGuesses_(a).forEach(function (d) {
			if (!domainIndex[d]) domainIndex[d] = [];
			domainIndex[d].push(a);
		});
	});
	Logger.log("Active apps: " + active.length + ", domain guesses: " + Object.keys(domainIndex).length);

	// 3. Search Gmail
	var afterEpoch = Math.floor((Date.now() - LOOKBACK_DAYS * 86400 * 1000) / 1000);
	var query = "in:inbox after:" + afterEpoch;
	var threads = GmailApp.search(query, 0, MAX_THREADS_PER_RUN);

	var signals = [];
	var seenIds = {};

	for (var t = 0; t < threads.length; t++) {
		var msgs = threads[t].getMessages();
		for (var m = 0; m < msgs.length; m++) {
			var msg = msgs[m];
			var id = msg.getId();
			if (seenIds[id]) continue;
			seenIds[id] = true;

			var fromRaw = msg.getFrom();
			var parsed = parseAddress_(fromRaw);
			if (!parsed) continue;
			var senderDomain = domainOf_(parsed.email);
			if (!senderDomain || isSelfDomain_(senderDomain)) continue;

			// Try to match against active applications
			var matchedApp = null;
			var matchedConfidence = "low";
			// Exact domain match
			if (domainIndex[senderDomain]) {
				matchedApp = domainIndex[senderDomain][0];
				matchedConfidence = "high";
			} else {
				// Substring match: any active app's company name appears in the sender domain
				for (var i = 0; i < active.length; i++) {
					var co = String(active[i].company || "").toLowerCase().split(" ")[0];
					if (co && co.length > 3 && senderDomain.indexOf(co) >= 0) {
						matchedApp = active[i];
						matchedConfidence = "medium";
						break;
					}
				}
			}
			if (!matchedApp) continue;

			// Classify
			var subject = msg.getSubject() || "";
			var body = (msg.getPlainBody() || "").slice(0, 8000); // cap to keep regex fast
			var classification = classify_(subject, body);
			if (!classification) continue;

			var confidence = (matchedConfidence === "high" && classification.kind !== "next_steps") ? "high"
				: (matchedConfidence === "high" || classification.kind === "rejected") ? "medium"
				: "low";

			signals.push({
				slug: matchedApp.materials_slug || matchedApp.id,
				company: matchedApp.company,
				role_title: matchedApp.role_title,
				detected_status: classification.kind,
				confidence: confidence,
				source: "gmail",
				evidence: "from=" + parsed.email + " | subject=" + subject.slice(0, 120) + " | pattern=" + classification.pattern,
				gmail_message_id: id,
				gmail_thread_id: threads[t].getId(),
				gmail_subject: subject.slice(0, 200),
				gmail_from: parsed.email,
				gmail_date: msg.getDate().toISOString(),
				status: "pending",
			});
		}
	}

	if (!signals.length) {
		Logger.log("No new signals.");
		PropertiesService.getScriptProperties().setProperty("last_detect_iso", new Date().toISOString());
		return;
	}

	// 4. POST to Supabase (Prefer: resolution=merge-duplicates handles dedup via unique index)
	var postRes = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/application_status_signals", {
		method: "post",
		contentType: "application/json",
		muteHttpExceptions: true,
		headers: {
			apikey: SUPABASE_KEY,
			Authorization: "Bearer " + SUPABASE_KEY,
			Prefer: "resolution=ignore-duplicates,return=minimal",
		},
		payload: JSON.stringify(signals),
	});
	var code = postRes.getResponseCode();
	if (code >= 200 && code < 300) {
		Logger.log("Posted " + signals.length + " signals to Supabase.");
	} else {
		Logger.log("Supabase POST failed: " + code + " — " + postRes.getContentText().slice(0, 400));
	}

	PropertiesService.getScriptProperties().setProperty("last_detect_iso", new Date().toISOString());
}

// ── Setup helpers ──────────────────────────────────────────────────────────

function setupScriptProperties() {
	// Run this ONCE after pasting the script. You will be prompted (via UI)
	// to enter the values. Easier: paste the values directly here and run.
	var props = PropertiesService.getScriptProperties();
	props.setProperty("SUPABASE_URL", "https://doxmbwizpsyqruyrmffs.supabase.co");
	// Paste your service role key from API-KEYS.env:
	props.setProperty("SUPABASE_SERVICE_ROLE_KEY", "PASTE_SUPABASE_SERVICE_ROLE_KEY_HERE");
	props.setProperty("APPS_JSON_URL", "https://riketpatel.com/data/applications.json");
	Logger.log("Properties set. SUPABASE_URL=" + props.getProperty("SUPABASE_URL"));
}

function setupHourlyTrigger() {
	var triggers = ScriptApp.getProjectTriggers();
	triggers.forEach(function (t) {
		if (t.getHandlerFunction() === "detectOutcomes") ScriptApp.deleteTrigger(t);
	});
	ScriptApp.newTrigger("detectOutcomes").timeBased().everyHours(1).create();
	Logger.log("Hourly trigger installed.");
}
