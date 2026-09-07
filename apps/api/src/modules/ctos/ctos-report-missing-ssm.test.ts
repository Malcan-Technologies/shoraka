jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: {
      findUnique: jest.fn(),
    },
    investorOrganization: {
      findUnique: jest.fn(),
    },
    regTankOnboarding: {
      findFirst: jest.fn(),
    },
    ctosReport: {
      create: jest.fn(),
    },
  },
}));

jest.mock("./config", () => ({
  getCtosConfig: jest.fn(),
}));
jest.mock("./client", () => ({
  callCtosSoap: jest.fn(),
}));
jest.mock("./parser", () => ({
  parseCtosReportXml: jest.fn(),
}));
jest.mock("./render-html", () => ({
  renderCtosReportHtml: jest.fn(),
}));
jest.mock("../organization/service", () => ({
  OrganizationService: jest.fn().mockImplementation(() => ({
    getIssuerPartyListExtras: jest.fn(),
  })),
}));
jest.mock("../notification/director-shareholder-notifications", () => ({
  runIssuerDirectorShareholderNotificationsAfterOrgCtosReportInsert: jest.fn(),
  runInvestorDirectorShareholderNotificationsAfterOrgCtosReportInsert: jest.fn(),
  shouldNotifyDirectorShareholderAfterAdminOrgCtosInsert: jest.fn(),
}));
jest.mock("../admin/build-people-list", () => ({
  buildAdminPeopleList: jest.fn(() => []),
}));
jest.mock("../applications/logs/service", () => ({
  logApplicationActivity: jest.fn(),
}));
jest.mock("../organization-profile/service", () => ({
  observeExternalCtosParties: jest.fn(),
}));

import { OrganizationType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getCtosConfig } from "./config";
import { callCtosSoap } from "./client";
import { fetchAndInsertCtosReport } from "./ctos-report-service";
import {
  CTOS_AUTH_ERROR,
  CTOS_MISSING_SSM_MESSAGE,
  CTOS_MISSING_SUBJECT_IDENTIFIER,
  CTOS_PARSE_ERROR,
  CTOS_PROVIDER_ERROR,
  CTOS_TIMEOUT,
} from "./ctos-errors";

describe("fetchAndInsertCtosReport missing SSM", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCtosConfig as jest.Mock).mockReturnValue({
      companyCode: "c",
      accountNo: "a",
      userId: "u",
    });
  });

  it("returns CTOS_MISSING_SUBJECT_IDENTIFIER instead of calling SOAP", async () => {
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
      id: "org-1",
      type: OrganizationType.COMPANY,
      name: "Acme",
      registration_number: null,
      corporate_onboarding_data: { basicInfo: {} },
      document_number: null,
    });
    (prisma.regTankOnboarding.findFirst as jest.Mock).mockResolvedValue({ id: "rt-1" });

    await expect(fetchAndInsertCtosReport("org-1")).rejects.toMatchObject({
      statusCode: 400,
      code: CTOS_MISSING_SUBJECT_IDENTIFIER,
    });
    await expect(fetchAndInsertCtosReport("org-1")).rejects.toMatchObject({
      message: expect.stringContaining(CTOS_MISSING_SSM_MESSAGE),
    });
    expect(callCtosSoap).not.toHaveBeenCalled();
    expect(prisma.ctosReport.create).not.toHaveBeenCalled();
  });

  it("treats blank SSM the same as missing", async () => {
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
      id: "org-1",
      type: OrganizationType.COMPANY,
      name: "Acme",
      registration_number: "   ",
      corporate_onboarding_data: null,
      document_number: null,
    });
    (prisma.regTankOnboarding.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(fetchAndInsertCtosReport("org-1")).rejects.toMatchObject({
      code: CTOS_MISSING_SUBJECT_IDENTIFIER,
    });
    expect(callCtosSoap).not.toHaveBeenCalled();
  });
});

describe("fetchAndInsertCtosReport provider errors", () => {
  const orgWithSsm = {
    id: "org-1",
    type: OrganizationType.COMPANY,
    name: "Acme",
    registration_number: "202201012345",
    corporate_onboarding_data: null,
    document_number: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getCtosConfig as jest.Mock).mockReturnValue({
      companyCode: "c",
      accountNo: "a",
      userId: "u",
    });
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue(orgWithSsm);
  });

  it("maps timeout, auth, SOAP, and parse failures without inserting a report", async () => {
    (callCtosSoap as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("request timed out"), { name: "TimeoutError" })
    );
    await expect(fetchAndInsertCtosReport("org-1")).rejects.toMatchObject({ code: CTOS_TIMEOUT });

    (callCtosSoap as jest.Mock).mockRejectedValueOnce(new Error("CTOS authentication failed"));
    await expect(fetchAndInsertCtosReport("org-1")).rejects.toMatchObject({ code: CTOS_AUTH_ERROR });

    (callCtosSoap as jest.Mock).mockRejectedValueOnce(new Error("CTOS SOAP request failed"));
    await expect(fetchAndInsertCtosReport("org-1")).rejects.toMatchObject({ code: CTOS_PROVIDER_ERROR });

    (callCtosSoap as jest.Mock).mockResolvedValueOnce("<xml/>");
    const { parseCtosReportXml } = jest.requireMock("./parser") as { parseCtosReportXml: jest.Mock };
    parseCtosReportXml.mockRejectedValueOnce(new Error("failed to parse"));
    await expect(fetchAndInsertCtosReport("org-1")).rejects.toMatchObject({ code: CTOS_PARSE_ERROR });

    expect(prisma.ctosReport.create).not.toHaveBeenCalled();
  });
});
