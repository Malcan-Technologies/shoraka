/**
 * Helper functions to make the code simpler and easier to understand
 */

import type { Product, FinancingType, ProductsResponse, WorkflowStepInfo } from "./types";

/**
 * Check if a response has products
 */
export function hasProducts(data: unknown): data is ProductsResponse {
  if (!data) return false;
  const response = data as ProductsResponse;
  return Array.isArray(response.products);
}

/**
 * Check if a product has a valid workflow
 */
export function hasWorkflow(product: unknown): product is Product {
  if (!product) return false;
  const p = product as Product;
  return Array.isArray(p.workflow);
}

/**
 * Extract financing type information from a product
 * This finds the "Financing Type" step and gets its config
 */
export function extractFinancingType(product: Product): FinancingType {
  // Find the step that contains "financing type" in its name
  const financingStep = product.workflow.find(
    (step) => step.name.toLowerCase().includes("financing type")
  );

  // Get the config, or use empty object if not found
  const config = financingStep?.config || {};

  // Return the financing type data
  return {
    id: product.id,
    name: config.name || "Unknown",
    description: config.description || "",
    category: config.category || "",
    s3Key: config.s3_key || null,
    fileName: config.file_name || null,
  };
}

/**
 * Convert a workflow step to step info
 */
export function toWorkflowStepInfo(step: { id?: string; name?: string; config?: unknown }): WorkflowStepInfo {
  return {
    id: step.id || "",
    name: step.name || "Unknown Step",
    config: (step.config as Record<string, unknown>) || {},
  };
}
