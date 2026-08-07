import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { ContractLooMergeData } from "./contract-loo-merge.types";

const TEMPLATE_FILENAME = "arf-contract-facility-loo.docx";

export function resolveContractLooTemplatePath(): string {
  const candidates = [
    path.join(__dirname, "..", "templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "src/modules/applications/templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "apps/api/src/modules/applications/templates", TEMPLATE_FILENAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Contract LOO template not found (${TEMPLATE_FILENAME}). Looked in: ${candidates.join(", ")}`
  );
}

export function renderContractLooDocx(data: ContractLooMergeData): Buffer {
  const templatePath = resolveContractLooTemplatePath();
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Leave unknown tags empty rather than throwing during demo iteration
    nullGetter: () => "",
  });
  doc.render(data as unknown as Record<string, unknown>);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
