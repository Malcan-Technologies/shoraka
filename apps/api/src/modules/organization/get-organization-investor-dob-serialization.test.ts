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

    // Simulate a stored DOB representing the calendar date 1989-11-14.
    // Using the local Date constructor avoids any timezone shifting in the test itself.
    const storedDob = new Date(1989, 10, 14);

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
      director_kyc_status: null,
      regtank_onboarding: null,
      date_of_birth: storedDob,
      gender: "MALE",
      nationality: "Malaysia",
      country: "MALAYSIA",
      id_issuing_country: null,
      document_type: null,
      document_number: null,
      // editable fields below are used only if present; keep them null.
      residential_address: null,
    });

    mockGetInvestorPartyListExtras.mockResolvedValue(null);
  });

  it("returns dateOfBirth as date-only YYYY-MM-DD without timezone shifting", async () => {
    const res = await request(app).get(`/v1/organizations/investor/${organizationId}`);
    if (res.status !== 200) {
      throw new Error(`Unexpected ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.dateOfBirth).toBe("1989-11-14");

    // Guard against accidental ISO datetime responses like "...T...Z".
    expect(String(res.body?.data?.dateOfBirth ?? "")).not.toMatch(/T|Z/);
    expect(String(res.body?.data?.dateOfBirth ?? "")).not.toMatch(/1989-11-13/);
  });
});

