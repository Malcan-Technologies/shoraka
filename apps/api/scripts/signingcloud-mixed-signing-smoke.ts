/**
 * Mixed SigningCloud smoke: textfield + optional seal placement, keyword stamps,
 * and optional mixed file2 upload (manual coordinate rows + automatic keyword boxes).
 *
 * Does not change production templates.
 *
 * Required for layout proof: GOTENBERG_URL
 * Optional live upload: SC_BASE_URL, SC_API_KEY, SC_API_SECRET, SIGNINGCLOUD_SMOKE_SIGNER_EMAIL
 * Optional shared automatic proof: SIGNINGCLOUD_SMOKE_AUTO=1,
 *   SIGNINGCLOUD_SMOKE_AUTO_EMAIL, SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2
 *
 * Does not print secrets, tokens, or image bytes.
 */
import { config as loadEnv } from "dotenv";
import * as path from "path";
import { createFacilityAgreementFixture } from "../src/modules/applications/facility-agreement/fa-fixture";
import { renderFacilityAgreementDocx } from "../src/modules/applications/facility-agreement/render-fa-docx";
import { buildFaSigningCloudSignsetsFromPdf } from "../src/modules/applications/facility-agreement/fa-signing-placement";
import { createJsgFixture } from "../src/modules/applications/joint-several-guarantee/jsg-fixture";
import { renderJsgDocx } from "../src/modules/applications/joint-several-guarantee/render-jsg-docx";
import { buildJsgSigningCloudSignsetsFromPdf } from "../src/modules/applications/joint-several-guarantee/jsg-signing-placement";
import { createDeedOfAssignmentFixture } from "../src/modules/applications/deed-of-assignment/doa-fixture";
import { renderDeedOfAssignmentDocx } from "../src/modules/applications/deed-of-assignment/render-doa-docx";
import { buildDoaSigningCloudSignsetsFromPdf } from "../src/modules/applications/deed-of-assignment/doa-signing-placement";
import { convertDocxToPdf, resolveGotenbergUrl } from "../src/modules/applications/letter-of-offer/convert-docx-to-pdf";
import {
  buildAutomaticSigningCloudSignsetsFromPdf,
  ensureAutomaticSigningKeywords,
} from "../src/modules/signing/automatic-signing-keywords";
import { extractPdfTextItems } from "../src/modules/applications/joint-several-guarantee/jsg-signing-placement";
import { buildDocumentProviderSigners } from "../src/modules/signing/provider-signers";
import { SigningCloudProvider } from "../src/modules/signing/provider/signingcloud-adapter";
import {
  isSigningCloudSealFieldEnabled,
  readSigningCloudConfigFromEnv,
} from "../src/modules/signingcloud/signingcloud-api";
import {
  automaticSignerKeywordPair,
  defaultAutomaticKeywordOwners,
  executionRoleHasSignDate,
} from "@cashsouk/types";
import {
  SMOKE_SIGNATURE_HEIGHT_PX,
  SMOKE_SIGNATURE_WIDTH_PX,
  transparentSignaturePng,
} from "./lib/signingcloud-smoke-images";

loadEnv({ path: path.join(__dirname, "../.env.local") });
loadEnv({ path: path.join(__dirname, "../.env") });

const includeSeal = isSigningCloudSealFieldEnabled();

function keywordCount(text: string, keyword: string): number {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`${escaped}(?![A-Z0-9_])`, "g")) ?? []).length;
}

async function assertOwners(
  pdf: Buffer,
  owners: ReturnType<typeof defaultAutomaticKeywordOwners>
): Promise<void> {
  const text = (await extractPdfTextItems(pdf)).map((item) => item.text).join("\n");
  for (const owner of owners) {
    const signExpected = owner.placements.length;
    if (keywordCount(text, owner.signKeyword) !== signExpected) {
      throw new Error(
        `Expected ${signExpected} ${owner.signKeyword} in PDF, found ${keywordCount(text, owner.signKeyword)}`
      );
    }
    if (!owner.dateKeyword) continue;
    const dateExpected = owner.placements.filter((placement) =>
      executionRoleHasSignDate(placement.roleKey)
    ).length;
    if (keywordCount(text, owner.dateKeyword) !== dateExpected) {
      throw new Error(
        `Expected ${dateExpected} ${owner.dateKeyword} in PDF, found ${keywordCount(text, owner.dateKeyword)}`
      );
    }
  }
}

const SMOKE_SIGNATURE_PNG = transparentSignaturePng();

