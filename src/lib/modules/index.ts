import type { ModuleDef } from "@/lib/schema/types";
import { universalCore } from "./universal-core";
import { examination } from "./examination";
import { emergency } from "./emergency";
import { imaging } from "./imaging";
import { preventive } from "./preventive";
import { directRestorative } from "./direct-restorative";
import { fixedProsthodontic } from "./fixed-prosthodontic";
import { removableProsthodontic } from "./removable-prosthodontic";
import { endodontic } from "./endodontic";
import { periodontal } from "./periodontal";
import { implant } from "./implant";
import { operative } from "./operative";
import { extraction } from "./extraction";
import { biopsy } from "./biopsy";
import { boneGraftSinus } from "./bone-graft-sinus";
import { trauma } from "./trauma";
import { nitrous } from "./nitrous";
import { sedationAnesthesia } from "./sedation-anesthesia";
import { pediatric } from "./pediatric";
import { orthodontic } from "./orthodontic";
import { oralMedicine } from "./oral-medicine";
import { medication } from "./medication";
import { teledentistry } from "./teledentistry";
import { communicationFollowup } from "./communication-followup";
import { pathologyResult } from "./pathology-result";
import { refusalIncomplete } from "./refusal-incomplete";
import { lateEntry } from "./late-entry";
import { universalProcedure } from "./universal-procedure";

export const ALL_MODULES: ModuleDef[] = [
  universalCore,
  examination,
  emergency,
  imaging,
  preventive,
  directRestorative,
  fixedProsthodontic,
  removableProsthodontic,
  endodontic,
  periodontal,
  implant,
  operative,
  extraction,
  biopsy,
  boneGraftSinus,
  trauma,
  nitrous,
  sedationAnesthesia,
  pediatric,
  orthodontic,
  oralMedicine,
  medication,
  teledentistry,
  communicationFollowup,
  pathologyResult,
  refusalIncomplete,
  lateEntry,
  universalProcedure
].sort((a, b) => a.order - b.order);

export const MODULES_BY_ID: ReadonlyMap<string, ModuleDef> = new Map(
  ALL_MODULES.map((m) => [m.id, m])
);

export function activeModules(selectedIds: string[]): ModuleDef[] {
  return ALL_MODULES.filter((m) => m.alwaysOn || selectedIds.includes(m.id));
}
