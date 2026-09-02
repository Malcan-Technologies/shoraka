import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import {
  buildCertificateDocxMergeData,
  type CertificateDocxMergeData,
} from "./certificate-merge-data";
import type { CertificateRenderAudienceInput } from "./certificate-audience";
import type { InvestmentNoteCertificateSnapshot } from "./types";

const TEMPLATE_FILENAME = "islamic-investment-note-certificate-v1.docx";

export function resolveCertificateTemplatePath(): string {
  const candidates = [
    path.join(__dirname, "templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "src/modules/notes/investment-note-certificate/templates", TEMPLATE_FILENAME),
    path.join(
      process.cwd(),
      "apps/api/src/modules/notes/investment-note-certificate/templates",
      TEMPLATE_FILENAME
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Investment Note Certificate template not found (${TEMPLATE_FILENAME}). Looked in: ${candidates.join(", ")}`
  );
}

export function readCertificateTemplateBytes(): Buffer {
  return fs.readFileSync(resolveCertificateTemplatePath());
}

function renderMergeData(data: CertificateDocxMergeData): Buffer {
  const zip = new PizZip(readCertificateTemplateBytes());
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "—",
  });
  doc.render(data as unknown as Record<string, unknown>);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

export function renderInvestmentNoteCertificateDocx(
  snapshot: InvestmentNoteCertificateSnapshot,
  input: CertificateRenderAudienceInput
): Buffer {
  return renderMergeData(buildCertificateDocxMergeData(snapshot, input));
}
