/**
 * SECTION: Amendment S3 retention policy
 * WHY: During AMENDMENT_REQUESTED, issuers replace or remove files; admin compare/snapshots still reference old S3 keys. Deleting objects breaks downloads.
 * INPUT: Application status string from DB
 * OUTPUT: Whether physical S3 deletes for user-driven removals should be skipped
 * WHERE USED: Application, invoice, and contract document delete / replace paths
 */

import { ApplicationStatus } from "@cashsouk/types";

export function shouldPreserveApplicationDocumentsInS3(status: string | undefined | null): boolean {
  return status === ApplicationStatus.AMENDMENT_REQUESTED;
}
