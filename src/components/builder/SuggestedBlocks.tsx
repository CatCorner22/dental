"use client";

import { useState } from "react";

import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
import type { VerifiedBlock } from "@/lib/phrases/blocks";
import {
  insertFieldForBlock,
  suggestedBlocksFor
} from "@/lib/phrases/suggestedBlocks";
import { BlockRow } from "@/components/standardize/BlockPicker";

/**
 * Section-scoped suggested wording — closed by default, max three, never on
 * narrative. Complements BlockChips (full catalog under the focused field)
 * without stacking MyBlocks or a permanent card above the note.
 */
export function SuggestedBlocks({
  moduleId,
  sectionId,
  selectedModuleIds,
  clinicalRole,
  outOfScope,
  sectionOpen,
  fields,
  onInsert
}: {
  moduleId: string;
  sectionId: string;
  selectedModuleIds: readonly string[];
  clinicalRole: ClinicalRole;
  outOfScope: boolean;
  /** Collapsed sections must not mount an open panel or fetch noise. */
  sectionOpen: boolean;
  fields: readonly { id: string; type: string }[];
  onInsert: (fieldId: string, text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (outOfScope || !sectionOpen) return null;

  const blocks: VerifiedBlock[] = suggestedBlocksFor({
    moduleId,
    sectionId,
    selectedModuleIds,
    clinicalRole
  }).filter((b) => insertFieldForBlock(sectionId, b.id, fields) !== null);
  if (blocks.length === 0) return null;

  return (
    <div className="mb-2 border-b border-slate-100 pb-2">
      <button
        type="button"
        className="chip"
        aria-expanded={open}
        // Keep focus in the section fields — same Safari/Firefox mousedown
        // trap as BlockChips (focusout would unmount before click).
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        Suggested wording {open ? "▾" : "▸"}
        <span className="ml-1 font-normal text-slate-500">({blocks.length})</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-[0.7rem] leading-snug text-slate-600">
            Optional starters for this section. Confirm each statement, then replace the
            placeholders — they block filing until you do. Nothing is inserted until you
            confirm.
          </p>
          {blocks.map((block) => (
            <BlockRow
              key={block.id}
              block={block}
              open={openId === block.id}
              onToggle={() => setOpenId(openId === block.id ? null : block.id)}
              onInsert={(text) => {
                const fieldId = insertFieldForBlock(sectionId, block.id, fields);
                if (!fieldId) return;
                onInsert(fieldId, text);
                setOpenId(null);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
