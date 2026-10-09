import fs from "fs";
import path from "path";
import PizZip from "pizzip";

/**
 * LibreOffice (Gotenberg) renders unaccepted Word revisions with change bars in the
 * page margin, so every shipped template must have all tracked changes accepted.
 */
const MODULES_DIR = path.resolve(__dirname, "..");

const REVISION_TAG_RE =
  /<w:(ins|del|moveFrom|moveTo|pPrChange|rPrChange|tblPrChange|trPrChange|tcPrChange|sectPrChange|numberingChange|cellIns|cellDel|cellMerge)\b/g;

function findTemplateDocxFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findTemplateDocxFiles(fullPath));
    } else if (
      entry.name.endsWith(".docx") &&
      !entry.name.startsWith("~$") &&
      path.basename(dir) === "templates"
    ) {
      found.push(fullPath);
    }
  }
  return found;
}

function trackedChangeCounts(docxPath: string): Record<string, number> {
  const zip = new PizZip(fs.readFileSync(docxPath));
  const counts: Record<string, number> = {};
  for (const name of Object.keys(zip.files)) {
    if (!/^word\/.+\.xml$/.test(name)) continue;
    const matches = zip.file(name)?.asText().match(REVISION_TAG_RE);
    if (matches?.length) counts[name] = matches.length;
  }
  return counts;
}

describe("docx templates", () => {
  const templates = findTemplateDocxFiles(MODULES_DIR);

  it("finds the shipped templates", () => {
    expect(templates.map((p) => path.basename(p))).toEqual(
      expect.arrayContaining(["arf-facility-agreement.docx", "arf-deed-of-assignment.docx"])
    );
  });

  it.each(templates.map((p) => [path.relative(MODULES_DIR, p), p]))(
    "%s has no unaccepted tracked changes",
    (_label, docxPath) => {
      expect(trackedChangeCounts(docxPath)).toEqual({});
    }
  );
});
