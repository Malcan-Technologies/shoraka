/**
 * Type definitions for the application workflow
 * These types make the code easier to understand and prevent errors
 */

/**
 * Configuration for a workflow step
 * Each step can have different config data depending on its type
 */
export interface WorkflowStepConfig {
  // Financing Type step config
  name?: string;
  description?: string;
  category?: string;
  s3_key?: string;
  file_name?: string;
  
  // Other step configs can be added here as needed
  [key: string]: unknown;
}

/**
 * A single step in the product workflow
 */
export interface WorkflowStep {
  id: string;
  name: string;
  config?: WorkflowStepConfig;
}

/**
 * A product (financing type) from the API
 */
export interface Product {
  id: string;
  workflow: WorkflowStep[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Information about a financing type (extracted from product)
 */
export interface FinancingType {
  id: string;
  name: string;
  description: string;
  category: string;
  s3Key: string | null;
  fileName: string | null;
}

/**
 * Response from the products API
 */
export interface ProductsResponse {
  products: Product[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
  };
}

/**
 * Information about a workflow step (simplified for display)
 */
export interface WorkflowStepInfo {
  id: string;
  name: string;
  config: WorkflowStepConfig;
}
