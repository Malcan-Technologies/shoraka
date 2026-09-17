import { test, expect, type Page } from "@playwright/test";
import { PrismaClient, OrganizationType } from "@prisma/client";

const prisma = new PrismaClient();

const API_BASE_URL = "http://localhost:4000";

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "",
  password: process.env.TEST_USER_PASSWORD || "",
};

const LOCK_MESSAGE = "This field is locked because it was verified during onboarding.";
const hasAuthCredentials = Boolean(TEST_USER.email && TEST_USER.password);

async function login(page: Page) {
  await page.goto("/");

  // Wait for redirect to Cognito
  await page.waitForURL(/auth\.cashsouk\.com/);

  // Fill in credentials
  await page.getByRole("textbox").first().fill(TEST_USER.email);
  await page.getByRole("button", { name: /next/i }).click();

  // Wait for password field and fill it
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.getByRole("textbox", { name: /password/i }).fill(TEST_USER.password);
  // Cognito UX differs between deployments; some show "Sign in", others "Continue".
  const signIn = page.getByRole("button", { name: /sign in/i });
  const continueButton = page.getByRole("button", { name: /continue/i });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await continueButton.click();
  }

  // Wait for redirect back to app
  await page.waitForURL(/localhost:3002/, { timeout: 30000 });
}

async function getCurrentUserId(page: Page): Promise<string> {
  const res = await page.context().request.get(`${API_BASE_URL}/v1/auth/me`);
  const json = await res.json();
  expect(json.success).toBeTruthy();
  return json.data.userId;
}

async function seedPersonalInvestorOrg(args: {
  userId: string;
  orgId: string;
  displayReference: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: string; // MALE/FEMALE
  nationality: string;
  identityPrefixSource: "REGTANK" | "USER" | "ADMIN";
  identityNumberSource: "REGTANK" | "USER" | "ADMIN";
  identityNumber: string | null;
}) {
  const fixedNow = new Date("2026-09-17T00:00:00.000Z");

  await prisma.investorOrganization.upsert({
    where: { id: args.orgId },
    create: {
      id: args.orgId,
      owner_user_id: args.userId,
      type: OrganizationType.PERSONAL,
      display_reference: args.displayReference,
      onboarding_status: "COMPLETED",
      onboarded_at: fixedNow,

      is_sophisticated_investor: false,
      sc_investor_category: "RETAIL",
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,

      gender: args.gender,
      nationality: args.nationality,
      date_of_birth: new Date(`${args.dateOfBirth}T00:00:00.000Z`),

      // Identity/document master fields.
      document_type: "DRIVING_LICENSE",
      document_number: args.identityNumber,

      phone_number: "+60123456789",
      address: "1, Example Street, Kuala Lumpur",
      residential_address: {
        line1: "12, Example Street",
        line2: null,
        city: "Kuala Lumpur",
        postalCode: "55100",
        state: "Selangor",
        country: "MY",
      },

      profile_field_sources: {
        dateOfBirth: { source: "USER", updatedAt: fixedNow.toISOString() },
        gender: { source: "USER", updatedAt: fixedNow.toISOString() },
        nationality: { source: "USER", updatedAt: fixedNow.toISOString() },
        identityPrefix: { source: args.identityPrefixSource, updatedAt: fixedNow.toISOString() },
        identityNumber: { source: args.identityNumberSource, updatedAt: fixedNow.toISOString() },
      } as any,
    },
    update: {
      owner_user_id: args.userId,
      display_reference: args.displayReference,
      onboarding_status: "COMPLETED",
      onboarded_at: fixedNow,

      gender: args.gender,
      nationality: args.nationality,
      date_of_birth: new Date(`${args.dateOfBirth}T00:00:00.000Z`),

      document_type: "DRIVING_LICENSE",
      document_number: args.identityNumber,

      residential_address: {
        line1: "12, Example Street",
        line2: null,
        city: "Kuala Lumpur",
        postalCode: "55100",
        state: "Selangor",
        country: "MY",
      },

      profile_field_sources: {
        dateOfBirth: { source: "USER", updatedAt: fixedNow.toISOString() },
        gender: { source: "USER", updatedAt: fixedNow.toISOString() },
        nationality: { source: "USER", updatedAt: fixedNow.toISOString() },
        identityPrefix: { source: args.identityPrefixSource, updatedAt: fixedNow.toISOString() },
        identityNumber: { source: args.identityNumberSource, updatedAt: fixedNow.toISOString() },
      } as any,
    },
  });
}

