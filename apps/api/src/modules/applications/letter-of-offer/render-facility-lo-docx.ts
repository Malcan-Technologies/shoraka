import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { ContractFacilityLoMergeData } from "./facility-lo-merge.types";
import { buildFacilityLoRenderPayload } from "./facility-lo-guarantors";
import {
  highlightMergeTagsInWordXml,
  replaceEmptyMergeValuesWithTags,
} from "./lo-dev-merge-markup";

const TEMPLATE_FILENAME = "arf-contract-facility-lo.docx";

export function resolveFacilityLoTemplatePath(): string {
  const candidates = [
    path.join(__dirname, "..", "templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "src/modules/applications/templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "apps/api/src/modules/applications/templates", TEMPLATE_FILENAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Contract LO template not found (${TEMPLATE_FILENAME}). Looked in: ${candidates.join(", ")}`
  );
}

export function readFacilityLoTemplateBytes(): Buffer {
  return fs.readFileSync(resolveFacilityLoTemplatePath());
}

export function renderFacilityLoDocx(data: ContractFacilityLoMergeData): Buffer {
  const templatePath = resolveFacilityLoTemplatePath();
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const documentXml = zip.file("word/document.xml")?.asText();
  if (documentXml) {
    zip.file("word/document.xml", highlightMergeTagsInWordXml(documentXml));
  }
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Dev: show `{tag}` when a merge key is missing instead of swallowing it.
    nullGetter: (part: { module?: string; value?: string }) =>
      !part.module && part.value ? `{${part.value}}` : "",
  });
  doc.render(
    replaceEmptyMergeValuesWithTags(buildFacilityLoRenderPayload(data)) as Record<
      string,
      unknown
    >
  );
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
