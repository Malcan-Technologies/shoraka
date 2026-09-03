import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { JsgMergeData } from "./jsg-merge.types";
import { buildJsgRenderPayload } from "./build-jsg-render-payload";

const TEMPLATE_FILENAME = "arf-joint-several-guarantee.docx";

export function resolveJsgTemplatePath(): string {
  const candidates = [
    path.join(__dirname, "..", "templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "src/modules/applications/templates", TEMPLATE_FILENAME),
    path.join(process.cwd(), "apps/api/src/modules/applications/templates", TEMPLATE_FILENAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `JSG template not found (${TEMPLATE_FILENAME}). Looked in: ${candidates.join(", ")}`
  );
}

export function readJsgTemplateBytes(): Buffer {
  return fs.readFileSync(resolveJsgTemplatePath());
}

export function renderJsgDocx(data: JsgMergeData): Buffer {
  const content = readJsgTemplateBytes();
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
  doc.render(buildJsgRenderPayload(data) as Record<string, unknown>);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
