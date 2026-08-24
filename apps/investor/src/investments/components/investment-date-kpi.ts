import { isCompactNoteTimingValueShort } from "@cashsouk/types";
import { cn } from "@/lib/utils";
import type { InvestmentMaturityTone } from "../investment-position-model";

/** Marketplace and portfolio date KPIs: large digits, smaller dates or long tokens. */
export function investmentDateKpiValueClassName(
  value: string,
  tone?: InvestmentMaturityTone
): string {
  return cn(
    tone === "overdue" ? "text-status-rejected-text" : "text-foreground",
    !isCompactNoteTimingValueShort(value) &&
      "text-xl leading-none tracking-tight md:text-2xl"
  );
}
