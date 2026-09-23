import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { FacilityAgreementMergeData } from "./fa-merge.types";
import { buildFacilityAgreementRenderPayload } from "./build-fa-render-payload";
import { splitFacilityAgreementXmlAtSchedule4 } from "./fa-document-xml";
import { mergeNullGetter } from "../../generated-documents/merge-visibility";
import { solidifySignatureLinesInXml } from "../../generated-documents/solid-signature-lines";

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
    nullGetter: mergeNullGetter,
  });
  doc.render(buildFacilityAgreementRenderPayload(data) as Record<string, unknown>);
  const zipAfter = doc.getZip();
  const documentXml = zipAfter.file("word/document.xml")?.asText();
  if (!documentXml) {
    throw new Error("Generated Facility Agreement is missing word/document.xml");
  }
  const { before, fromSchedule4 } = splitFacilityAgreementXmlAtSchedule4(documentXml);
  zipAfter.file("word/document.xml", solidifySignatureLinesInXml(before) + fromSchedule4);
  return zipAfter.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}
