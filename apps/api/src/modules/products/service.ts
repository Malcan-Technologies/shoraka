import { productAuditLogReader } from "./audit/reader";
import type { GetProductLogsQuery, ExportProductLogsQuery } from "./schemas";

export class ProductService {
  async getProductLogs(query: GetProductLogsQuery) {
    const { logs, total } = await productAuditLogReader.findAll(query);

    return {
      logs,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async exportProductLogs(query: Omit<ExportProductLogsQuery, "format">) {
    return productAuditLogReader.findForExport({
      search: query.search,
      eventType: query.eventType,
      eventTypes: query.eventTypes,
      dateRange: query.dateRange,
    });
  }
}

export const productService = new ProductService();
