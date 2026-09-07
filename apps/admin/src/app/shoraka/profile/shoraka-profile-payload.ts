import { omitRecordId, toOperatorShareCapitalPatch } from "@cashsouk/types";

export function shorakaShareCapitalPayload(
  shareCapital: Record<string, unknown> | null | undefined,
  kind: "SDN_BHD" | "LLP"
): Record<string, unknown> {
  return toOperatorShareCapitalPatch(shareCapital ?? {}, kind);
}

export function shorakaRecordPayload(row: Record<string, unknown>): Record<string, unknown> {
  return omitRecordId(row);
}