function fieldTypes(signsets: Array<Array<{ fieldtype?: string }>>): string {
  return signsets
    .map((fields) => fields.map((field) => field.fieldtype ?? "?").join("+"))
    .join(" | ");
}

async function main(): Promise<void> {
  if (!resolveGotenbergUrl()) {
    throw new Error("GOTENBERG_URL is required");
  }

  const autoEmailA = process.env.SIGNINGCLOUD_SMOKE_AUTO_EMAIL?.trim() ?? "";
  const autoEmailB = process.env.SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2?.trim() ?? "";
  const pairA = automaticSignerKeywordPair("FA", autoEmailA || "auto1@example.invalid", [
    { roleKey: "FA_INVESTOR" },
    { roleKey: "FA_AGENT" },
  ]);
  const pairB = automaticSignerKeywordPair("FA", autoEmailB || "auto2@example.invalid", [
    { roleKey: "FA_INVESTOR" },
    { roleKey: "FA_AGENT" },
  ]);
  const faNames = ["Ali Bin Abu", "Siti Binti Ahmad"];
  const faRepeats = { issuerSignatoryCount: faNames.length };
  const faWitness = defaultAutomaticKeywordOwners("facility_agreement", faRepeats).filter((owner) =>
    owner.placements.every((placement) => placement.roleKey === "FA_ISSUER_WITNESS")
  );
  const faOwners = [
    {
      ...pairA,
      placements: [
        { roleKey: "FA_INVESTOR" as const, slotIndex: 1 },
        { roleKey: "FA_AGENT" as const, slotIndex: 1 },
      ],
    },
    {
      ...pairB,
      placements: [
        { roleKey: "FA_INVESTOR" as const, slotIndex: 2 },
        { roleKey: "FA_AGENT" as const, slotIndex: 2 },
      ],
    },
    ...faWitness,
  ];

  let faPdf = await convertDocxToPdf(renderFacilityAgreementDocx(createFacilityAgreementFixture()));
  faPdf = await ensureAutomaticSigningKeywords(faPdf, "facility_agreement", faRepeats, faOwners);
  await assertOwners(faPdf, faOwners);
  console.log(
    `FA automatic keywords: ${faOwners.map((owner) => owner.signKeyword).join(", ")}`
  );
  let faSignsets: Awaited<ReturnType<typeof buildFaSigningCloudSignsetsFromPdf>> | null = null;
  try {
    faSignsets = await buildFaSigningCloudSignsetsFromPdf(
      faPdf,
      [
        { name: faNames[0]!, appliesCompanySeal: false },
        { name: faNames[1]!, appliesCompanySeal: true },
      ],
      { includeTextField: true, includeSeal }
    );
    console.log(`FA fields: ${fieldTypes(faSignsets)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("overlap")) throw error;
    console.log(`FA mixed CA fields skipped: ${message}`);
  }

  const jsg = createJsgFixture();
  const jsgNames = [
    ...jsg.guarantors_individual.map((row) => row.name),
    ...jsg.guarantors_corporate.flatMap((row) => row.signatories.map((person) => person.name)),
  ].filter(Boolean);
  let jsgPdf = await convertDocxToPdf(renderJsgDocx(jsg));
  const jsgRepeats = { jsgGuarantorSignatureCount: jsgNames.length };
  const jsgOwners = defaultAutomaticKeywordOwners("guarantor_agreement", jsgRepeats);
  jsgPdf = await ensureAutomaticSigningKeywords(jsgPdf, "guarantor_agreement", jsgRepeats, jsgOwners);
  await assertOwners(jsgPdf, jsgOwners);
  try {
    const jsgSignsets = await buildJsgSigningCloudSignsetsFromPdf(jsgPdf, jsgNames);
    console.log(`JSG fields: ${fieldTypes(jsgSignsets)}`);
  } catch (error) {
    console.log(`JSG CA fields skipped: ${error instanceof Error ? error.message : error}`);
  }

  const doaNames = ["Ali Bin Abu", "Siti Binti Ahmad"];
  let doaPdf = await convertDocxToPdf(renderDeedOfAssignmentDocx(createDeedOfAssignmentFixture()));
  const doaRepeats = { assignorSignatoryCount: doaNames.length };
  const doaOwners = defaultAutomaticKeywordOwners("deed_of_assignment", doaRepeats);
  doaPdf = await ensureAutomaticSigningKeywords(doaPdf, "deed_of_assignment", doaRepeats, doaOwners);
  await assertOwners(doaPdf, doaOwners);
  try {
    const doaSignsets = await buildDoaSigningCloudSignsetsFromPdf(
      doaPdf,
      [
        { name: doaNames[0]!, appliesCompanySeal: false },
        { name: doaNames[1]!, appliesCompanySeal: true },
      ],
      { includeTextField: true, includeSeal }
    );
    console.log(`DOA fields: ${fieldTypes(doaSignsets)}`);
  } catch (error) {
    console.log(`DOA CA fields skipped: ${error instanceof Error ? error.message : error}`);
  }

  const liveEmail = process.env.SIGNINGCLOUD_SMOKE_SIGNER_EMAIL?.trim();
  if (!liveEmail || !readSigningCloudConfigFromEnv() || !faSignsets) {
    console.log(
      faSignsets
        ? "Layout proof complete. Set SC_* and SIGNINGCLOUD_SMOKE_SIGNER_EMAIL to upload."
        : "Keyword layout proof complete. Mixed FA CA fields were skipped, so live upload was not attempted."
    );
    return;
  }

  const provider = new SigningCloudProvider();
  const manual = buildDocumentProviderSigners(
    faSignsets.map((signset) => ({ email: liveEmail, signset }))
  );
  const automaticBySlot = await buildAutomaticSigningCloudSignsetsFromPdf(
    faPdf,
    "facility_agreement",
    faRepeats
  );
  const automaticRows = [
    autoEmailA
      ? {
          email: autoEmailA,
          executionMode: "AUTOMATIC" as const,
          signset: [
            ...(automaticBySlot.get("FA_INVESTOR:1") ?? []),
            ...(automaticBySlot.get("FA_AGENT:1") ?? []),
          ],
        }
      : null,
    autoEmailB
      ? {
          email: autoEmailB,
          executionMode: "AUTOMATIC" as const,
          signset: [
            ...(automaticBySlot.get("FA_INVESTOR:2") ?? []),
            ...(automaticBySlot.get("FA_AGENT:2") ?? []),
          ],
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row != null);
  const signers = [...manual, ...buildDocumentProviderSigners(automaticRows)];
  const { providerRef } = await provider.createDocumentContract({
    pdfBuffer: faPdf,
    contractName: `mixed-smoke-fa-${Date.now()}`,
    signers,
  });
  console.log(`Uploaded mixed FA contract (${providerRef.slice(0, 8)}…)`);
  console.log(`Automatic signer count after merge: ${signers.filter((row) => row.executionMode === "AUTOMATIC").length}`);

  if (process.env.SIGNINGCLOUD_SMOKE_AUTO !== "1") {
    console.log("Set SIGNINGCLOUD_SMOKE_AUTO=1 with AUTO_EMAIL and AUTO_EMAIL_2 to prove shared automatic stamps.");
    return;
  }
  if (!autoEmailA || !autoEmailB) {
    throw new Error(
      "SIGNINGCLOUD_SMOKE_AUTO=1 requires SIGNINGCLOUD_SMOKE_AUTO_EMAIL and SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2."
    );
  }

  const signersToAuto = [
    { email: autoEmailA, keyword: pairA.signKeyword, dateKeyword: pairA.dateKeyword },
    { email: autoEmailB, keyword: pairB.signKeyword, dateKeyword: pairB.dateKeyword },
  ];
  for (const signer of signersToAuto) {
    const result = await provider.autoSign({
      providerRef,
      signerEmail: signer.email,
      keyword: signer.keyword,
      dateKeyword: signer.dateKeyword,
      dateFormat: signer.dateKeyword ? "dd/MM/yyyy" : undefined,
      signatureImageBytes: SMOKE_SIGNATURE_PNG,
      widthPx: SMOKE_SIGNATURE_WIDTH_PX,
      heightPx: SMOKE_SIGNATURE_HEIGHT_PX,
    });
    if (result.alreadySigned) {
      throw new Error(
        `SigningCloud returned alreadySigned for ${signer.keyword} on the first call for ${signer.email}.`
      );
    }
    console.log(`Auto-signed ${signer.keyword}`);
  }

  const details = await provider.getContractDetails({ providerRef });
  const autoSigners = details.signers.filter(
    (signer) =>
      signer.email.toLowerCase() === autoEmailA.toLowerCase() ||
      signer.email.toLowerCase() === autoEmailB.toLowerCase()
  );
  if (autoSigners.length !== 2 || autoSigners.some((signer) => signer.status !== "SIGNED")) {
    throw new Error("Expected both automatic signers to be SIGNED after one call each.");
  }
  console.log("Shared automatic FA proof complete: two signers, one call each, both SIGNED.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
