import type { DeedOfAssignmentMergeData, DeedOfAssignmentSignatory } from "./doa-merge.types";
import { DEED_OF_ASSIGNMENT_MERGE_KEYS, DEED_OF_ASSIGNMENT_SIGNATORY_KEYS } from "./doa-merge.types";
import { visibleMergeScalar } from "../letter-of-offer/facility-lo-guarantors";

export type DeedOfAssignmentRenderPayload = Record<string, unknown>;

const PLACEHOLDER_SIGNATORY: DeedOfAssignmentSignatory = {
  name: "",
  identity_number: "",
  designation: "",
};

function visibleSignatory(row: DeedOfAssignmentSignatory): DeedOfAssignmentSignatory {
  const visible = { ...row };
  for (const key of DEED_OF_ASSIGNMENT_SIGNATORY_KEYS) {
    visible[key] = visibleMergeScalar(key, row[key]);
  }
  return visible;
}

/** Docxtemplater payload: yellow value tags stay visible when empty. */
export function buildDeedOfAssignmentRenderPayload(
  data: DeedOfAssignmentMergeData
): DeedOfAssignmentRenderPayload {
  const scalars: Record<string, string> = {};
  for (const key of DEED_OF_ASSIGNMENT_MERGE_KEYS) {
    scalars[key] = visibleMergeScalar(key, data[key]);
  }

  const signatories =
    data.assignor_signatories.length > 0
      ? data.assignor_signatories
      : [PLACEHOLDER_SIGNATORY];

  return {
    ...data,
    ...scalars,
    assignor_signatories: signatories.map(visibleSignatory),
  };
}
