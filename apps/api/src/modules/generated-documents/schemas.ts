import { z } from "zod";
import { GENERATED_DOCUMENT_CONTEXTS } from "@cashsouk/types";

export const generatedDocumentTypeParamSchema = z.object({
  type: z.string().min(1),
});

export const generatedDocumentFormatQuerySchema = z.object({
  format: z.enum(["pdf", "docx"]).optional().default("pdf"),
});

export const generatedDocumentTypesQuerySchema = z.object({
  context: z.enum(GENERATED_DOCUMENT_CONTEXTS).optional(),
});
