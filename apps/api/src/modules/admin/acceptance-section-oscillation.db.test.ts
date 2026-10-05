/**
 * SECTION: Acceptance section stays APPROVED once the offer is accepted (local DB)
 * WHY: Approving a supporting document used to re-derive the Acceptance row from its document
 * items, downgrading it from APPROVED to PENDING (and logging SECTION_REVIEWED_PENDING) even though
 * the offer was already accepted; the next detail load then approved it again, so the row
 * oscillated. Once the offer is accepted the row is owned by the offer, and the detail load that
 * repairs a stale row records a system event.
 *
 * Each run seeds its own issuer org, accepted contract and application under a unique
 * `dbtest_acc_osc_` prefix and deletes exactly those rows in afterAll.
 */

import { randomBytes } from "node:crypto";
import {
  ApplicationStatus,
  ContractStatus,
  OrganizationType,
  Prisma,
  ReviewStepStatus,
  UserRole,
} from "@prisma/client";
import { workflowShowsAcceptanceReviewSection } from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { AdminService } from "./service";

jest.setTimeout(60_000);

const SUBMITTED_AT = new Date("2026-09-25T00:00:00.000Z");
const ACCEPTED_AT = "2026-09-28T00:00:00.000Z";

const SUPPORTING_DOCUMENT_TITLE = "Latest Management Account";
/** Key built the way AdminService.collectDocumentKeys builds it for the `categories` shape. */
const SUPPORTING_DOCUMENT_KEY = "supporting_documents:financial_docs:0:Latest_Management_Account";

type Graph = {
  applicationId: string;
  organizationId: string;
  contractId: string;
};

type AcceptanceProduct = { id: string; version: number };

const graphs: Graph[] = [];
let adminUserId: string;
let acceptanceProduct: AcceptanceProduct;
const adminService = new AdminService();

async function seedGraph(label: string, acceptanceStatus: ReviewStepStatus): Promise<Graph> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Acceptance section oscillation DB test is blocked in production");
  }
  const uniqueSuffix = randomBytes(6).toString("hex");
  const prefix = `dbtest_acc_osc_${label}_${uniqueSuffix}`;
  const graph: Graph = {
    applicationId: `${prefix}_app`,
    organizationId: `${prefix}_org`,
    contractId: `${prefix}_contract`,
  };
  graphs.push(graph);
  await prisma.issuerOrganization.create({
    data: {
      id: graph.organizationId,
      owner_user_id: adminUserId,
      type: OrganizationType.COMPANY,
      name: "DB Test Acceptance Oscillation Sdn Bhd",
      registration_number: uniqueSuffix,
      country: "Malaysia",
      onboarding_status: "COMPLETED",
      onboarded_at: SUBMITTED_AT,
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
    },
  });
  // Offer accepted and signed: the shape markOfferAcceptanceCompleted leaves behind.
  await prisma.contract.create({
    data: {
      id: graph.contractId,
      issuer_organization_id: graph.organizationId,
      status: ContractStatus.APPROVED,
      offer_details: {
        offer_acceptance: { status: "COMPLETED", submitted_at: ACCEPTED_AT },
      },
    },
  });
  await prisma.application.create({
    data: {
      id: graph.applicationId,
      issuer_organization_id: graph.organizationId,
      contract_id: graph.contractId,
      product_version: acceptanceProduct.version,
      financing_type: { product_id: acceptanceProduct.id },
      financing_structure: { structure_type: "new_contract", existing_contract_id: null },
      status: ApplicationStatus.UNDER_REVIEW,
      last_completed_step: 9,
      submitted_at: SUBMITTED_AT,
      supporting_documents: {
        categories: [
          {
            name: "Financial Docs",
            documents: [
              {
                title: SUPPORTING_DOCUMENT_TITLE,
                file: {
                  s3_key: `applications/${graph.applicationId}/dbtest.pdf`,
                  file_name: "dbtest.pdf",
                  file_size: 1024,
                  uploaded_at: SUBMITTED_AT.toISOString(),
                },
                workflow_document_index: 0,
              },
            ],
          },
        ],
      } as Prisma.InputJsonValue,
      acceptance_documents: { documents: [{ name: "Board Resolution" }] },
    },
  });
  // Acceptance row only: no document item rows, as when the offer was accepted by signing.
  await prisma.applicationReview.create({
    data: {
      application_id: graph.applicationId,
      section: "acceptance_documents",
      status: acceptanceStatus,
      reviewed_at: acceptanceStatus === ReviewStepStatus.APPROVED ? SUBMITTED_AT : null,
    },
  });
  return graph;
}

