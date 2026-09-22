/**
 * SECTION: Published Prospectus resolution after campaign extend
 * WHY: Marketplace follows the current approved publication; investments keep the pinned PDF.
 */

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    note: { findUnique: jest.fn() },
    noteProspectusPublication: { findFirst: jest.fn(), findUnique: jest.fn() },
    noteInvestment: { findUnique: jest.fn() },
    investorOrganization: { findFirst: jest.fn() },
  },
}));

jest.mock("../prospectus/prospectus-pdf", () => ({
  PROSPECTUS_PDF_STATUS_READY: "READY",
  prospectusPdfFileName: () => "prospectus.pdf",
  generateProspectusPdfViewUrl: jest.fn(async ({ disposition }: { disposition?: string }) => ({
    viewUrl: disposition === "attachment" ? "https://download" : "https://view",
    expiresIn: 600,
  })),
}));

import { NoteStatus } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  getInvestmentPublishedProspectus,
  getMarketplacePublishedProspectus,
} from "./prospectus-investor-access";

const oldPublication = {
  id: "pub_old",
  note_id: "note-1",
  content_version: 3,
  published_at: new Date("2026-09-11T00:00:00.000Z"),
  pdf_generation_status: "READY",
  pdf_storage_key: "old.pdf",
  pdf_sha256: "old-hash",
  pdf_snapshot_hash: "old-snap",
  snapshot: {
    publication_id: "pub_old",
    content_version: 3,
    render_fingerprint: "fp",
    calculated_at: "2026-07-19T00:00:00.000Z",
    page_1: {},
    page_2: {},
    publication_content: {},
    note_identity: {},
    html: { page1: "<p>old</p>", page2: "<p>p2</p>", page3: "<p>p3</p>" },
  },
};

const newPublication = {
  ...oldPublication,
  id: "pub_new",
  content_version: 4,
  published_at: new Date("2026-09-21T00:00:00.000Z"),
  pdf_storage_key: "new.pdf",
  pdf_sha256: "new-hash",
  pdf_snapshot_hash: "new-snap",
  snapshot: {
    ...oldPublication.snapshot,
    publication_id: "pub_new",
    content_version: 4,
    html: { page1: "<p>new</p>", page2: "<p>p2</p>", page3: "<p>p3</p>" },
  },
};

describe("published prospectus resolution after extend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.note.findUnique as jest.Mock).mockResolvedValue({
      status: NoteStatus.PUBLISHED,
      published_at: new Date("2026-09-11T00:00:00.000Z"),
      note_reference: "NOTE-001",
      prospectus_review: { status: "PUBLISHED", approved_publication_id: "pub_new" },
    });
  });

  it("returns the new marketplace publication while a pinned investment keeps the old PDF", async () => {
    (prisma.noteProspectusPublication.findFirst as jest.Mock).mockResolvedValue(newPublication);
    (prisma.noteProspectusPublication.findUnique as jest.Mock).mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === "pub_old") return oldPublication;
        if (where.id === "pub_new") return newPublication;
        return null;
      }
    );
    (prisma.noteInvestment.findUnique as jest.Mock).mockResolvedValue({
      id: "inv-1",
      note_id: "note-1",
      investor_user_id: "user-1",
      investor_organization_id: "org-1",
      prospectus_publication_id: "pub_old",
    });
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({ id: "org-1" });

    const marketplace = await getMarketplacePublishedProspectus("note-1");
    expect(marketplace.publicationId).toBe("pub_new");
    expect(prisma.noteProspectusPublication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "pub_new", published_at: { not: null } }),
      })
    );

    const investment = await getInvestmentPublishedProspectus("inv-1", { userId: "user-1" });
    expect(investment.publicationId).toBe("pub_old");
    expect(oldPublication.published_at).not.toBeNull();
  });
});
