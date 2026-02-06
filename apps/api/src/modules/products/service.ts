import { productLogRepository } from "./repository";
import type { GetProductLogsQuery, ExportProductLogsQuery } from "./schemas";

/**
 * Product module service: product logs only (list + export).
 * Product CRUD and image routes have been removed.
 */
export class ProductService {
  async getProductLogs(query: GetProductLogsQuery) {
    const { logs, total } = await productLogRepository.findAll(query);

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
    return productLogRepository.findForExport({
      search: query.search,
      eventType: query.eventType,
      eventTypes: query.eventTypes,
      dateRange: query.dateRange,
    });
  }
}

export const productService = new ProductService();
