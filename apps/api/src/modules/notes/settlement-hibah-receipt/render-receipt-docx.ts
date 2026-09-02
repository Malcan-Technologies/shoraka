import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import {
  buildSettlementHibahReceiptDocxMergeData,
  type SettlementHibahReceiptDocxMergeData,
} from "./receipt-merge-data";
import type { SettlementHibahReceiptSnapshot } from "./types";
import { applyCompanyStampToDocx } from "../document-authorisation/docx-stamp-image";

const TEMPLATE_FILENAME = "settlement-hibah-receipt-v1.docx";

export function resolveSettlementHibahReceiptTemplatePath(): string {
  const candidates = [
    path.join(__dirname, "templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "src/modules/notes/settlement-hibah-receipt/templates", TEMPLATE_FILENAME),
    path.join(
      process.cwd(),
      "apps/api/src/modules/notes/settlement-hibah-receipt/templates",
      TEMPLATE_FILENAME
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Settlement & Hibah Receipt template not found (${TEMPLATE_FILENAME}). Looked in: ${candidates.join(", ")}`
  );
}

export function readSettlementHibahReceiptTemplateBytes(): Buffer {
  return fs.readFileSync(resolveSettlementHibahReceiptTemplatePath());
}

function renderMergeData(data: SettlementHibahReceiptDocxMergeData): Buffer {
  const zip = new PizZip(readSettlementHibahReceiptTemplateBytes());
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "—",
  });
  doc.render(data as unknown as Record<string, unknown>);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

export function renderSettlementHibahReceiptDocx(
  snapshot: SettlementHibahReceiptSnapshot,
  stampImage?: { bytes: Buffer; contentType?: string | null } | null
): Buffer {
  const rendered = renderMergeData(buildSettlementHibahReceiptDocxMergeData(snapshot));
  return applyCompanyStampToDocx(rendered, stampImage ?? null);
}
