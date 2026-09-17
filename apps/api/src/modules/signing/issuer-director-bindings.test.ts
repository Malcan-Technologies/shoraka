/**
 * Send-links issuer_director check must use the same director pool as the
 * authorised-representative dropdown (company-profile people included).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadIssuerDirectorPool } from "../applications/authorized-parties";
import { SigningService } from "./service";
import type { SigningRepository } from "./repository";

jest.mock("../../lib/prisma", () => ({
  prisma: {},
}));

jest.mock("../applications/authorized-parties", () => {
  const actual = jest.requireActual("../applications/authorized-parties") as Record<string, unknown>;
  return {
    ...actual,
    loadIssuerDirectorPool: jest.fn(),
  };
});

const loadPool = loadIssuerDirectorPool as jest.MockedFunction<typeof loadIssuerDirectorPool>;

const TEMPLATE = {
  enabled: true,
  roles: [
    {
      key: "issuer_director",
      label: "Issuer director",
      source_hint: "issuer_director",
      routing_order: 0,
      kyc_required: true,
    },
  ],
  documents: [],
};

const COMPANY_PROFILE_DIRECTOR = {
  matchKey: "user:abc",
  name: "Normal Director",
  email: "sec.practitioner@proton.me",
  icNumber: "000000000000",
};

const BINDING = {
  role_key: "issuer_director",
  name: "Normal Director",
  email: "sec.practitioner@proton.me",
  ic_number: "000000000000",
};

const APPLICATION = {
  issuer_organization_id: "org-1",
  application_guarantors: [],
};

function createService() {
  return new SigningService({} as SigningRepository);
}

function normalizeBindings(service: SigningService) {
  return (
    service as unknown as {
      validateAndNormalizeIssuerBindings: (
        application: typeof APPLICATION,
        template: typeof TEMPLATE,
        bindings: Array<typeof BINDING>
      ) => Promise<Array<typeof BINDING>>;
    }
  ).validateAndNormalizeIssuerBindings(APPLICATION, TEMPLATE, [BINDING]);
}

describe("validateAndNormalizeIssuerBindings director pool", () => {
  beforeEach(() => {
    loadPool.mockReset();
  });

  it("uses loadIssuerDirectorPool instead of a CTOS-only people list", () => {
    const source = readFileSync(join(__dirname, "service.ts"), "utf8");
    expect(source).toContain("loadIssuerDirectorPool");
    expect(source).not.toContain("buildAdminPeopleList");
  });

  it("accepts a company-profile director from the authorised-representative pool", async () => {
    loadPool.mockResolvedValue([COMPANY_PROFILE_DIRECTOR]);

    await expect(normalizeBindings(createService())).resolves.toEqual([
      { ...BINDING, application_guarantor_id: null },
    ]);
    expect(loadPool).toHaveBeenCalledWith("org-1");
  });

  it("rejects an issuer director email that is not in that pool", async () => {
    loadPool.mockResolvedValue([]);

    await expect(normalizeBindings(createService())).rejects.toMatchObject({
      statusCode: 400,
      code: "SIGNING_BINDINGS_INVALID",
      message: 'Recipient for "Issuer director" must be one of the application\'s directors.',
    });
  });
});
