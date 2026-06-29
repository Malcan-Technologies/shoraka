import { NoteService } from "./service";

describe("test top-up guard", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("blocks test top-up in production at the service boundary", async () => {
    process.env.NODE_ENV = "production";

    await expect(
      new NoteService().testTopUpInvestorBalance(
        { userId: "investor-user", portal: "INVESTOR" },
        { investorOrganizationId: "org-id", amount: 100 }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });
});
