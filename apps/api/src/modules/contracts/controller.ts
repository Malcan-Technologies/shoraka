import { Request, Response, NextFunction, Router } from "express";
import { contractService } from "./service";
import {
  createContractSchema,
  updateContractSchema,
  contractIdParamSchema,
  requestContractUploadUrlSchema,
} from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { z } from "zod";

function getUserId(req: Request): string {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return req.user.user_id;
}

async function createContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId } = createContractSchema.parse(req.body);
    const userId = getUserId(req);
    const contract = await contractService.createContract(applicationId, userId);

    res.status(201).json({
      success: true,
      data: contract,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

async function getContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = contractIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    const contract = await contractService.getContract(id, userId);

    res.json({
      success: true,
      data: contract,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

async function updateContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = contractIdParamSchema.parse(req.params);
    const input = updateContractSchema.parse(req.body);
    const userId = getUserId(req);
    const contract = await contractService.updateContract(id, input, userId);

    res.json({
      success: true,
      data: contract,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

async function getApprovedContracts(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const organizationId = req.query.organizationId as string;

    if (!organizationId) {
      throw new AppError(400, "BAD_REQUEST", "organizationId query parameter is required");
    }

    const contracts = await contractService.getApprovedContracts(userId, organizationId);

    res.json({
      success: true,
      data: contracts,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

async function requestUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = contractIdParamSchema.parse(req.params);
    const input = requestContractUploadUrlSchema.parse(req.body);
    const userId = getUserId(req);

    const result = await contractService.requestUploadUrl({
      contractId: id,
      fileName: input.fileName,
      contentType: input.contentType,
      fileSize: input.fileSize,
      type: input.type,
      existingS3Key: input.existingS3Key,
      userId,
    });

    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

const deleteDocumentSchema = z.object({
  s3Key: z.string(),
});

async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = contractIdParamSchema.parse(req.params);
    const input = deleteDocumentSchema.parse(req.body);
    const userId = getUserId(req);

    await contractService.deleteDocument(id, input.s3Key, userId);

    res.json({
      success: true,
      data: { message: "Document deleted successfully" },
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (error) {
    next(error);
  }
}

async function unlinkContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = contractIdParamSchema.parse(req.params);
    const userId = getUserId(req);
    await contractService.unlinkContract(id, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export function createContractRouter(): Router {
  const router = Router();

  router.post("/", requireAuth, createContract);
  router.get("/approved", requireAuth, getApprovedContracts);
  router.get("/:id", requireAuth, getContract);
  router.patch("/:id", requireAuth, updateContract);
  router.post("/:id/unlink", requireAuth, unlinkContract);
  router.post("/:id/upload-url", requireAuth, requestUploadUrl);
  router.delete("/:id/document", requireAuth, deleteDocument);

  return router;
}
