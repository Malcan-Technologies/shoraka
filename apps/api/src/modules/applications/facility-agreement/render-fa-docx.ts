import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { FacilityAgreementMergeData } from "./fa-merge.types";
import { buildFacilityAgreementRenderPayload } from "./build-fa-render-payload";

const TEMPLATE_FILENAME = "arf-facility-agreement.docx";

export function resolveFacilityAgreementTemplatePath(): string {
  const candidates = [
    path.join(__dirname, "..", "templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "src/modules/applications/templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "apps/api/src/modules/applications/templates", TEMPLATE_FILENAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Facility Agreement template not found (${TEMPLATE_FILENAME}). Looked in: ${candidates.join(", ")}`
  );
}

export function readFacilityAgreementTemplateBytes(): Buffer {
  return fs.readFileSync(resolveFacilityAgreementTemplatePath());
}

export function renderFacilityAgreementDocx(data: FacilityAgreementMergeData): Buffer {
  const content = readFacilityAgreementTemplateBytes();
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (part) => {
      if (part.module === "rawxml") return "";
      if (part.module === "loop") return [];
      if (part.value) return `{${part.value}}`;
      return "";
    },
  });
  doc.render(buildFacilityAgreementRenderPayload(data) as Record<string, unknown>);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
