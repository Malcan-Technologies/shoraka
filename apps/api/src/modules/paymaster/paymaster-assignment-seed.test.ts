/**
 * SECTION: Paymaster / Notice / Prospectus scenario seed (local DB)
 */

import { PrismaClient } from "@prisma/client";
import { parseApprovedSnapshot } from "../notes/prospectus-review/prospectus-approved-snapshot";
import { expectedProspectusPageCount } from "../notes/prospectus/prospectus-pdf";
import { listIssuerPaymasters } from "./service";
import {
  NOTE_A_ID,
  NOTE_B_ID,
  NOTE_C_ID,
  NOTE_D_ID,
  NOTE_G_ID,
  NOTE_L_ID,
  PMAS_ORG_A_ID,
  PMAS_ORG_B_ID,
  PMAS_ORG_C_ID,
  PMAS_PAYMASTER_1_NAME,
  PMAS_PAYMASTER_1_SSM,
  PMAS_PAYMASTER_2_SSM,
  PMAS_PAYMASTER_3_SSM,
  seedPaymasterAssignmentScenarios,
} from "../../../scripts/seed-paymaster-assignment-scenarios";

const prisma = new PrismaClient();

describe("paymaster assignment scenario seed", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("is idempotent and seeds reusable Paymaster, MARC, 3/5-page publications, and Notice states", async () => {
    const first = await seedPaymasterAssignmentScenarios();
    const second = await seedPaymasterAssignmentScenarios();
    expect(second.paymaster1Id).toBe(first.paymaster1Id);
    expect(second.paymaster2Id).toBe(first.paymaster2Id);
    expect(second.paymaster3Id).toBe(first.paymaster3Id);

    const harbourRows = await prisma.paymaster.findMany({
      where: { registration_number: PMAS_PAYMASTER_1_SSM },
    });
    expect(harbourRows).toHaveLength(1);
    expect(harbourRows[0]?.legal_name).toBe(PMAS_PAYMASTER_1_NAME);

    const sameNameDifferentSsm = await prisma.paymaster.count({
      where: { legal_name: PMAS_PAYMASTER_1_NAME },
    });
    expect(sameNameDifferentSsm).toBe(1);

    const harbourNotes = await prisma.note.findMany({
      where: { paymaster_id: first.paymaster1Id },
      select: { id: true, issuer_organization_id: true },
    });
    expect(harbourNotes.length).toBeGreaterThanOrEqual(4);
    const harbourIssuers = new Set(harbourNotes.map((row) => row.issuer_organization_id));
    expect(harbourIssuers.has(PMAS_ORG_A_ID)).toBe(true);
    expect(harbourIssuers.has(PMAS_ORG_B_ID)).toBe(true);

    const linkA = await prisma.issuerPaymasterLink.findUniqueOrThrow({
      where: {
        issuer_organization_id_paymaster_id: {
          issuer_organization_id: PMAS_ORG_A_ID,
          paymaster_id: first.paymaster1Id,
        },
      },
    });
    const linkB = await prisma.issuerPaymasterLink.findUniqueOrThrow({
      where: {
        issuer_organization_id_paymaster_id: {
          issuer_organization_id: PMAS_ORG_B_ID,
          paymaster_id: first.paymaster1Id,
        },
      },
    });
    expect(linkA.is_related_party).toBe(false);
    expect(linkB.is_related_party).toBe(true);

    const issuerAOptions = await listIssuerPaymasters(PMAS_ORG_A_ID);
    const issuerBOptions = await listIssuerPaymasters(PMAS_ORG_B_ID);
    const issuerCOptions = await listIssuerPaymasters(PMAS_ORG_C_ID);
    expect(issuerAOptions.some((row) => row.id === first.paymaster1Id)).toBe(true);
    expect(issuerBOptions.some((row) => row.id === first.paymaster1Id)).toBe(true);
    expect(issuerCOptions.some((row) => row.id === first.paymaster1Id)).toBe(false);
    expect(issuerCOptions.some((row) => row.registrationNumber === PMAS_PAYMASTER_2_SSM)).toBe(
      true
    );

    const marcA = await prisma.issuerOrganizationMarcAssessment.findFirstOrThrow({
      where: { issuer_organization_id: PMAS_ORG_A_ID },
      orderBy: { created_at: "desc" },
    });
    const marcB = await prisma.issuerOrganizationMarcAssessment.findFirstOrThrow({
      where: { issuer_organization_id: PMAS_ORG_B_ID },
      orderBy: { created_at: "desc" },
    });
    expect(marcA.credit_grade).toBe("SME-3");
    expect(Number(marcA.credit_score)).toBe(74);
    expect(Number(marcA.probability_of_default)).toBeCloseTo(1.13);
    expect(marcB.credit_grade).toBe("SME-6");

    const noticeA = await prisma.paymasterAssignmentNotice.findFirstOrThrow({
      where: { note_id: NOTE_A_ID },
    });
    const noticeB = await prisma.paymasterAssignmentNotice.findFirstOrThrow({
      where: { note_id: NOTE_B_ID },
    });
    const noticeC = await prisma.paymasterAssignmentNotice.findFirstOrThrow({
      where: { note_id: NOTE_C_ID },
    });
    const noticeG = await prisma.paymasterAssignmentNotice.findFirstOrThrow({
      where: { note_id: NOTE_G_ID },
    });
    expect(noticeA.status).toBe("ACKNOWLEDGED");
    expect(noticeB.status).toBe("SENT");
    expect(noticeC.status).toBe("ACKNOWLEDGEMENT_UPLOADED");
    expect(noticeG.status).toBe("GENERATED");
    expect(noticeA.notice_s3_key).toBeNull();
    expect(noticeB.acknowledgement_uploaded_at).toBeNull();

    const withdrawalA = await prisma.withdrawalInstruction.findFirstOrThrow({
      where: { note_id: NOTE_A_ID, withdrawal_type: "ISSUER_DISBURSEMENT" },
      include: { shoraka_trade_order: true },
    });
    const withdrawalB = await prisma.withdrawalInstruction.findFirstOrThrow({
      where: { note_id: NOTE_B_ID, withdrawal_type: "ISSUER_DISBURSEMENT" },
      include: { shoraka_trade_order: true },
    });
    const withdrawalC = await prisma.withdrawalInstruction.findFirstOrThrow({
      where: { note_id: NOTE_C_ID, withdrawal_type: "ISSUER_DISBURSEMENT" },
      include: { shoraka_trade_order: true },
    });
    expect(withdrawalA.status).toBe("DRAFT");
    expect(withdrawalA.shoraka_trade_order?.certificate_s3_key).toBeTruthy();
    expect(withdrawalB.status).toBe("DRAFT");
    expect(withdrawalB.shoraka_trade_order?.certificate_s3_key).toBeTruthy();
    expect(withdrawalC.status).toBe("DRAFT");
    expect(withdrawalC.shoraka_trade_order?.certificate_s3_key).toBeTruthy();
    expect(noticeA.status === "ACKNOWLEDGED").toBe(true);
    expect(noticeB.status === "ACKNOWLEDGED").toBe(false);
    expect(noticeC.status === "ACKNOWLEDGED").toBe(false);

    const pubFive = await prisma.noteProspectusPublication.findFirstOrThrow({
      where: { note_id: NOTE_A_ID },
    });
    const pubLegacy = await prisma.noteProspectusPublication.findFirstOrThrow({
      where: { note_id: NOTE_D_ID },
    });
    const snapFive = parseApprovedSnapshot(pubFive.snapshot);
    const snapLegacy = parseApprovedSnapshot(pubLegacy.snapshot);
    expect(snapFive?.html.page1).toContain("Closing Date");
    expect(snapFive?.html.page3).toContain("Paymaster Grading");
    expect(snapFive?.html.page3).toContain("Confidence Grading");
    expect(snapFive?.html.page2).not.toContain("Paymaster Rating");
    expect(snapFive?.html.page2).not.toContain("Confidence Grading");
    expect(snapFive?.html.page4).toBeTruthy();
    expect(snapFive?.html.page5).toBeTruthy();
    expect(snapLegacy?.html.page4).toBeUndefined();
    expect(snapLegacy?.html.page5).toBeUndefined();
    expect(expectedProspectusPageCount(snapFive!.html)).toBe(5);
    expect(expectedProspectusPageCount(snapLegacy!.html)).toBe(3);
    expect(pubFive.pdf_page_count).toBe(5);
    expect(pubLegacy.pdf_page_count).toBe(3);
    expect(pubFive.pdf_generation_status).toBe("PENDING");
    expect(pubFive.pdf_storage_key).toBeNull();
    expect(pubLegacy.pdf_generation_status).toBe("PENDING");
    expect(pubLegacy.pdf_storage_key).toBeNull();

    const reviewA = await prisma.noteProspectusReview.findUniqueOrThrow({
      where: { note_id: NOTE_A_ID },
    });
    const draft = reviewA.approved_content as {
      page2?: { paymasterTrackRecord?: { totalInvoicesPaid?: number } };
    };
    expect(draft.page2?.paymasterTrackRecord?.totalInvoicesPaid).toBe(18);

    const listingA = await prisma.noteListing.findUniqueOrThrow({ where: { note_id: NOTE_A_ID } });
    expect(listingA.closes_at).toBeTruthy();

    const mismatch = await prisma.paymasterMismatch.findUniqueOrThrow({
      where: { id: "seed_pmas_mismatch_delta" },
    });
    expect(mismatch.paymaster_id).toBe(first.paymaster3Id);
    expect(mismatch.status).toBe("PENDING");
    expect(mismatch.submitted_country).toBe("SG");
    expect(mismatch.existing_country).toBe("MY");
    expect(mismatch.submitted_entity_type).not.toBe(mismatch.existing_entity_type);
    const deltaDuplicates = await prisma.paymaster.count({
      where: { registration_number: PMAS_PAYMASTER_3_SSM },
    });
    expect(deltaDuplicates).toBe(1);

    const listed = await prisma.note.findUniqueOrThrow({ where: { id: NOTE_L_ID } });
    expect(listed.note_reference).toBeDefined();
    expect(listed.status).toBe("PUBLISHED");
  }, 120_000);
});
