/**
 * SECTION: CTOS XML → HTML via XSLT
 * WHY: Pre-render full report for fast admin viewing. PDF is not produced here (future phase may use this HTML).
 * INPUT: raw CTOS report XML
 * OUTPUT: HTML string or null if transform unavailable/fails
 * WHERE USED: ctos report service after fetch
 */

import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { logger } from "../../lib/logger";

function getXsltDir(): string {
  const alongside = path.join(__dirname, "xslt");
  if (fs.existsSync(path.join(alongside, "ctos_report.xsl"))) {
    return alongside;
  }
  const fromSrc = path.resolve(process.cwd(), "src/modules/ctos/xslt");
  if (fs.existsSync(path.join(fromSrc, "ctos_report.xsl"))) {
    return fromSrc;
  }
  return alongside;
}

/**
 * Uses `xsltproc` when present (libxslt). Docker/production images should install `libxslt`.
 */
export function renderCtosReportHtml(rawXml: string): string | null {
  const xsltDir = getXsltDir();
  const mainXsl = path.join(xsltDir, "ctos_report.xsl");
  if (!fs.existsSync(mainXsl)) {
    logger.warn({ xsltDir }, "CTOS XSLT bundle missing; skip HTML render");
    return null;
  }

  const xmlPath = path.join(os.tmpdir(), `ctos-${process.pid}-${Date.now()}.xml`);
  try {
    fs.writeFileSync(xmlPath, rawXml, "utf-8");
    const r = spawnSync(
      "xsltproc",
      ["--nonet", "--path", xsltDir, mainXsl, xmlPath],
      { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
    );
    if (r.error) {
      if ((r.error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.warn("xsltproc not installed; skip CTOS HTML render");
        return null;
      }
      logger.error({ err: String(r.error) }, "CTOS xsltproc spawn error");
      return null;
    }
    if (r.status !== 0) {
      logger.error({ stderr: r.stderr?.slice?.(0, 500) }, "CTOS XSLT failed");
      return null;
    }
      logger.debug("CTOS report HTML rendered via xsltproc");
    return r.stdout || null;
  } finally {
    try {
      fs.unlinkSync(xmlPath);
    } catch {
      /* ignore */
    }
  }
}
