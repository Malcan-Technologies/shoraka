#!/usr/bin/env tsx
/**
 * HTTP smoke of Prospectus Review against a running local API with DISABLE_AUTH=true.
 */
import { buildCompleteProspectusReviewDraft } from "../src/modules/notes/prospectus-review/prospectus-review.demo-fixtures";
import { seedProspectusReviewNote } from "./seed-prospectus-review-note";

/** Prefer LOCAL_API_URL — apps/api/.env often sets API_URL to a tunnel host. */
const API = process.env.LOCAL_API_URL ?? "http://127.0.0.1:4000";

async function readJson(res: Response, label: string) {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`${label} non-JSON ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function main() {
  const seed = await seedProspectusReviewNote();
  const noteId = seed.noteId;
  const base = `${API}/v1/admin/notes/${noteId}/prospectus-review`;

  const getRes = await fetch(base);
  const getJson = (await readJson(getRes, "GET")) as {
    success: boolean;
    data?: { review: { updatedAt: string; status: string } };
    error?: { code: string; message: string };
  };
  if (!getRes.ok || !getJson.success || !getJson.data) {
    throw new Error(`GET failed: ${getRes.status} ${JSON.stringify(getJson)}`);
  }

  const draft = buildCompleteProspectusReviewDraft();
  const saveRes = await fetch(base, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draftContent: draft,
      expectedUpdatedAt: getJson.data.review.updatedAt,
    }),
  });
  const saveJson = (await readJson(saveRes, "PUT")) as {
    data?: { status: string };
    error?: unknown;
  };
  console.log("save", saveRes.status, saveJson.data?.status);

  const previewRes = await fetch(`${base}/preview`);
  const previewJson = (await readJson(previewRes, "PREVIEW")) as {
    data?: { previewSource: string; draftMarker: string; html: { page1: string; page2: string; page3: string } };
  };
  const page1 = previewJson.data?.html.page1 ?? "";
  const page2 = previewJson.data?.html.page2 ?? "";
  const page3 = previewJson.data?.html.page3 ?? "";
  console.log("preview", previewRes.status, previewJson.data?.previewSource);
  if (page1.includes("Northbridge Demo Trading") || page2.includes("Northbridge Demo Trading")) {
    throw new Error("Issuer name leaked in preview");
  }
  if (
    !page1.includes("shariah-badge") &&
    !page2.includes("shariah-badge") &&
    !page3.includes("shariah-badge")
  ) {
    throw new Error("Shariah badge missing in preview");
  }

  const blocked = await fetch(`${API}/v1/admin/notes/${noteId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const blockedJson = (await readJson(blocked, "PUBLISH-BLOCKED")) as {
    error?: { code: string };
  };
  console.log("publish-blocked", blocked.status, blockedJson.error?.code);

  const approveRes = await fetch(`${base}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const approveJson = (await readJson(approveRes, "APPROVE")) as { data?: { status: string } };
  console.log("approve", approveRes.status, approveJson.data?.status);

  const publishRes = await fetch(`${API}/v1/admin/notes/${noteId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const publishJson = (await readJson(publishRes, "PUBLISH")) as {
    data?: { status: string };
    error?: unknown;
  };
  console.log("publish", publishRes.status, publishJson.data?.status, publishJson.error);

  const getAfter = await fetch(base);
  const getAfterJson = (await readJson(getAfter, "GET-AFTER")) as {
    data?: { review: { status: string } };
  };
  console.log("review-after-publish", getAfter.status, getAfterJson.data?.review.status);
  if (getAfterJson.data?.review.status !== "PUBLISHED") {
    throw new Error("Prospectus review must be PUBLISHED after Note publish");
  }

  if (publishRes.status !== 200) throw new Error("Publish failed");
  console.log("\nHTTP smoke PASSED\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
