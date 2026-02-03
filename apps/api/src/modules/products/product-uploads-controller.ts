/**
 * Product uploads: presigned upload URLs only.
 * Mounted at /v1/products/:id so routes are /v1/products/:id/upload-image-url and /upload-template-url.
 * S3 key version (v1, v2, ...) is per file/slot and separate from product version.
 */
import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/http/error-handler";
import { generatePresignedUploadUrl, generateProductAssetKey, getFileExtension, parseProductAssetKey } from "../../lib/s3/client";
import type { ProductRepository } from "./repository";
import { productUploadImageUrlBodySchema, productUploadTemplateUrlBodySchema } from "./schemas";

const PRODUCT_ASSET_KEY_PREFIX = "products/";

function getStepId(step: unknown): string {
  return (step as { id?: string })?.id ?? "";
}

function getConfig(step: unknown): Record<string, unknown> {
  return ((step as { config?: unknown }).config as Record<string, unknown>) ?? {};
}

function getExistingImageKeyFromWorkflow(workflow: unknown[]): string | undefined {
  const first = workflow.find((s) => getStepId(s).startsWith("financing_type"));
  if (!first) return undefined;
  const config = getConfig(first);
  const image = config.image as { s3_key?: string } | undefined;
  const key = (image?.s3_key ?? config.s3_key) as string | undefined;
  return key?.trim() && key.startsWith(PRODUCT_ASSET_KEY_PREFIX) ? key : undefined;
}

function getExistingTemplateKeyFromWorkflow(
  workflow: unknown[],
  categoryKey: string,
  templateIndex: number
): string | undefined {
  const supporting = workflow.find((s) => getStepId(s).startsWith("supporting_documents"));
  if (!supporting) return undefined;
  const config = getConfig(supporting);
  const list = (config[categoryKey] as Array<{ template?: { s3_key?: string } }>) ?? [];
  const key = list[templateIndex]?.template?.s3_key?.trim();
  return key && key.startsWith(PRODUCT_ASSET_KEY_PREFIX) ? key : undefined;
}

export function createProductUploadsRouter(productRepository: ProductRepository): Router {
  const router = Router({ mergeParams: true });

  router.post("/upload-image-url", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.params.id as string;
      const validated = productUploadImageUrlBodySchema.parse(req.body);
      const product = await productRepository.findById(productId);
      if (!product) throw new AppError(404, "NOT_FOUND", "Product not found");

      const workflow = (product.workflow as unknown[]) ?? [];
      const existingKey = getExistingImageKeyFromWorkflow(workflow);
      const ext = getFileExtension(validated.fileName) || "png";
      const keyVersion = existingKey
        ? (() => {
            const parsed = parseProductAssetKey(existingKey);
            return parsed ? parsed.version + 1 : 1;
          })()
        : 1;
      const key = generateProductAssetKey({
        productId,
        version: keyVersion,
        extension: ext,
        existingKey: existingKey || undefined,
      });
      const { uploadUrl, key: s3Key, expiresIn } = await generatePresignedUploadUrl({
        key,
        contentType: validated.contentType,
      });
      res.json({
        success: true,
        data: { uploadUrl, s3Key, expiresIn },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error
      );
    }
  });

  router.post("/upload-template-url", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.params.id as string;
      const validated = productUploadTemplateUrlBodySchema.parse(req.body);
      const product = await productRepository.findById(productId);
      if (!product) throw new AppError(404, "NOT_FOUND", "Product not found");

      const workflow = (product.workflow as unknown[]) ?? [];
      const existingKey = getExistingTemplateKeyFromWorkflow(
        workflow,
        validated.categoryKey,
        validated.templateIndex
      );
      const ext = getFileExtension(validated.fileName) || "pdf";
      const keyVersion = existingKey
        ? (() => {
            const parsed = parseProductAssetKey(existingKey);
            return parsed ? parsed.version + 1 : 1;
          })()
        : 1;
      const key = generateProductAssetKey({
        productId,
        version: keyVersion,
        extension: ext,
        existingKey: existingKey || undefined,
      });
      const { uploadUrl, key: s3Key, expiresIn } = await generatePresignedUploadUrl({
        key,
        contentType: validated.contentType,
      });
      res.json({
        success: true,
        data: { uploadUrl, s3Key, expiresIn },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error
      );
    }
  });

  return router;
}
