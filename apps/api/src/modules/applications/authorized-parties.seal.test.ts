jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganizationCompanySeal: {
      findFirst: jest.fn(),
    },
  },
}));

import { ISSUER_COMPANY_SEAL_REQUIRED_MESSAGE, ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import {
  assertIssuerSealReadyForPackage,
  assertIssuerSealRequirements,
} from "./authorized-parties";

const ORG = "org_1";
const ALI = {
  name: "Ali Bin Abu",
  email: "ali@co.my",
  ic_number: "820508105871",
  capacity: "director" as const,
  person_match_key: "820508105871",
};

const partiesWithoutApplier = [
  {
    key: "issuer" as const,
    entity_kind: "ISSUER" as const,
    representatives: [ALI],
  },
];

const partiesWithApplier = [
  {
    key: "issuer" as const,
    entity_kind: "ISSUER" as const,
    representatives: [{ ...ALI, applies_company_seal: true }],
  },
];

const faWorkflow = [
  {
    config: {
      signing_packages: {
        documents: [{ key: "facility_agreement", name: "Facility Agreement" }],
      },
    },
  },
];

const guarantorOnlyWorkflow = [
  {
    config: {
      signing_packages: {
        documents: [{ key: "guarantor_agreement", name: "JSG" }],
      },
    },
  },
];

const findFirst = prisma.issuerOrganizationCompanySeal.findFirst as jest.Mock;

describe("assertIssuerSealRequirements", () => {
  const prev = process.env.SC_ENABLE_SEAL_FIELD;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SC_ENABLE_SEAL_FIELD;
    findFirst.mockResolvedValue({ id: "seal_1" });
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.SC_ENABLE_SEAL_FIELD;
    else process.env.SC_ENABLE_SEAL_FIELD = prev;
  });

  it("does not require an applier or seal when the package has no FA or DOA", async () => {
    await expect(
      assertIssuerSealRequirements(partiesWithoutApplier, ORG, guarantorOnlyWorkflow)
    ).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("requires exactly one issuer seal applier when FA is in the package", async () => {
    try {
      await assertIssuerSealRequirements(partiesWithoutApplier, ORG, faWorkflow);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("AUTHORIZED_PARTIES_INVALID");
      expect((error as AppError).message).toBe(ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE);
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("requires an active organisation seal when FA is in the package", async () => {
    findFirst.mockResolvedValue(null);
    try {
      await assertIssuerSealRequirements(partiesWithApplier, ORG, faWorkflow);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("ISSUER_COMPANY_SEAL_REQUIRED");
      expect((error as AppError).message).toBe(ISSUER_COMPANY_SEAL_REQUIRED_MESSAGE);
    }
  });

  it("passes when FA is in the package, one applier is set, and a seal exists", async () => {
    await expect(
      assertIssuerSealRequirements(partiesWithApplier, ORG, faWorkflow)
    ).resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith({
      where: { issuer_organization_id: ORG, superseded_at: null },
      select: { id: true },
    });
  });

  it("assertIssuerSealReadyForPackage uses document keys without a workflow", async () => {
    await expect(
      assertIssuerSealReadyForPackage(ORG, partiesWithApplier, ["facility_agreement"])
    ).resolves.toBeUndefined();
    await expect(
      assertIssuerSealReadyForPackage(ORG, partiesWithoutApplier, ["guarantor_agreement"])
    ).resolves.toBeUndefined();
  });

  it("skips the seal applier and image checks when SC_ENABLE_SEAL_FIELD=false", async () => {
    process.env.SC_ENABLE_SEAL_FIELD = "false";
    await expect(
      assertIssuerSealRequirements(partiesWithoutApplier, ORG, faWorkflow)
    ).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
