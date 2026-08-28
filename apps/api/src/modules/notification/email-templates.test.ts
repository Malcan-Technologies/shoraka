import { Notification, User } from "@prisma/client";
import { buildNotificationEmail } from "./email-templates";
import { getNotificationContent, NotificationTypeIds } from "./registry";
import { notificationLogTargetToPortal } from "./delivery-log";

const INVESTOR = "https://investor.test";
const ISSUER = "https://issuer.test";
const ADMIN = "https://admin.test";
const LANDING = "https://www.cashsouk.test";

const envKeys = ["INVESTOR_URL", "ISSUER_URL", "ADMIN_URL", "FRONTEND_URL"] as const;
const originalEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

function fakeUser(): User {
  return { first_name: "Ada", email: "ada@example.com" } as User;
}

function fakeNotification(init: {
  link_path?: string | null;
  metadata?: unknown;
  title?: string;
  message?: string;
}): Notification {
  return {
    title: init.title ?? "Title",
    message: init.message ?? "Message",
    link_path: init.link_path ?? null,
    metadata: init.metadata ?? {},
  } as Notification;
}

function emailUrls(init: { link_path?: string | null; metadata?: unknown }) {
  const email = buildNotificationEmail(fakeNotification(init), fakeUser());
  return { html: email.html, text: email.text };
}

