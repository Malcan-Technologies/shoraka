/**
 * Local verification E2E for Legal Documents / Acceptances.
 * Requires API running with DISABLE_AUTH=true NODE_ENV=development.
 * User account/accept paths use services directly (requireAuth is not bypassed).
 */
import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const API = process.env.LOCAL_API_URL || "http://127.0.0.1:4000";
const prisma = new PrismaClient();

type Check = { name: string; status: "PASS" | "FAIL" | "NOT VERIFIED"; evidence: string };
const results: Check[] = [];

function record(name: string, status: Check["status"], evidence: string) {
  results.push({ name, status, evidence });
  console.log(`[${status}] ${name} — ${evidence}`);
}

async function apiJson(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function mockReq(userId: string) {
  return {
    headers: { "user-agent": "legal-docs-verification-e2e" },
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
    user: { user_id: userId },
  } as any;
}

async function main() {
  // --- Admin list ---
  const list = await apiJson("GET", "/v1/admin/legal-documents");
  if (list.status === 200 && list.json?.success && Array.isArray(list.json.data?.documents)) {
    record(
      "Admin list legal documents (HTTP)",
      "PASS",
      `HTTP ${list.status}; count=${list.json.data.documents.length}`
    );
  } else {
    record("Admin list legal documents (HTTP)", "FAIL", `HTTP ${list.status} ${JSON.stringify(list.json).slice(0, 200)}`);
    throw new Error("Admin list failed; aborting");
  }

  const docs = list.json.data.documents as Array<{
    id: string;
    type: string;
    audience: string;
    showInAccount: boolean;
    versions: Array<{ id: string; version: number; status: string; fileHash: string | null }>;
  }>;

  const issuerAgreement = docs.find((d) => d.type === "ISSUER_AGREEMENT");
  const investorAgreement = docs.find((d) => d.type === "INVESTOR_AGREEMENT");
  const terms = docs.find((d) => d.type === "TERMS_OF_USE");
  if (!issuerAgreement || !investorAgreement || !terms) {
    record("Seed legal documents present", "FAIL", "Missing ISSUER_AGREEMENT / INVESTOR_AGREEMENT / TERMS_OF_USE");
    throw new Error("Missing seed docs");
  }
  record("Seed legal documents present", "PASS", "ISSUER_AGREEMENT, INVESTOR_AGREEMENT, TERMS_OF_USE found");

  // --- Enable show_in_account ---
  for (const doc of [issuerAgreement, investorAgreement, terms]) {
    const patch = await apiJson("PATCH", `/v1/admin/legal-documents/${doc.id}`, {
      showInAccount: true,
    });
    if (patch.status === 200 && patch.json?.data?.document?.showInAccount === true) {
      record(`Admin enable showInAccount (${doc.type})`, "PASS", `HTTP ${patch.status}`);
    } else {
      record(
        `Admin enable showInAccount (${doc.type})`,
        "FAIL",
        `HTTP ${patch.status} ${JSON.stringify(patch.json).slice(0, 200)}`
      );
    }
  }

  // --- Create + publish new version for TERMS (DB-backed, no S3 put required for create metadata) ---
  const { legalDocumentService } = await import("../src/modules/legal-documents/service");
  const { auditContextForActor } = await import("../src/modules/legal-documents/audit/context");
  const { legalDocumentAcceptanceService } = await import(
    "../src/modules/legal-documents/acceptance-service"
  );

  const adminUser = await prisma.user.findFirst({
    where: { roles: { has: UserRole.ADMIN } },
    orderBy: { created_at: "asc" },
  });
  if (!adminUser) throw new Error("No admin user");

  const stamp = Date.now();
  const adminCtx = auditContextForActor(mockReq(adminUser.user_id), adminUser.user_id);
  const draft = await legalDocumentService.createDraftVersion(
    terms.id,
    {
      s3Key: `legal-documents/verify-e2e/${stamp}.pdf`,
      fileName: `terms-verify-${stamp}.pdf`,
      contentType: "application/pdf",
      fileSize: 2048,
    },
    adminUser.user_id,
    adminCtx
  );
  record(
    "Create draft version (service)",
    draft.status === "DRAFT" ? "PASS" : "FAIL",
    `version=${draft.version} id=${draft.id} status=${draft.status} hash=${draft.fileHash}`
  );

  const published = await legalDocumentService.publishVersion(
    draft.id,
    { reacceptanceRequired: false },
    adminUser.user_id,
    adminCtx
  );
  record(
    "Publish draft version (service)",
    published.status === "PUBLISHED" ? "PASS" : "FAIL",
    `version=${published.version} id=${published.id} status=${published.status}`
  );

  const publishedCount = await prisma.legalDocumentVersion.count({
    where: { legal_document_id: terms.id, status: "PUBLISHED" },
  });
  record(
    "Only one PUBLISHED per document",
    publishedCount === 1 ? "PASS" : "FAIL",
    `publishedCount=${publishedCount} for TERMS_OF_USE`
  );

  // Invalid transition: publish published again
  try {
    await legalDocumentService.publishVersion(
      published.id,
      { reacceptanceRequired: false },
      adminUser.user_id,
      adminCtx
    );
    record("Reject publish of already-published", "FAIL", "publish succeeded unexpectedly");
  } catch (e: any) {
    record(
      "Reject publish of already-published",
      e?.code === "INVALID_STATUS" || e?.statusCode === 400 ? "PASS" : "FAIL",
      `${e?.code || e?.name}: ${e?.message}`
    );
  }

  // --- Account docs audience filtering (service; HTTP /legal-documents requires Cognito) ---
  const issuerUser = await prisma.user.findUnique({ where: { user_id: "BVUUQ" } });
  const issuerOrg = await prisma.issuerOrganization.findFirst({
    where: { owner_user_id: "BVUUQ", onboarding_status: "COMPLETED" },
  });
  const investorCompleted = await prisma.investorOrganization.findFirst({
    where: { onboarding_status: "COMPLETED", owner_user_id: "JZZVV" },
  });
  const investorUser = investorCompleted
    ? await prisma.user.findUnique({ where: { user_id: investorCompleted.owner_user_id } })
    : null;

  if (issuerUser && issuerOrg) {
    const issuerDocs = await legalDocumentAcceptanceService.listAccountDocuments(
      issuerUser,
      "ISSUER",
      "ISSUER"
    );
    const types = issuerDocs.map((d: any) => d.type);
    const hasIssuer = types.includes("ISSUER_AGREEMENT");
    const hasInvestorOnly = types.includes("INVESTOR_AGREEMENT");
    const allPublishedAccount = issuerDocs.every((d: any) => true);
    record(
      "Issuer account docs (service)",
      hasIssuer && !hasInvestorOnly ? "PASS" : "FAIL",
      `types=${JSON.stringify(types)}; hasIssuer=${hasIssuer}; hasInvestorOnly=${hasInvestorOnly}`
    );

    try {
      await legalDocumentAcceptanceService.listAccountDocuments(issuerUser, "INVESTOR", "ISSUER");
      record("Issuer cannot request investor audience", "FAIL", "expected FORBIDDEN");
    } catch (e: any) {
      record(
        "Issuer cannot request investor audience",
        e?.code === "FORBIDDEN" ? "PASS" : "FAIL",
        `${e?.code}: ${e?.message}`
      );
    }
  } else {
    record("Issuer account docs (service)", "NOT VERIFIED", "No COMPLETED issuer org for BVUUQ");
  }

  if (investorUser && investorCompleted) {
    const investorDocs = await legalDocumentAcceptanceService.listAccountDocuments(
      investorUser,
      "INVESTOR",
      "INVESTOR"
    );
    const types = investorDocs.map((d: any) => d.type);
    const hasInvestor = types.includes("INVESTOR_AGREEMENT");
    const hasIssuerOnly = types.includes("ISSUER_AGREEMENT");
    record(
      "Investor account docs (service)",
      hasInvestor && !hasIssuerOnly ? "PASS" : "FAIL",
      `types=${JSON.stringify(types)}; hasInvestor=${hasInvestor}; hasIssuerOnly=${hasIssuerOnly}`
    );
  } else {
    record(
      "Investor account docs (service)",
      "NOT VERIFIED",
      "No COMPLETED investor organization in local DB"
    );
  }

  // show_in_account false excludes
  await apiJson("PATCH", `/v1/admin/legal-documents/${issuerAgreement.id}`, {
    showInAccount: false,
  });
  if (issuerUser) {
    const after = await legalDocumentAcceptanceService.listAccountDocuments(
      issuerUser,
      "ISSUER",
      "ISSUER"
    );
    const stillThere = after.some((d: any) => d.type === "ISSUER_AGREEMENT");
    record(
      "show_in_account=false hides from account list",
      !stillThere ? "PASS" : "FAIL",
      `stillThere=${stillThere}; types=${JSON.stringify(after.map((d: any) => d.type))}`
    );
  }
  // restore
  await apiJson("PATCH", `/v1/admin/legal-documents/${issuerAgreement.id}`, {
    showInAccount: true,
  });

  // --- Acceptance integrity ---
  if (issuerUser && issuerOrg) {
    const publishedTerms = await prisma.legalDocumentVersion.findFirst({
      where: { legal_document_id: terms.id, status: "PUBLISHED" },
    });
    if (!publishedTerms) throw new Error("No published TERMS");

    const opened = await legalDocumentAcceptanceService.recordOpened(
      mockReq(issuerUser.user_id),
      issuerUser.user_id,
      publishedTerms.id,
      issuerOrg.id,
      "ISSUER"
    );
    record(
      "Record OPENED acceptance",
      opened.status === "OPENED" || opened.status === "ACCEPTED" ? "PASS" : "FAIL",
      `status=${opened.status} id=${opened.id}`
    );

    const accepted = await legalDocumentAcceptanceService.recordAccepted(
      mockReq(issuerUser.user_id),
      issuerUser.user_id,
      publishedTerms.id,
      issuerOrg.id,
      "ISSUER"
    );
    record(
      "Record ACCEPTED acceptance",
      accepted.status === "ACCEPTED" ? "PASS" : "FAIL",
      `status=${accepted.status} versionId=${accepted.legal_document_version_id} hash=${accepted.document_hash} versionNumber=${accepted.version_number}`
    );

    const acceptanceId = accepted.id;
    const acceptedVersionId = accepted.legal_document_version_id;
    const acceptedHash = accepted.document_hash;
    const acceptedVersionNumber = accepted.version_number;

    // Admin list + detail + download
    const accList = await apiJson("GET", "/v1/admin/legal-document-acceptances?status=ACCEPTED");
    const rows = accList.json?.data?.acceptances || accList.json?.data?.items || [];
    const found = Array.isArray(rows) && rows.some((r: any) => r.id === acceptanceId);
    record(
      "Admin list acceptances includes new row (HTTP)",
      accList.status === 200 && found ? "PASS" : accList.status === 200 ? "FAIL" : "FAIL",
      `HTTP ${accList.status}; found=${found}; rowKeys=${Object.keys(accList.json?.data || {})}`
    );

    const detail = await apiJson("GET", `/v1/admin/legal-document-acceptances/${acceptanceId}`);
    record(
      "Admin acceptance detail (HTTP)",
      detail.status === 200 && detail.json?.data?.acceptance?.id === acceptanceId ? "PASS" : "FAIL",
      `HTTP ${detail.status}; version=${detail.json?.data?.acceptance?.versionNumber ?? detail.json?.data?.versionNumber}`
    );

    const dl = await apiJson("GET", `/v1/admin/legal-document-acceptances/${acceptanceId}/download`);
    const dlData = dl.json?.data;
    record(
      "Admin exact-version download URL (HTTP)",
      dl.status === 200 && typeof dlData?.downloadUrl === "string" ? "PASS" : "FAIL",
      `HTTP ${dl.status}; hasUrl=${Boolean(dlData?.downloadUrl)}; fileName=${dlData?.fileName}; hash=${dlData?.documentHash ?? dlData?.fileHash}`
    );

    // Publish newer version; old acceptance must stay linked
    const draft2 = await legalDocumentService.createDraftVersion(
      terms.id,
      {
        s3Key: `legal-documents/verify-e2e/${stamp}-vnext.pdf`,
        fileName: `terms-verify-${stamp}-next.pdf`,
        contentType: "application/pdf",
        fileSize: 4096,
      },
      adminUser.user_id,
      adminCtx
    );
    const published2 = await legalDocumentService.publishVersion(
      draft2.id,
      { reacceptanceRequired: true },
      adminUser.user_id,
      adminCtx
    );
    record(
      "Publish newer TERMS version",
      published2.status === "PUBLISHED" && published2.id !== acceptedVersionId ? "PASS" : "FAIL",
      `newId=${published2.id} oldAcceptedId=${acceptedVersionId}`
    );

    const oldRow = await prisma.legalDocumentAcceptance.findUnique({ where: { id: acceptanceId } });
    record(
      "Old acceptance immutable after new publish",
      oldRow?.legal_document_version_id === acceptedVersionId &&
        oldRow?.document_hash === acceptedHash &&
        oldRow?.version_number === acceptedVersionNumber &&
        oldRow?.status === "ACCEPTED"
        ? "PASS"
        : "FAIL",
      `versionId=${oldRow?.legal_document_version_id} hash=${oldRow?.document_hash} versionNumber=${oldRow?.version_number} status=${oldRow?.status}`
    );

    const dlAfter = await apiJson(
      "GET",
      `/v1/admin/legal-document-acceptances/${acceptanceId}/download`
    );
    const dlFile = String(dlAfter.json?.data?.fileName || "");
    const dlHash = dlAfter.json?.data?.documentHash ?? dlAfter.json?.data?.fileHash;
    const targetsOld =
      dlAfter.status === 200 &&
      !dlFile.includes("-next") &&
      (dlHash === acceptedHash || dlFile.includes(String(stamp)));
    record(
      "Download still targets accepted (old) version",
      targetsOld ? "PASS" : "FAIL",
      `HTTP ${dlAfter.status}; fileName=${dlFile}; hash=${dlHash}; acceptedHash=${acceptedHash}`
    );
  } else {
    record("Acceptance flow", "NOT VERIFIED", "Missing issuer user/org");
  }

  // --- Unauthorized admin route without bypass (user legal-documents still requires auth) ---
  const unauth = await apiJson("GET", "/v1/legal-documents/account?audience=ISSUER");
  record(
    "User account route rejects unauthenticated HTTP",
    unauth.status === 401 ? "PASS" : "FAIL",
    `HTTP ${unauth.status}`
  );

  // --- Note investment Prospectus-only ---
  const root = join(process.cwd());
  const serviceSrc = readFileSync(join(root, "src/modules/notes/service.ts"), "utf8");
  const schemaSrc = readFileSync(join(root, "src/modules/notes/schemas.ts"), "utf8");
  const investPage = readFileSync(
    join(root, "../investor/src/app/investments/page.tsx"),
    "utf8"
  );
  const prospectusOnlyApi =
    serviceSrc.includes("Confirm that you have reviewed the Prospectus.") &&
    !serviceSrc.match(/siteDocument/i) &&
    schemaSrc.includes("prospectusAcknowledged: z.literal(true)");
  const prospectusOnlyUi =
    investPage.includes("reviewed the") &&
    investPage.includes("Prospectus") &&
    !investPage.includes("Product Terms") &&
    !investPage.includes("Risk Disclosure");
  record(
    "Note investment Prospectus-only (source)",
    prospectusOnlyApi && prospectusOnlyUi ? "PASS" : "FAIL",
    `api=${prospectusOnlyApi} ui=${prospectusOnlyUi}`
  );

  // Live invest HTTP path still needs Cognito — mark separately
  record(
    "Note investment live HTTP E2E",
    "NOT VERIFIED",
    "/v1/legal-documents and invest commit require Cognito; DISABLE_AUTH does not bypass user legal routes"
  );

  // Portal pages
  for (const [name, url] of [
    ["Admin /legal-documents", "http://127.0.0.1:3003/legal-documents"],
    ["Admin /legal-document-acceptances", "http://127.0.0.1:3003/legal-document-acceptances"],
    ["Issuer /profile", "http://127.0.0.1:3001/profile"],
    ["Investor /profile", "http://127.0.0.1:3002/profile"],
    ["Investor /investments", "http://127.0.0.1:3002/investments"],
  ] as const) {
    const res = await fetch(url);
    record(`Portal page ${name}`, res.status === 200 ? "PASS" : "FAIL", `HTTP ${res.status}`);
  }

  // Browser Cognito login flows
  record(
    "Browser Cognito login E2E (Admin/Issuer/Investor UI clicks)",
    "NOT VERIFIED",
    "No automated Cognito credentials available in this session"
  );

  console.log("\n=== SUMMARY ===");
  const counts = { PASS: 0, FAIL: 0, "NOT VERIFIED": 0 };
  for (const r of results) counts[r.status]++;
  console.log(JSON.stringify({ counts, results }, null, 2));

  await prisma.$disconnect();
  if (counts.FAIL > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
