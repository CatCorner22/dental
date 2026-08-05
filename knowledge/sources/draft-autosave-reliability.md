# Draft autosave reliability — patterns for near-realtime recovery

Tags: autosave, reliability, drafts, indexeddb, optimistic-concurrency, clinical-notes.
Ingested: 2026-08-05.

## Why this is core

A clinician can finish a complex note and lose power or connectivity in the seconds
before Submit. Smile Notes files what the **server** holds at submit time — so
unsaved local keystrokes are a patient-outcome risk, not a convenience gap.

## Industry pattern (not a SaaS category)

There is no durable third-party “autosave product” worth depending on for PHI-adjacent
clinical drafts. Mature web apps (docs editors, EHR charting, issue trackers) converge
on the same stack:

1. **Debounced server PATCH** (~0.5–1.5 s) with **optimistic concurrency** (base version).
2. **Flush on `pagehide` / `visibilitychange` / tab close** with `keepalive` fetch.
3. **Retry on `online` + soft backoff** when the tab is back; never a tight hammer loop.
4. **Same-device durable mirror** (IndexedDB ring, localStorage fallback) for the window
   where the process dies before the server ACK.
5. **Capped server revision ring** for “restore a few minutes ago” — working-copy
   recovery, not legal history (filed submissions stay immutable).

Heavy CRDT/collab platforms (Yjs, Automerge, Liveblocks) solve multiplayer presence;
they are the wrong default for single-author clinical drafts with OCC and a clear
submit gate.

## Smile Notes mapping

| Layer | Implementation |
| --- | --- |
| Debounce + OCC + flush/retry | `src/lib/client/useAutosave.ts` (800 ms) |
| Pure state machine | `src/lib/client/autosaveMachine.ts` |
| Local mirror | `src/lib/client/draftBackup.ts` |
| Server revision ring (keep 20) | `draft_revisions` + `updateDraftChecked` |
| Restore UI | Builder “Earlier saves” + `/api/drafts/[id]/revisions` |
| Submit gate | Flush must return `clean` before file |

Standardize remains ephemeral by design; the Builder is the durable surface.

## Failure cases the stack must survive

- Laptop lid / power cut mid-sentence → pagehide flush + local mirror offer on reopen.
- Brief offline → soft retry; mirror keeps last typed state.
- Two tabs → 409 conflict dialog; human chooses; version adopted.
- Bad paste → restore from server revision ring without touching filed tickets.