async function selectOrganizationByDisplayReference(page: Page, displayReference: string) {
  const switcher = page.getByTestId("organization-switcher");
  await switcher.click();

  const item = page.getByRole("menuitem").filter({ hasText: displayReference }).first();
  await expect(item).toBeVisible();
  await item.click();
}

test.describe("Personal Investor profile provenance (UI)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run this E2E test");
    await login(page);
  });

  test("DOB/Gender/Nationality editable; Identity Prefix + Identity Number locked (RegTank-sourced populated identityNumber)", async ({
    page,
  }) => {
    const userId = await getCurrentUserId(page);

    const orgId = `e2e-prov-case1-${Date.now()}`;
    const displayReference = `e2e-prov-case1-${Date.now()}`;

    await seedPersonalInvestorOrg({
      userId,
      orgId,
      displayReference,
      dateOfBirth: "1990-01-01",
      gender: "MALE",
      nationality: "MALAYSIA",
      identityPrefixSource: "REGTANK",
      identityNumberSource: "REGTANK",
      identityNumber: "800101011234",
    });

    await page.goto("/");
    await selectOrganizationByDisplayReference(page, displayReference);
    await page.goto("/profile");

    const personalCard = page.locator("#profile-personal");
    await personalCard.getByRole("button", { name: /edit/i }).click();

    const dobInput = personalCard.locator('input[type="date"]').first();
    await expect(dobInput).not.toBeDisabled();

    const comboboxes = personalCard.locator('[role="combobox"]');
    expect(await comboboxes.count()).toBe(2);
    await expect(comboboxes.nth(0)).not.toBeDisabled(); // Gender
    await expect(comboboxes.nth(1)).not.toBeDisabled(); // Nationality

    // Identity Prefix is read-only text (no input rendered for identityNumber when REGTANK-locked + populated).
    await expect(personalCard.locator('input[type="text"]')).toHaveCount(0);

    // The locked/verified message should show for Identity Prefix + Identity Number.
    // (Investor Name is also locked and may show the same message.)
    await expect(personalCard.getByText(LOCK_MESSAGE)).toHaveCount(3);
  });

  test("identityNumber missing exception: Identity Number editable even if metadata says REGTANK", async ({
    page,
  }) => {
    const userId = await getCurrentUserId(page);

    const orgId = `e2e-prov-case2-${Date.now()}`;
    const displayReference = `e2e-prov-case2-${Date.now()}`;

    await seedPersonalInvestorOrg({
      userId,
      orgId,
      displayReference,
      dateOfBirth: "1990-01-01",
      gender: "MALE",
      nationality: "MALAYSIA",
      identityPrefixSource: "REGTANK",
      identityNumberSource: "REGTANK",
      identityNumber: null, // missing value
    });

    await page.goto("/");
    await selectOrganizationByDisplayReference(page, displayReference);
    await page.goto("/profile");

    const personalCard = page.locator("#profile-personal");
    await personalCard.getByRole("button", { name: /edit/i }).click();

    // Identity Number input should appear and be enabled.
    const identityNumberInput = personalCard.locator('input[type="text"]').first();
    await expect(identityNumberInput).toBeVisible();
    await expect(identityNumberInput).not.toBeDisabled();

    // With identityNumber missing, only Investor Name + Identity Prefix are locked.
    await expect(personalCard.getByText(LOCK_MESSAGE)).toHaveCount(2);

    // Save with a new identity number.
    await identityNumberInput.fill("800101011999");
    await personalCard.getByRole("button", { name: /save changes/i }).click();

    // Wait for edit mode to exit and value to appear.
    await expect(personalCard.getByText("800101011999")).toBeVisible({ timeout: 10000 });

    // Lock message should no longer include Identity Number.
    await expect(personalCard.getByText(LOCK_MESSAGE)).toHaveCount(2);

    // Verify persistence after reload.
    await page.reload();
    await expect(personalCard.getByText("800101011999")).toBeVisible({ timeout: 10000 });
    await expect(personalCard.getByText(LOCK_MESSAGE)).toHaveCount(2);
  });
});

