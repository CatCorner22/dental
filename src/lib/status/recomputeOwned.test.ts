import { describe, expect, it, vi, beforeEach } from "vitest";

const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const selectFrom = vi.fn();
const selectWhere = vi.fn();

const statusForNoteMock = vi.fn(
  (_opts?: unknown): { status: "handoff"; counts: Record<string, number> } => ({
    status: "handoff",
    counts: { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 }
  })
);

vi.mock("@/lib/status/statusForNote", () => ({
  statusForNote: (opts: unknown) => statusForNoteMock(opts)
}));

vi.mock("@/lib/db/schema", () => ({
  drafts: {
    ownerId: "ownerId",
    status: "status",
    id: "id"
  }
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (a: unknown, b: unknown) => [a, b],
  ne: (a: unknown, b: unknown) => [a, b]
}));

import { recomputeOpenDraftStatusesForOwner } from "./recomputeOwned";

describe("recomputeOpenDraftStatusesForOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statusForNoteMock.mockReturnValue({
      status: "handoff",
      counts: { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 }
    });
    selectWhere.mockResolvedValue([
      {
        id: "d1",
        noteState: { selectedModuleIds: [], values: {} },
        status: "ready",
        lastSendFailed: false
      },
      {
        id: "d2",
        noteState: { selectedModuleIds: [], values: {} },
        status: "handoff",
        lastSendFailed: false
      }
    ]);
    selectFrom.mockReturnValue({ where: selectWhere });
  });

  it("restamps chips that disagree with the owner's filing authority", async () => {
    const db = {
      select: () => ({ from: selectFrom }),
      update: () => ({ set: updateSet })
    };

    const changed = await recomputeOpenDraftStatusesForOwner(
      db as never,
      "owner-1",
      "hygienist",
      new Date("2026-08-08T00:00:00Z")
    );

    expect(statusForNoteMock).toHaveBeenCalledTimes(2);
    // d1 ready→handoff updates; d2 already handoff skips
    expect(changed).toBe(1);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "handoff" })
    );
  });
});
