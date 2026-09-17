import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import { AppError } from "../../lib/http/error-handler";

import { createOrganizationRouter } from "./controller";

const mockAuthState = {
  user: { user_id: "owner-1" },
};

jest.mock("../../lib/auth/middleware", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = mockAuthState.user;
    next();
  },
}));

const mockGetOrganization = jest.fn();
const mockGetInvestorPartyListExtras = jest.fn();

jest.mock("./service", () => ({
  OrganizationService: jest.fn().mockImplementation(() => ({
    getOrganization: (...args: unknown[]) => mockGetOrganization(...args),
    getInvestorPartyListExtras: (...args: unknown[]) => mockGetInvestorPartyListExtras(...args),
  })),
}));

jest.mock("../organization-profile/service", () => ({
  computeOrgProfileCompleteness: jest.fn().mockResolvedValue({
    complete: true,
    percent: 100,
    missing: [],
  }),
}));

describe("GET /v1/organizations/investor/:id DOB serialization", () => {
  let app: express.Application;
  const organizationId = "cinvestor0001";

  function mockOrg(storedDob: Date) {
    mockGetOrganization.mockResolvedValue({
      id: organizationId,
      owner_user_id: "owner-1",
      members: [],
      type: "PERSONAL",
      name: "Test Investor",
      display_reference: null,
      registration_number: null,
      onboarding_status: "COMPLETED",
      onboarded_at: null,
      created_at: new Date(),
      phone_number: null,
      address: null,
      bank_account_details: null,
      deposit_received: true,
      ssm_approved: false,
      is_sophisticated_investor: null,
      ssm_checked: false,
      tnc_accepted: false,
      aml_approved: false,
      corporate_entities: null,
      director_kyc_status: null,
      director_aml_status: null,
      regtank_onboarding: null,
      date_of_birth: storedDob,
      gender: "MALE",
      nationality: "Malaysia",
      country: "MALAYSIA",
      id_issuing_country: null,
      document_type: null,
      document_number: null,
      residential_address: null,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/v1/organizations", createOrganizationRouter());
    app.use((err: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    });
    mockGetInvestorPartyListExtras.mockResolvedValue(null);
  });

  async function expectCivilDob() {
    const res = await request(app).get(`/v1/organizations/investor/${organizationId}`);
    if (res.status !== 200) {
      throw new Error(`Unexpected ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.dateOfBirth).toBe("1989-11-14");
    expect(String(res.body?.data?.dateOfBirth ?? "")).not.toMatch(/T|Z/);
    expect(String(res.body?.data?.dateOfBirth ?? "")).not.toMatch(/1989-11-13/);
  }

  it("returns YYYY-MM-DD for a Prisma UTC-midnight DateTime", async () => {
    mockOrg(new Date("1989-11-14T00:00:00.000Z"));
    await expectCivilDob();
  });

  it("returns the Malaysia civil day when MYT midnight was stored as the previous UTC evening", async () => {
    mockOrg(new Date("1989-11-13T16:00:00.000Z"));
    await expectCivilDob();
  });
});

