/**
 * Repairs missing APPLICATION_CREATED / APPLICATION_SUBMITTED timeline projections
 * from durable application state. Rebuilt rows use source INTERNAL and a null actor
 * so reconstruction never invents a submitter.
 */
import { prisma } from "../prisma";
import { logger } from "../logger";
import { AUDIT_PORTAL, AUDIT_SOURCE, internalAuditContext } from "../audit";
import { logApplicationActivity } from "../../modules/applications/logs/service";
import { ActivityPortal, ApplicationLogEventType } from "../../modules/applications/logs/types";

const REPAIR_CORRELATION = "cron:application-timeline-repair";

export type ApplicationTimelineRepairResult = {
  created: number;
  submitted: number;
};

export async function runApplicationTimelineRepairJob(): Promise<ApplicationTimelineRepairResult> {
  const context = internalAuditContext({
    portal: AUDIT_PORTAL.ISSUER,
    correlationId: REPAIR_CORRELATION,
  });

  const missingCreated = await prisma.$queryRaw<{ id: string; created_at: Date }[]>`
    SELECT a.id, a.created_at
    FROM applications a
    WHERE a.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM application_logs l
        WHERE l.application_id = a.id
          AND l.event_type = 'APPLICATION_CREATED'
      )
    ORDER BY a.created_at ASC
    LIMIT 200
  `;

  let created = 0;
  for (const row of missingCreated) {
    try {
      await logApplicationActivity(
        {
          userId: null,
          applicationId: row.id,
          eventType: ApplicationLogEventType.APPLICATION_CREATED,
          portal: ActivityPortal.ISSUER,
          createdAt: row.created_at,
          context,
          source: AUDIT_SOURCE.INTERNAL,
        },
        prisma
      );
      created += 1;
    } catch (error) {
      logger.error(
        { applicationId: row.id, error, correlationId: REPAIR_CORRELATION },
        "Failed to repair APPLICATION_CREATED timeline row"
      );
    }
  }

  const missingSubmitted = await prisma.$queryRaw<{ id: string; submitted_at: Date }[]>`
    SELECT a.id, a.submitted_at
    FROM applications a
    WHERE a.submitted_at IS NOT NULL
      AND a.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM application_logs l
        WHERE l.application_id = a.id
          AND l.event_type = 'APPLICATION_SUBMITTED'
      )
    ORDER BY a.submitted_at ASC
    LIMIT 200
  `;

  let submitted = 0;
  for (const row of missingSubmitted) {
    try {
      await logApplicationActivity(
        {
          userId: null,
          applicationId: row.id,
          eventType: ApplicationLogEventType.APPLICATION_SUBMITTED,
          portal: ActivityPortal.ISSUER,
          createdAt: row.submitted_at,
          context,
          source: AUDIT_SOURCE.INTERNAL,
        },
        prisma
      );
      submitted += 1;
    } catch (error) {
      logger.error(
        { applicationId: row.id, error, correlationId: REPAIR_CORRELATION },
        "Failed to repair APPLICATION_SUBMITTED timeline row"
      );
    }
  }

  logger.info(
    { created, submitted, correlationId: REPAIR_CORRELATION },
    "Application timeline repair job completed"
  );
  return { created, submitted };
}
