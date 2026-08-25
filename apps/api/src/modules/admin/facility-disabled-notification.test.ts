/**
 * CONTRACT_FACILITY_DISABLED notification: fires once a facility disable
 * successfully persists, to the issuer org owner/admins.
 */
jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/service", () => ({
  RegTankService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../applications/logs/service", () => ({
  logApplicationActivity: jest.fn(),
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

import { AdminService } from "./service";
import { prisma } from "../../lib/prisma";
import { logApplicationActivity } from "../applications/logs/service";

describe("AdminService.setContractFacilityEnabled — facility_disabled notification", () => {
  const service = new AdminService();

  beforeEach(() => {
    jest.clearAllMocks();
    (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification = jest
      .fn()
      .mockResolvedValue(undefined);
    (service as unknown as { getContractDetail: jest.Mock }).getContractDetail = jest
      .fn()
      .mockResolvedValue({ id: "contract-1" });
  });

  it("sends facility_disabled after a successful disable", async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue({
      originatingApplicationId: "app-1",
      unchanged: false,
      facilityDisabledAt: "2026-08-25T00:00:00.000Z",
    });

    await service.setContractFacilityEnabled("contract-1", false, "paused", "admin-1");

    expect(logApplicationActivity).toHaveBeenCalled();
    const notify = (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification;
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      "app-1",
      "facility_disabled",
      { applicationId: "app-1" },
      "facility-disabled:contract-1:2026-08-25T00:00:00.000Z"
    );
  });

  it("does not send on enable or when the facility is already disabled", async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue({
      originatingApplicationId: "app-1",
      unchanged: false,
      facilityDisabledAt: null,
    });
    await service.setContractFacilityEnabled("contract-1", true, undefined, "admin-1");
    expect(
      (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification
    ).not.toHaveBeenCalled();

    (prisma.$transaction as jest.Mock).mockResolvedValue({
      originatingApplicationId: "app-1",
      unchanged: true,
      facilityDisabledAt: null,
    });
    await service.setContractFacilityEnabled("contract-1", false, "paused", "admin-1");
    expect(
      (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification
    ).not.toHaveBeenCalled();
  });

  it("does not send when the disable transaction fails", async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("db fail"));

    await expect(
      service.setContractFacilityEnabled("contract-1", false, "paused", "admin-1")
    ).rejects.toThrow("db fail");
    expect(
      (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification
    ).not.toHaveBeenCalled();
  });
});
