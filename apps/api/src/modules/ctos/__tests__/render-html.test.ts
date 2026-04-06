import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { renderCtosReportHtml } from "../render-html";

function xsltprocAvailable(): boolean {
  try {
    execSync("xsltproc --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const describeXslt = xsltprocAvailable() ? describe : describe.skip;

describeXslt("renderCtosReportHtml (requires xsltproc on PATH)", () => {
  it("produces HTML with End of Report for minimal CTOS-shaped XML", () => {
    const fixturePath = path.join(__dirname, "../__fixtures__/minimal-ctos-report.xml");
    const rawXml = fs.readFileSync(fixturePath, "utf-8");
    const html = renderCtosReportHtml(rawXml);
    expect(html).not.toBeNull();
    expect(html!).toMatch(/<html/i);
    expect(html!).toContain("End of Report");
  });
});
