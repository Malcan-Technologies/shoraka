import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { DeedOfAssignmentMergeData } from "./doa-merge.types";
import { buildDeedOfAssignmentRenderPayload } from "./build-doa-render-payload";

const TEMPLATE_FILENAME = "arf-deed-of-assignment.docx";

export function resolveDeedOfAssignmentTemplatePath(): string {
  const candidates = [
    path.join(__dirname, "..", "templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "src/modules/applications/templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "apps/api/src/modules/applications/templates", TEMPLATE_FILENAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Deed of Assignment template not found (${TEMPLATE_FILENAME}). Looked in: ${candidates.join(", ")}`
  );
}

export function readDeedOfAssignmentTemplateBytes(): Buffer {
  return fs.readFileSync(resolveDeedOfAssignmentTemplatePath());
}

export function renderDeedOfAssignmentDocx(data: DeedOfAssignmentMergeData): Buffer {
  const content = readDeedOfAssignmentTemplateBytes();
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
  doc.render(buildDeedOfAssignmentRenderPayload(data) as Record<string, unknown>);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