describe("buildNotificationEmail portal URLs", () => {
  beforeEach(() => {
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
    }
    process.env.INVESTOR_URL = INVESTOR;
    process.env.ISSUER_URL = ISSUER;
    process.env.ADMIN_URL = ADMIN;
    process.env.FRONTEND_URL = LANDING;
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe("PASSWORD_CHANGED", () => {
    it("uses Investor CTA and account links when portal metadata is investor", () => {
      const { html, text } = emailUrls({
        link_path: "/account",
        metadata: { portal: "investor" },
      });
      expect(html).toContain(`${INVESTOR}/account`);
      expect(text).toContain(`${INVESTOR}/account`);
      expect(html).not.toContain(LANDING);
      expect(html).not.toContain(ISSUER);
    });

    it("uses Issuer CTA and account links when portal metadata is issuer", () => {
      const { html, text } = emailUrls({
        link_path: "/account",
        metadata: { portal: "issuer" },
      });
      expect(html).toContain(`${ISSUER}/account`);
      expect(text).toContain(`${ISSUER}/account`);
      expect(html).not.toContain(INVESTOR);
    });

    it("uses Admin CTA and account links when portal metadata is admin", () => {
      const { html, text } = emailUrls({
        link_path: "/account",
        metadata: { portal: "admin" },
      });
      expect(html).toContain(`${ADMIN}/account`);
      expect(text).toContain(`${ADMIN}/account`);
      expect(html).not.toContain(INVESTOR);
    });

    it("uses landing FRONTEND_URL when portal metadata is missing, not Investor", () => {
      const { html, text } = emailUrls({
        link_path: "/account",
        metadata: { changedAt: "2026-08-27T00:00:00.000Z" },
      });
      expect(html).toContain(`href="${LANDING}"`);
      expect(text).toContain(`View details: ${LANDING}`);
      expect(text).toContain(`Manage preferences: ${LANDING}`);
      expect(html).not.toContain(INVESTOR);
      expect(html).not.toContain(`${LANDING}/account`);
    });
  });

  describe("SYSTEM_ANNOUNCEMENT", () => {
    it("uses Investor URLs when bulk target INVESTORS sets portal=investor", () => {
      expect(notificationLogTargetToPortal("INVESTORS")).toBe("investor");
      const { html, text } = emailUrls({
        link_path: "/",
        metadata: { portal: "investor" },
      });
      expect(html).toContain(`${INVESTOR}/`);
      expect(text).toContain(`${INVESTOR}/account`);
    });

    it("uses Issuer URLs when bulk target ISSUERS sets portal=issuer", () => {
      expect(notificationLogTargetToPortal("ISSUERS")).toBe("issuer");
      const { html, text } = emailUrls({
        link_path: "/",
        metadata: { portal: "issuer" },
      });
      expect(html).toContain(`${ISSUER}/`);
      expect(text).toContain(`${ISSUER}/account`);
    });

    it("uses landing for ALL_USERS with no portal", () => {
      expect(notificationLogTargetToPortal("ALL_USERS")).toBeUndefined();
      const { html, text } = emailUrls({ link_path: "/", metadata: {} });
      expect(html).toContain(`href="${LANDING}"`);
      expect(text).toContain(`Manage preferences: ${LANDING}`);
      expect(html).not.toContain(INVESTOR);
    });

    it("uses landing for SPECIFIC_USERS with no portal", () => {
      expect(notificationLogTargetToPortal("SPECIFIC_USERS")).toBeUndefined();
      const { html } = emailUrls({ link_path: "/", metadata: {} });
      expect(html).toContain(`href="${LANDING}"`);
      expect(html).not.toContain(INVESTOR);
    });

    it("uses landing for GROUP with no portal", () => {
      expect(notificationLogTargetToPortal("GROUP")).toBeUndefined();
      const { html } = emailUrls({ link_path: "/", metadata: {} });
      expect(html).toContain(`href="${LANDING}"`);
      expect(html).not.toContain(INVESTOR);
    });
  });

  describe("NEW_PRODUCT_ALERT", () => {
    it("sets an explicit investor portal on the template", () => {
      const content = getNotificationContent(NotificationTypeIds.NEW_PRODUCT_ALERT, {
        productName: "Note A",
        productId: "prod-1",
      });
      expect(content.portal).toBe("investor");
      expect(content.linkPath).toBe("/investments/prod-1");
    });

    it("builds Investor product and account URLs from that portal", () => {
      const content = getNotificationContent(NotificationTypeIds.NEW_PRODUCT_ALERT, {
        productName: "Note A",
        productId: "prod-1",
      });
      const { html, text } = emailUrls({
        link_path: content.linkPath,
        metadata: { portal: content.portal },
      });
      expect(html).toContain(`${INVESTOR}/investments/prod-1`);
      expect(text).toContain(`${INVESTOR}/account`);
      expect(html).not.toContain(LANDING);
    });
  });

  describe("general", () => {
    it("treats invalid metadata.portal as landing, not Investor", () => {
      const { html, text } = emailUrls({
        link_path: "/notes/n1",
        metadata: { portal: "landing" },
      });
      expect(html).toContain(`href="${LANDING}"`);
      expect(text).toContain(`Manage preferences: ${LANDING}`);
      expect(html).not.toContain(INVESTOR);
      expect(html).not.toContain(`${LANDING}/notes/n1`);
    });

    it("does not default missing portal to Investor", () => {
      const { html, text } = emailUrls({ link_path: "/transactions", metadata: null });
      expect(html).not.toMatch(/investor/i);
      expect(text).not.toContain(INVESTOR);
      expect(html).toContain(LANDING);
    });

    it("keeps explicit issuer, investor, and admin notification URLs unchanged", () => {
      const issuer = getNotificationContent(NotificationTypeIds.APPLICATION_REJECTED, {
        applicationId: "app-1",
      });
      expect(issuer.portal).toBe("issuer");
      const issuerEmail = emailUrls({
        link_path: issuer.linkPath,
        metadata: { portal: issuer.portal },
      });
      expect(issuerEmail.html).toContain(`${ISSUER}/applications`);
      expect(issuerEmail.text).toContain(`${ISSUER}/account`);

      const investor = getNotificationContent(NotificationTypeIds.DEPOSIT_SUCCESSFUL, {
        amount: 100,
      });
      expect(investor.portal).toBe("investor");
      const investorEmail = emailUrls({
        link_path: investor.linkPath,
        metadata: { portal: investor.portal },
      });
      expect(investorEmail.html).toContain(`${INVESTOR}/transactions`);
      expect(investorEmail.text).toContain(`${INVESTOR}/account`);

      const adminEmail = emailUrls({
        link_path: "/account",
        metadata: { portal: "admin" },
      });
      expect(adminEmail.html).toContain(`${ADMIN}/account`);
      expect(adminEmail.text).toContain(`${ADMIN}/account`);
    });

    it("does not hardcode a portal on PASSWORD_CHANGED or SYSTEM_ANNOUNCEMENT templates", () => {
      const password = getNotificationContent(NotificationTypeIds.PASSWORD_CHANGED, {
        changedAt: new Date("2026-08-27T00:00:00.000Z"),
      });
      expect(password.portal).toBeUndefined();

      const announcement = getNotificationContent(NotificationTypeIds.SYSTEM_ANNOUNCEMENT, {
        title: "Maintenance",
        message: "Tonight",
      });
      expect(announcement.portal).toBeUndefined();
    });
  });
});