async function cleanupGraph(graph: Graph): Promise<void> {
  // Application logs have no FK to the application; the other application rows cascade, but are
  // deleted explicitly so a schema change cannot leave them behind.
  await prisma.applicationLog.deleteMany({ where: { application_id: graph.applicationId } });
  await prisma.applicationReviewRemark.deleteMany({
    where: { application_id: graph.applicationId },
  });
  await prisma.applicationReviewEvent.deleteMany({
    where: { application_id: graph.applicationId },
  });
  await prisma.applicationReviewItem.deleteMany({ where: { application_id: graph.applicationId } });
  await prisma.applicationReview.deleteMany({ where: { application_id: graph.applicationId } });
  await prisma.application.deleteMany({ where: { id: graph.applicationId } });
  await prisma.contract.deleteMany({ where: { id: graph.contractId } });
  await prisma.issuerOrganization.deleteMany({ where: { id: graph.organizationId } });
}

function readAcceptanceRow(graph: Graph) {
  return prisma.applicationReview.findUnique({
    where: {
      application_id_section: {
        application_id: graph.applicationId,
        section: "acceptance_documents",
      },
    },
    select: { status: true },
  });
}

async function findAcceptanceProduct(): Promise<AcceptanceProduct> {
  const products = await prisma.product.findMany({
    where: { status: { not: "DELETED" } },
    orderBy: { created_at: "desc" },
    take: 50,
    select: { id: true, version: true, workflow: true },
  });
  const product = products.find((row) => workflowShowsAcceptanceReviewSection(row.workflow));
  if (!product) {
    throw new Error(
      "No product whose workflow shows the Acceptance tab. Run `pnpm --filter @cashsouk/api prisma:seed` first."
    );
  }
  // financing_type.product_id = this row's id and product_version = its own version, so
  // ProductRepository.findByBaseAndVersion resolves this exact row.
  return { id: product.id, version: product.version };
}

beforeAll(async () => {
  const admin = await prisma.user.findFirst({
    where: { roles: { has: UserRole.ADMIN } },
    select: { user_id: true },
  });
  if (!admin) {
    throw new Error("No ADMIN user found. Run `pnpm --filter @cashsouk/api prisma:seed` first.");
  }
  adminUserId = admin.user_id;
  acceptanceProduct = await findAcceptanceProduct();
});

afterAll(async () => {
  for (const graph of graphs) await cleanupGraph(graph);
});

describe("Acceptance section after the offer is accepted (local DB)", () => {
  it("approving a supporting document after the offer is accepted does not reset the Acceptance section", async () => {
    const graph = await seedGraph("approve_doc", ReviewStepStatus.APPROVED);

    await adminService.approveReviewItem(
      graph.applicationId,
      "document",
      SUPPORTING_DOCUMENT_KEY,
      adminUserId
    );

    expect((await readAcceptanceRow(graph))?.status).toBe(ReviewStepStatus.APPROVED);
    await expect(
      prisma.applicationLog.count({
        where: { application_id: graph.applicationId, event_type: "SECTION_REVIEWED_PENDING" },
      })
    ).resolves.toBe(0);
    const item = await prisma.applicationReviewItem.findUnique({
      where: {
        application_id_item_type_item_id: {
          application_id: graph.applicationId,
          item_type: "document",
          item_id: SUPPORTING_DOCUMENT_KEY,
        },
      },
      select: { status: true },
    });
    expect(item?.status).toBe(ReviewStepStatus.APPROVED);
  });

  it("detail load approves a stale Acceptance row with a system event", async () => {
    const graph = await seedGraph("detail_load", ReviewStepStatus.PENDING);

    await adminService.getApplicationDetail(graph.applicationId);

    expect((await readAcceptanceRow(graph))?.status).toBe(ReviewStepStatus.APPROVED);
    const approvedLogs = await prisma.applicationLog.findMany({
      where: { application_id: graph.applicationId, event_type: "SECTION_REVIEWED_APPROVED" },
      select: { user_id: true, application_id: true },
    });
    expect(approvedLogs).toEqual([{ user_id: null, application_id: graph.applicationId }]);
  });
});
