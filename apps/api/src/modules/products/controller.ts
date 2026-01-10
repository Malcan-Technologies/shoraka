import { Request, Response, NextFunction, Router } from "express";
import { ProductService } from "./service";
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  listProductsQuerySchema,
} from "./schemas";
import { requireAuth, requireRole } from "../../lib/auth/middleware";
import { UserRole } from "@prisma/client";

const productService = new ProductService();

/**
 * Create a new product
 * POST /v1/products
 */
async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = createProductSchema.parse(req.body);
    const product = await productService.createProduct(req, input);

    res.status(201).json({
      success: true,
      data: {
        id: product.id,
        workflow: product.workflow,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get product by ID
 * GET /v1/products/:id
 */
async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = productIdParamSchema.parse(req.params);
    const product = await productService.getProduct(req, id);

    res.json({
      success: true,
      data: {
        id: product.id,
        workflow: product.workflow,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List products with pagination
 * GET /v1/products
 */
async function listProducts(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = listProductsQuerySchema.parse(req.query);
    const result = await productService.listProducts(req, query);

    res.json({
      success: true,
      data: {
        products: result.products.map((p) => ({
          id: p.id,
          workflow: p.workflow,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })),
        pagination: result.pagination,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update product
 * PATCH /v1/products/:id
 */
async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = productIdParamSchema.parse(req.params);
    const input = updateProductSchema.parse(req.body);
    const product = await productService.updateProduct(req, id, input);

    res.json({
      success: true,
      data: {
        id: product.id,
        workflow: product.workflow,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete product
 * DELETE /v1/products/:id
 */
async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = productIdParamSchema.parse(req.params);
    await productService.deleteProduct(req, id);

    res.json({
      success: true,
      data: { message: "Product deleted successfully" },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create router for product routes
 */
export function createProductRouter(): Router {
  const router = Router();

  // Public routes (if any)
  // router.get("/", listProducts);
  // router.get("/:id", getProduct);

  // Authenticated routes
  router.get("/", requireAuth, listProducts);
  router.get("/:id", requireAuth, getProduct);
  router.post("/", requireAuth, requireRole(UserRole.ADMIN), createProduct);
  router.patch("/:id", requireAuth, requireRole(UserRole.ADMIN), updateProduct);
  router.delete("/:id", requireAuth, requireRole(UserRole.ADMIN), deleteProduct);

  return router;
}