import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listUsers } from "@/lib/db/repo/users";
import { listAuditLog, type AuditFilter } from "@/lib/db/repo/auditLog";
import { checkThrottle, exportKey, recordFailure } from "@/lib/auth/throttle";
import { listAllSubmissions, listSubmissionsByUser } from "@/lib/db/repo/submissions";
import { logAction } from "@/lib/db/repo/auditLog";
import {
  canManageUsers,
  canReadAuditLog,
  canSendResetLink,
  ROLE_LABEL,
  seesAllNotes
} from "@/lib/auth/roles";
import { csvFile, csvHeaders } from "@/lib/export/csv";
import { formatTicket } from "@/lib/tickets/ticket";
import { listWishes } from "@/lib/db/repo/wishes";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  sortWishes,
  type WishCategory,
  type WishStatus
} from "@/lib/wishes/wishes";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ table: string }> };

// Export a table as CSV (opens directly in Excel).
//
// AUTHORIZATION MIRRORS THE SCREEN, NOT THE TABLE. Each export is gated by the
// same predicate that gates the page showing the same data, and the row set is
// scoped the same way — otherwise the export becomes a side door around a
// carefully scoped view. Submissions in particular are scoped by seesAllNotes,
// so a Team Member exports their own filed notes and nobody else's.
//
// NO NOTE CONTENT. The submissions export carries the STAMP — ticket,
// submitter, time, audit status, ruleset version — and not the frozen note
// body. A spreadsheet is the wrong container for a clinical record, it gets
// mailed around, and the note is already downloadable one at a time from the
// submission page with its audit report attached.
// How many exports one person may run before waiting. Generous — a manager
// legitimately pulls three or four tables in a row at month end — and still far
// below the rate that makes the audit-row feedback loop matter.
const EXPORT_FREE_ATTEMPTS = 12;

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const guard = await requireRole("readonly");
  if (!guard.ok) return guard.response;
  const { table } = await params;
  const db = await getDb();
  const now = new Date();

  // Metered BEFORE the work, because the work is the cost being metered: 5,000
  // rows read and assembled in memory, plus an audit row that lands in the very
  // table the next export reads. Unmetered, repeating this request grows the
  // thing it exports — the export amplifies itself.
  const meter = await checkThrottle(db, exportKey(guard.user.id), now);
  if (meter.locked) {
    return Response.json(
      { error: `That is a lot of exports at once. Try again in ${meter.retryAfterSec}s.` },
      { status: 429, headers: { "retry-after": String(meter.retryAfterSec) } }
    );
  }

  let file: { body: string; filename: string };
  // Counted from the rows we actually rendered, never re-derived from the CSV
  // text. Splitting the body on CRLF counts LINES, and a single cell containing
  // newlines — a wish-list detail, a pasted note, anything a user typed — is
  // quoted and spans several. So any user could inflate the number the audit
  // log records simply by pressing Enter, and the one place that says how much
  // data left the building would be a number the exporter chose.
  let rowCount = 0;

  if (table === "users") {
    if (!canManageUsers(guard.user.role)) {
      return Response.json({ error: "You cannot export the user list." }, { status: 403 });
    }
    const users = await listUsers(db);
    rowCount = users.length;
    file = csvFile(
      "users",
      ["Username", "Display name", "Role", "Status", "Email", "Management group email", "Created"],
      users.map((u) => [
        u.username,
        u.displayName,
        ROLE_LABEL[u.role],
        u.active ? "Active" : "Inactive",
        // Same masking as the screen: an address is the delivery target for an
        // account takeover, so it is only exported by someone who could already
        // mail a reset link there.
        canSendResetLink(guard.user.role, u.role) ? (u.email ?? "") : "",
        canSendResetLink(guard.user.role, u.role) ? (u.groupEmail ?? "") : "",
        u.createdAt.toISOString()
      ]),
      now
    );
  } else if (table === "audit-log") {
    if (!canReadAuditLog(guard.user.role)) {
      return Response.json({ error: "You cannot export the audit log." }, { status: 403 });
    }
    // The export must be the SAME rows as the screen. The viewer offers
    // all/auth/security, and this ignored the choice and always shipped
    // everything — so "export what I am looking at" silently handed over a
    // superset, including the routine sign-ins the security filter exists to
    // strip out. Same param name as the page, validated the same way.
    const raw = new URL(req.url).searchParams.get("filter");
    const filter: AuditFilter = raw === "auth" || raw === "security" ? raw : "all";
    const log = await listAuditLog(db, 5000, filter);
    rowCount = log.length;
    file = csvFile(
      filter === "all" ? "audit-log" : `audit-log-${filter}`,
      ["When (UTC)", "Actor", "Action", "Target", "Detail"],
      // The FROZEN actor name, matching the viewer: an export that resolved
      // live names would let a rename rewrite history on its way out the door.
      log.map((e) => [
        e.at.toISOString(),
        e.actorId ? (e.actorName ?? "unknown") : "system",
        e.action,
        e.target ?? "",
        e.detail ?? ""
      ]),
      now
    );
  } else if (table === "submissions") {
    const rows = seesAllNotes(guard.user.role)
      ? await listAllSubmissions(db, { limit: 5000, offset: 0 })
      : await listSubmissionsByUser(db, guard.user.id, { limit: 5000, offset: 0 });
    rowCount = rows.length;
    file = csvFile(
      "submissions",
      [
        "Ticket",
        "Submitted by",
        "Eastern time",
        "Audit status",
        "Ruleset version",
        "Filename"
      ],
      rows.map((s) => [
        formatTicket(s.id),
        s.submittedByName,
        s.submittedAtEt,
        s.auditStatus,
        s.ruleVersion,
        s.filename
      ]),
      now
    );
  } else if (table === "wishes") {
    // Readable by anyone signed in, exactly like the page — the list is
    // non-anonymous and open on purpose, so an export adds no disclosure.
    const rows = sortWishes(await listWishes(db, 5000));
    rowCount = rows.length;
    file = csvFile(
      "wish-list",
      ["Raised", "Raised by", "Category", "What", "Detail", "Status", "Answered by", "Reply"],
      rows.map((w) => [
        w.createdAt.toISOString(),
        w.authorName,
        CATEGORY_LABEL[w.category as WishCategory] ?? w.category,
        w.title,
        w.detail,
        STATUS_LABEL[w.status as WishStatus] ?? w.status,
        w.decidedByName ?? "",
        w.decidedNote ?? ""
      ]),
      now
    );
  } else {
    return Response.json({ error: "Unknown table." }, { status: 404 });
  }

  // Charged only once the export is known-good, so a 403 or an unknown table
  // does not spend a manager's budget on work that never happened.
  await recordFailure(db, exportKey(guard.user.id), now, EXPORT_FREE_ATTEMPTS);

  // An export is a bulk read of privileged data leaving the system. That is
  // exactly the kind of event an audit log exists to record.
  await logAction(db, {
    actorId: guard.user.id,
    actorName: `${guard.user.displayName} (${guard.user.username})`,
    action: "export.csv",
    target: table,
    detail: `${rowCount} row(s)`
  });

  return new Response(file.body, { headers: csvHeaders(file.filename) });
}
