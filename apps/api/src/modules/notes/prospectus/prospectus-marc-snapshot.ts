/**
 * SECTION: Resolve MARC for Prospectus pages
 * WHY: Unpublished preview uses live org assessment; published/approved freeze must not follow later MARC edits
 */

import type { MarcAssessmentSnapshot } from "@cashsouk/types";
import { NoteStatus } from "@prisma/client";
import { getCurrentMarcAssessment } from "../../paymaster/service";
import { isProspectusNotePublished } from "./prospectus-page-one-prisma";

export function frozenMarcFromProspectusSnapshot(
  prospectusSnapshot: unknown
): MarcAssessmentSnapshot | null {
  if (!prospectusSnapshot || typeof prospectusSnapshot !== "object" || Array.isArray(prospectusSnapshot)) {
    return null;
  }
  const identity = (prospectusSnapshot as { note_identity?: unknown }).note_identity;
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
    return null;
  }
  const marc = (identity as { marc_snapshot?: unknown }).marc_snapshot;
  if (!marc || typeof marc !== "object" || Array.isArray(marc)) {
    return null;
  }
  const record = marc as Record<string, unknown>;
  return {
    creditGrade: typeof record.creditGrade === "string" ? record.creditGrade : null,
    creditScore:
      typeof record.creditScore === "number" || typeof record.creditScore === "string"
        ? record.creditScore
        : null,
    probabilityOfDefault:
      typeof record.probabilityOfDefault === "number" ||
      typeof record.probabilityOfDefault === "string"
        ? record.probabilityOfDefault
        : null,
    reportDate: typeof record.reportDate === "string" ? record.reportDate : null,
    reportFileName: typeof record.reportFileName === "string" ? record.reportFileName : null,
    assessedAt: typeof record.assessedAt === "string" ? record.assessedAt : null,
  };
}

export async function resolveMarcSnapshotForProspectus(note: {
  status: NoteStatus;
  published_at: Date | null;
  prospectus_snapshot: unknown;
  issuer_organization_id: string;
}): Promise<MarcAssessmentSnapshot | null> {
  if (isProspectusNotePublished(note)) {
    return frozenMarcFromProspectusSnapshot(note.prospectus_snapshot);
  }
  const frozenWhileApproved = frozenMarcFromProspectusSnapshot(note.prospectus_snapshot);
  if (frozenWhileApproved) {
    return frozenWhileApproved;
  }
  return getCurrentMarcAssessment(note.issuer_organization_id);
}
