import { legalAdminAuditLogReader } from "./audit/reader";
import type { ListLegalDocumentAuditLogsQuery } from "./schemas";

export class LegalDocumentAuditAdminService {
  async list(query: ListLegalDocumentAuditLogsQuery) {
    return legalAdminAuditLogReader.list(query);
  }

  async export(query: Omit<ListLegalDocumentAuditLogsQuery, "page" | "pageSize">) {
    return legalAdminAuditLogReader.export(query);
  }
}

export const legalDocumentAuditAdminService = new LegalDocumentAuditAdminService();
