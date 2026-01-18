import type { Product, FinancingType, ProductsResponse, WorkflowStepInfo } from "./types";

export function hasProducts(data: unknown): data is ProductsResponse {
  if (!data) return false;
  const response = data as ProductsResponse;
  return Array.isArray(response.products);
}

export function hasWorkflow(product: unknown): product is Product {
  if (!product) return false;
  const p = product as Product;
  return Array.isArray(p.workflow);
}

export function extractFinancingType(product: Product): FinancingType {
  const financingStep = product.workflow.find(
    (step) => step.name.toLowerCase().includes("financing type")
  );

  const config = financingStep?.config || {};

  return {
    id: product.id,
    name: config.name || "Unknown",
    description: config.description || "",
    category: config.category || "",
    s3Key: config.s3_key || null,
    fileName: config.file_name || null,
  };
}

export function toWorkflowStepInfo(step: { id?: string; name?: string; config?: unknown }): WorkflowStepInfo {
  return {
    id: step.id || "",
    name: step.name || "Unknown Step",
    config: (step.config as Record<string, unknown>) || {},
  };
}
