import { REPORT_BREAKDOWNS, REPORT_KEYS } from "@cashsouk/types";
import { z } from "zod";

export const reportKeyParamSchema = z.object({
  key: z.enum(REPORT_KEYS),
});

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportQuerySchema = z
  .object({
    asOf: ymd.optional(),
    from: ymd.optional(),
    to: ymd.optional(),
    groupBy: z.enum(REPORT_BREAKDOWNS).optional(),
    format: z.enum(["json", "csv", "xlsx"]).optional().default("json"),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.from) !== Boolean(value.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From and to must be provided together.",
        path: ["from"],
      });
    }
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From must be on or before to.",
        path: ["from"],
      });
    }
  });
