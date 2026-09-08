import { test, expect, type Page } from "@playwright/test";
import type { ExternalSigningSessionDto } from "@cashsouk/types";

function envelopeSession(input: {
  assignmentStatuses: Array<{ documentId: string; name: string; status: "PENDING" | "SIGNED" }>;
  packageClosed?: boolean;
}): ExternalSigningSessionDto {
  return {
    envelope: {
      id: "env-1",
      application_id: "app-1",
      contract_id: "c1",
      invoice_id: null,
      title: "Facility signing package",
      status: input.packageClosed ? "COMPLETED" : "SENT",
      expires_at: null,
      sent_at: "2026-09-01T00:00:00.000Z",
      completed_at: null,
      documents: input.assignmentStatuses.map((item, order) => ({
        id: item.documentId,
        name: item.name,
        description: null,
        source: "TEMPLATE",
        template_ref: item.documentId === "doc-fa" ? "facility_agreement" : "guarantor_agreement",
        order,
        required: true,
        status: item.status === "SIGNED" ? "COMPLETED" : "PENDING",
        has_signed_pdf: false,
      })),
      recipients: [
        {
          id: "r1",
          role_key: "issuer_director",
          role_label: "Director",
          name: "Ali Bin Abu",
          email: "ali@example.com",
          routing_order: 0,
          status: "SENT",
          kyc_status: "VERIFIED",
          completed_at: null,
          viewed_at: null,
        },
      ],
      assignments: input.assignmentStatuses.map((item, index) => ({
        id: `a${index + 1}`,
        document_id: item.documentId,
        recipient_id: "r1",
        required: true,
        action: "SIGN",
        status: item.status,
        signed_at: item.status === "SIGNED" ? "2026-09-01T01:00:00.000Z" : null,
      })),
    },
    recipient_id: "r1",
    access_verified: true,
    kyc_required: false,
    kyc_status: "VERIFIED",
    package_closed: Boolean(input.packageClosed),
  };
}

function jsonOk(data: ExternalSigningSessionDto) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data, correlationId: "e2e" }),
  };
}

async function seedReturnSession(page: Page, input: { documentId: string; documentName: string; token?: string }) {
  await page.addInitScript(
    ({ documentId, documentName, token }) => {
      sessionStorage.setItem(
        "signing:pendingConfirm:rs-e2e",
        JSON.stringify({ documentId, documentName })
      );
      if (token) {
        sessionStorage.setItem("signing:tokenForReturn:rs-e2e", token);
      }
    },
    input
  );
}

test.describe("External signing page", () => {
  test("shows not available for invalid token", async ({ page }) => {
    await page.route("**/v1/signing/external/**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: { code: "SIGNING_LINK_NOT_FOUND", message: "Signing link not found." },
            correlationId: "test",
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/signing/external/invalid-token-value");

    await expect(page.getByText(/signing link is not available/i)).toBeVisible();
  });

  test("opens the requested document when one recipient has several unsigned", async ({ page }) => {
    const session = envelopeSession({
      assignmentStatuses: [
        { documentId: "doc-doa", name: "Deed of Assignment", status: "PENDING" },
        { documentId: "doc-fa", name: "Facility Agreement", status: "PENDING" },
      ],
    });
    await page.route("**/v1/signing/external/**", async (route) => {
      await route.fulfill(jsonOk(session));
    });

    await page.goto("/signing/external/ext-token?document=doc-fa");

    await expect(page.getByText("Facility Agreement")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign/i })).toBeVisible();
  });
});

test.describe("Signing return confirmation", () => {
  test("shows you've signed after provider confirmation", async ({ page }) => {
    const signed = envelopeSession({
      assignmentStatuses: [
        { documentId: "doc-fa", name: "Facility Agreement", status: "SIGNED" },
      ],
    });
    await seedReturnSession(page, {
      documentId: "doc-fa",
      documentName: "Facility Agreement",
    });
    await page.route("**/v1/signing/return/rs-e2e/confirm", async (route) => {
      await route.fulfill(jsonOk(signed));
    });

    await page.goto("/signing/return?rs=rs-e2e");

    await expect(page.getByText(/you've signed/i)).toBeVisible();
    await expect(page.getByText(/Facility Agreement has been signed/i)).toBeVisible();
  });

  test("waits when the provider has not confirmed yet", async ({ page }) => {
    const pending = envelopeSession({
      assignmentStatuses: [
        { documentId: "doc-fa", name: "Facility Agreement", status: "PENDING" },
      ],
    });
    await seedReturnSession(page, {
      documentId: "doc-fa",
      documentName: "Facility Agreement",
    });
    await page.route("**/v1/signing/return/rs-e2e/confirm", async (route) => {
      await route.fulfill(jsonOk(pending));
    });

    await page.goto("/signing/return?rs=rs-e2e");

    await expect(page.getByText(/confirming your signature/i)).toBeVisible();
    await expect(page.getByText(/Waiting for SigningCloud to confirm Facility Agreement/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /check again/i })).toBeVisible();
  });

  test("continues to the next document after one signature is confirmed", async ({ page }) => {
    const nextDocument = envelopeSession({
      assignmentStatuses: [
        { documentId: "doc-fa", name: "Facility Agreement", status: "SIGNED" },
        { documentId: "doc-jsg", name: "Joint and Several Guarantee", status: "PENDING" },
      ],
    });
    await seedReturnSession(page, {
      documentId: "doc-fa",
      documentName: "Facility Agreement",
      token: "ext-token",
    });
    await page.route("**/v1/signing/return/rs-e2e/confirm", async (route) => {
      await route.fulfill(jsonOk(nextDocument));
    });
    await page.route("**/v1/signing/external/ext-token/**", async (route) => {
      await route.fulfill(jsonOk(nextDocument));
    });
    await page.route("**/v1/signing/external/ext-token", async (route) => {
      await route.fulfill(jsonOk(nextDocument));
    });

    await page.goto("/signing/return?rs=rs-e2e");

    await expect(page).toHaveURL(/\/signing\/external\/ext-token/);
    await expect(page.getByText(/Joint and Several Guarantee/i)).toBeVisible();
  });
});
