import { test, expect, type Page } from "@playwright/test";
import { PrismaClient, OrganizationType, type Prisma } from "@prisma/client";

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
  dateOfBirth: string | null; // YYYY-MM-DD
  gender: string; // MALE/FEMALE/UNSPECIFIED
  nationality: string;
  identityPrefixSource: "REGTANK" | "USER" | "ADMIN";
  identityNumberSource: "REGTANK" | "USER" | "ADMIN";
  identityNumber: string | null;
  dateOfBirthSource?: "REGTANK" | "USER" | "ADMIN";
  genderSource?: "REGTANK" | "USER" | "ADMIN";
  nationalitySource?: "REGTANK" | "USER" | "ADMIN";
}) {
  const fixedNow = new Date("2026-09-17T00:00:00.000Z");
  const profileFieldSources: Prisma.InputJsonValue = {
    dateOfBirth: { source: args.dateOfBirthSource ?? "USER", updatedAt: fixedNow.toISOString() },
    gender: { source: args.genderSource ?? "USER", updatedAt: fixedNow.toISOString() },
    nationality: { source: args.nationalitySource ?? "USER", updatedAt: fixedNow.toISOString() },
    identityPrefix: { source: args.identityPrefixSource, updatedAt: fixedNow.toISOString() },
    identityNumber: { source: args.identityNumberSource, updatedAt: fixedNow.toISOString() },
  };

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
      date_of_birth: args.dateOfBirth ? new Date(`${args.dateOfBirth}T00:00:00.000Z`) : null,

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

      profile_field_sources: profileFieldSources,
    },
    update: {
      owner_user_id: args.userId,
      display_reference: args.displayReference,
      onboarding_status: "COMPLETED",
      onboarded_at: fixedNow,

      gender: args.gender,
      nationality: args.nationality,
      date_of_birth: args.dateOfBirth ? new Date(`${args.dateOfBirth}T00:00:00.000Z`) : null,

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

      profile_field_sources: profileFieldSources,
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

  test("DOB missing + gender placeholder UNSPECIFIED is editable (RegTank-sourced placeholders)", async ({
    page,
  }) => {
    const userId = await getCurrentUserId(page);

    const orgId = `e2e-prov-case3-${Date.now()}`;
    const displayReference = `e2e-prov-case3-${Date.now()}`;

    await seedPersonalInvestorOrg({
      userId,
      orgId,
      displayReference,
      dateOfBirth: null,
      gender: "UNSPECIFIED",
      nationality: "MALAYSIA",
      identityPrefixSource: "REGTANK",
      identityNumberSource: "REGTANK",
      identityNumber: "800101011234",
      dateOfBirthSource: "REGTANK",
      genderSource: "REGTANK",
      nationalitySource: "USER",
    });

    await page.goto("/");
    await selectOrganizationByDisplayReference(page, displayReference);
    await page.goto("/profile");

    const personalCard = page.locator("#profile-personal");
    await personalCard.getByRole("button", { name: /edit/i }).click();

    const dobInput = personalCard.locator('input[type="date"]').first();
    await expect(dobInput).not.toBeDisabled();

    // Save by filling DOB only. This must not trigger the RegTank verified-lock error.
    await dobInput.fill("1990-01-01");
    await personalCard.getByRole("button", { name: /save changes/i }).click();

    // If the bug is present, the toast lock message shows up and the save fails.
    await expect(personalCard.getByText(LOCK_MESSAGE)).toHaveCount(0, { timeout: 5000 });

    // Ensure DOB is now populated.
    await expect(personalCard.getByText(/1990/)).toBeVisible({ timeout: 10000 });
  });

  test("Malaysia nationality dropdown is de-duplicated and saves canonical MALAYSIA only when selected", async ({
    page,
  }) => {
    const userId = await getCurrentUserId(page);

    const storedValues = ["MY", "MYS", "MALAYSIA", "Malaysia"];

    for (const storedNationality of storedValues) {
      const orgId = `e2e-malaysia-dd-${storedNationality}-${Date.now()}`;
      const displayReference = `e2e-malaysia-dd-${storedNationality}-${Date.now()}`;

      await seedPersonalInvestorOrg({
        userId,
        orgId,
        displayReference,
        dateOfBirth: "1990-01-01",
        gender: "MALE",
        nationality: storedNationality,
        identityPrefixSource: "REGTANK",
        identityNumberSource: "REGTANK",
        identityNumber: "800101011234",
        dateOfBirthSource: "USER",
        genderSource: "USER",
        nationalitySource: "USER",
      });

      await page.goto("/");
      await selectOrganizationByDisplayReference(page, displayReference);
      await page.goto("/profile");

      const personalCard = page.locator("#profile-personal");
      await personalCard.getByRole("button", { name: /edit/i }).click();

      const comboboxes = personalCard.locator('[role="combobox"]');
      const nationalityCombobox = comboboxes.nth(1);
      await expect(nationalityCombobox).not.toBeDisabled();

      // Change DOB only (do NOT touch nationality). Saving must not rewrite stored nationality.
      const dobInput = personalCard.locator('input[type="date"]').first();
      await dobInput.fill("1991-01-01");
      await personalCard.getByRole("button", { name: /save changes/i }).click();

      await page.waitForTimeout(500);
      const afterDobSave = await prisma.investorOrganization.findUnique({ where: { id: orgId } });
      expect(afterDobSave?.nationality).toBe(storedNationality);

      // Now explicitly select Malaysia in the nationality dropdown and save.
      await page.reload();
      await page.locator("#profile-personal").getByRole("button", { name: /edit/i }).click();

      const comboboxes2 = personalCard.locator('[role="combobox"]');
      const nationalityCombobox2 = comboboxes2.nth(1);
      await nationalityCombobox2.click();

      const malaysiaOptions = page.getByRole("option", { name: "Malaysia" });
      await expect(malaysiaOptions).toHaveCount(1);
      await malaysiaOptions.first().click();

      await personalCard.getByRole("button", { name: /save changes/i }).click();
      await page.waitForTimeout(500);

      const afterSelectSave = await prisma.investorOrganization.findUnique({ where: { id: orgId } });
      expect(afterSelectSave?.nationality).toBe("MALAYSIA");
    }
  });

  test("UNSPECIFIED nationality remains editable; selecting Malaysia saves MALAYSIA", async ({
    page,
  }) => {
    const userId = await getCurrentUserId(page);

    const orgId = `e2e-malaysia-dd-unspecified-${Date.now()}`;
    const displayReference = `e2e-malaysia-dd-unspecified-${Date.now()}`;

    await seedPersonalInvestorOrg({
      userId,
      orgId,
      displayReference,
      dateOfBirth: "1990-01-01",
      gender: "MALE",
      nationality: "UNSPECIFIED",
      identityPrefixSource: "REGTANK",
      identityNumberSource: "REGTANK",
      identityNumber: "800101011234",
      dateOfBirthSource: "USER",
      genderSource: "USER",
      nationalitySource: "REGTANK",
    });

    await page.goto("/");
    await selectOrganizationByDisplayReference(page, displayReference);
    await page.goto("/profile");

    const personalCard = page.locator("#profile-personal");
    await personalCard.getByRole("button", { name: /edit/i }).click();

    const comboboxes = personalCard.locator('[role="combobox"]');
    const nationalityCombobox = comboboxes.nth(1);
    await expect(nationalityCombobox).not.toBeDisabled();

    await nationalityCombobox.click();
    await page.getByRole("option", { name: "Malaysia" }).first().click();

    await personalCard.getByRole("button", { name: /save changes/i }).click();
    await page.waitForTimeout(500);

    const after = await prisma.investorOrganization.findUnique({ where: { id: orgId } });
    expect(after?.nationality).toBe("MALAYSIA");
  });
});

