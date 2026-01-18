export interface WorkflowStepConfig {
  name?: string;
  description?: string;
  category?: string;
  s3_key?: string;
  file_name?: string;
  [key: string]: unknown;
}

export interface WorkflowStep {
  id: string;
  name: string;
  config?: WorkflowStepConfig;
}

export interface Product {
  id: string;
  workflow: WorkflowStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FinancingType {
  id: string;
  name: string;
  description: string;
  category: string;
  s3Key: string | null;
  fileName: string | null;
}

export interface ProductsResponse {
  products: Product[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
  };
}

export interface WorkflowStepInfo {
  id: string;
  name: string;
  config: WorkflowStepConfig;
}
