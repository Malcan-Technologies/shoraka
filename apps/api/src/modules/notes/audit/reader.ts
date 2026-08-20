import type { NoteAuditLog } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { isNoteAuditEventType } from "./events";
import type { NoteAuditLogDto } from "@cashsouk/types";

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function toNoteAuditLogDto(row: NoteAuditLog): NoteAuditLogDto {
  const metadata = metadataRecord(row.metadata);
  const eventType = isNoteAuditEventType(row.event_type) ? row.event_type : row.event_type;
  return {
    id: row.id,
    noteId: row.note_id,
    eventType,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    actor: {
      type: row.actor_type,
      userId: row.actor_user_id,
      displayName: stringOrNull(metadata.actorName),
      email: stringOrNull(metadata.actorEmail),
    },
    organizationId: row.organization_id,
    organizationKind: row.organization_kind,
    target: { type: row.target_type, id: row.target_id },
    source: row.source,
    portal: row.portal,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    correlationId: row.correlation_id,
    metadata,
  };
}

export class NoteAuditLogReader {
  /** Full NoteAuditLog history for the note, newest first. Used by Note Activity. */
  async listByNoteId(noteId: string): Promise<NoteAuditLogDto[]> {
    const rows = await prisma.noteAuditLog.findMany({
      where: { note_id: noteId },
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
    });
    return rows.map(toNoteAuditLogDto);
  }

  async listByNoteIdPage(
    noteId: string,
    query: { page: number; pageSize: number }
  ): Promise<{
    logs: NoteAuditLogDto[];
    pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
  }> {
    const where = { note_id: noteId };
    const skip = (query.page - 1) * query.pageSize;
    const [rows, totalCount] = await Promise.all([
      prisma.noteAuditLog.findMany({
        where,
        orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
        skip,
        take: query.pageSize,
      }),
      prisma.noteAuditLog.count({ where }),
    ]);
    return {
      logs: rows.map(toNoteAuditLogDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
      },
    };
  }

  /** Platform trustee-signature history. Queried by event type, not note_id. */
  async listTrusteeSignatureUpdates(): Promise<NoteAuditLogDto[]> {
    const rows = await prisma.noteAuditLog.findMany({
      where: {
        event_type: "TRUSTEE_SIGNATURE_UPDATED",
        target_type: "PLATFORM_SETTING",
      },
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
    });
    return rows.map(toNoteAuditLogDto);
  }
}

export const noteAuditLogReader = new NoteAuditLogReader();
