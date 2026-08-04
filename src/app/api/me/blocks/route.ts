import { requireRole } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { readJsonRecord } from "@/lib/http/readJson";
import { insertUserBlock, listUserBlocks } from "@/lib/db/repo/userBlocks";
import { runPhiRule } from "@/lib/audit/rules/phi";

export const runtime = "nodejs";

// PERSONAL SAVED BLOCKS — the caller's own reusable starting text.
//
// A personal template is the one place a name could hide FOREVER and be
// pasted into every future note, so creation runs the same PHI screen a
// draft faces: an identifier in a template is refused outright, no override.

const MAX_TITLE = 80;
const MAX_BODY = 4000;

export async function GET(): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const db = await getDb();
  const rows = await listUserBlocks(db, guard.user.id);
  return Response.json({
    blocks: rows.map((b) => ({ id: b.id, title: b.title, body: b.body }))
  });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole("user");
  if (!guard.ok) return guard.response;
  const parsed = await readJsonRecord(req);
  if (parsed.kind !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const title = typeof parsed.value.title === "string" ? parsed.value.title.trim() : "";
  const body = typeof parsed.value.body === "string" ? parsed.value.body.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    return Response.json({ error: `Title is required (max ${MAX_TITLE} characters).` }, { status: 400 });
  }
  if (!body || body.length > MAX_BODY) {
    return Response.json({ error: `Body is required (max ${MAX_BODY} characters).` }, { status: 400 });
  }

  const phi = runPhiRule(`${title}\n${body}`).filter((f) => f.category === "phi");
  if (phi.length > 0) {
    return Response.json(
      {
        error:
          "This looks like it contains an identifier (name, date, contact, or record number). A saved block would repeat it into every future note — remove it and save again."
      },
      { status: 422 }
    );
  }

  const db = await getDb();
  const row = await insertUserBlock(db, guard.user.id, title, body);
  if (!row) {
    return Response.json(
      { error: "Block limit reached — delete one you no longer use first." },
      { status: 409 }
    );
  }
  return Response.json({ block: { id: row.id, title: row.title, body: row.body } });
}
