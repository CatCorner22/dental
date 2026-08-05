// THE SEAL: how ByteAudit stays something the application cannot quietly change.
//
// ByteAudit is the last thing between a draft and a filed legal record. That
// makes it the most valuable thing in the repository to tamper with, and the
// tampering that matters is not malicious — it is ordinary. A rule gets relaxed
// to make a test pass. A check gets skipped because it was noisy. Somebody
// "fixes" the backstop instead of the defect it found. Every one of those is a
// normal Tuesday, and every one of them silently removes the only independent
// opinion in the system.
//
// So the directory is SEALED. Its contents hash to a value recorded in
// manifest.ts, and three independent mechanisms keep it honest:
//
//   1. A test (byteaudit.test.ts) reads every file in this directory from disk,
//      hashes it, and fails if the result does not match the recorded seal.
//      Changing a byte here without deliberately re-sealing turns CI red.
//   2. A second test asserts this directory imports NOTHING from the rest of the
//      application except pure type declarations. Independence is not a comment;
//      it is checked. A verifier that shares code with the thing it verifies is
//      not a second opinion, it is an echo.
//   3. Re-sealing requires running a script by hand. Application code has no way
//      to do it: nothing here writes manifest.ts, and nothing outside this
//      directory is permitted to import from it except the publish gate.
//
// THE WINDOW. Updates arrive as batches through one documented door: change the
// files, run `node scripts/byteaudit-seal.mjs`, and commit the new manifest.ts in
// the same diff. That diff is one line of hash per changed file, which is
// exactly what makes it reviewable — a reviewer cannot miss that the backstop
// moved, because moving it is never a side effect of anything else.
//
// FAIL CLOSED. If the seal cannot be verified, ByteAudit does not shrug and
// allow the publish. It refuses. A backstop that degrades to "allow" under
// uncertainty is not a backstop; the whole point is to be the component that
// says no when nobody else can tell.

/**
 * What this build of ByteAudit is.
 *
 * Stamped into every verdict so a filed record carries the version of the
 * backstop that cleared it. A verdict whose sealVersion is unknown to the
 * reader is a verdict they cannot reproduce, which is the same as no verdict.
 */
export const BYTEAUDIT_VERSION = "1.0.0";

/**
 * Why a seal check can fail, kept as data rather than prose so the publish gate
 * can branch on it and the operator sees a cause rather than a boolean.
 */
export type SealFailure =
  /** A file in the sealed set does not hash to its recorded value. */
  | { kind: "modified"; file: string; expected: string; actual: string }
  /** A file is in the manifest but no longer on disk. */
  | { kind: "missing"; file: string }
  /** A file is on disk inside the sealed directory but not in the manifest. */
  | { kind: "unsealed"; file: string }
  /** The manifest itself could not be read or parsed. */
  | { kind: "unreadable"; detail: string };

export interface SealManifest {
  /** Bumped by hand when the sealed contents change. */
  version: string;
  /** Relative path within this directory -> SHA-256 of its bytes. */
  files: Record<string, string>;
}

export interface SealVerdict {
  intact: boolean;
  failures: SealFailure[];
  /** How many files the manifest covers, so an empty manifest cannot pass. */
  sealedFiles: number;
}

/**
 * The files that MUST be sealed, by name.
 *
 * A count would have been the obvious guard and it is the weaker one: "at least
 * four files" is satisfied by four trivial files while the verifier itself goes
 * missing. Naming them means the only way to drop ByteAudit's actual logic out
 * of the seal is to delete the entry, which is a line in a diff that says
 * exactly what it is.
 *
 * Without this, emptying the manifest to `{}` produces a seal that verifies
 * perfectly and protects nothing.
 */
export const REQUIRED_SEALED_FILES: readonly string[] = ["contract.ts", "seal.ts", "verify.ts"];

/**
 * Judge a set of computed hashes against the manifest.
 *
 * Deliberately PURE and filesystem-free: the caller supplies what it read, so
 * this function is testable, runs anywhere, and — the point — cannot itself be
 * the thing that decides which files to look at. Choosing the inputs is the
 * easiest place to hide a bypass, so that choice lives in the caller and is
 * asserted separately.
 */
export function judgeSeal(
  manifest: SealManifest,
  actual: Record<string, string>
): SealVerdict {
  const failures: SealFailure[] = [];

  for (const [file, expected] of Object.entries(manifest.files)) {
    const got = actual[file];
    if (got === undefined) {
      failures.push({ kind: "missing", file });
    } else if (got !== expected) {
      failures.push({ kind: "modified", file, expected, actual: got });
    }
  }

  // A NEW file inside the sealed directory is a failure too, and this is the
  // half that is easy to forget. Checking only that known files are unchanged
  // lets someone add byteaudit/override.ts, import it from the verifier, and
  // leave every recorded hash perfectly intact.
  for (const file of Object.keys(actual)) {
    if (!(file in manifest.files)) failures.push({ kind: "unsealed", file });
  }

  // The load-bearing files must be present BY NAME, not merely counted.
  for (const required of REQUIRED_SEALED_FILES) {
    if (!(required in manifest.files)) {
      failures.push({ kind: "missing", file: `${required} (absent from the manifest itself)` });
    }
  }

  const sealedFiles = Object.keys(manifest.files).length;
  return { intact: failures.length === 0, failures, sealedFiles };
}

/**
 * The sentence an operator sees when the seal is broken.
 *
 * Written for somebody who did not expect this and needs to know, in order:
 * that publishing is stopped, what moved, and what the two legitimate next
 * steps are. Never "contact support" — this is a repository, and the answer is
 * either "revert it" or "re-seal it on purpose".
 */
export function explainSeal(verdict: SealVerdict): string {
  if (verdict.intact) {
    return `ByteAudit seal intact (${verdict.sealedFiles} files, v${BYTEAUDIT_VERSION}).`;
  }
  const lines = verdict.failures.map((f) => {
    switch (f.kind) {
      case "modified":
        return `  changed:  ${f.file}`;
      case "missing":
        return `  deleted:  ${f.file}`;
      case "unsealed":
        return `  added:    ${f.file} (present on disk, absent from the seal)`;
      case "unreadable":
        return `  manifest unreadable: ${f.detail}`;
    }
  });
  return [
    "ByteAudit is not the code it was sealed as, so publishing is stopped.",
    ...lines,
    "",
    "This is either a change nobody meant to make — revert it — or a deliberate",
    "update, in which case run `node scripts/byteaudit-seal.mjs` and commit the",
    "new manifest.ts in the same change, so the diff shows the backstop moving."
  ].join("\n");
}
