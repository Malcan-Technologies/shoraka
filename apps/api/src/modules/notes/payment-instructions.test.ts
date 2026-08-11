jest.mock("../../lib/prisma", () => ({
  prisma: {
    note: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma";
import { NoteService } from "./service";

describe("NoteService getPaymentInstructions", () => {
  const service = new NoteService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the canonical note_reference unchanged for new Notes", async () => {
    (prisma.note.findUnique as jest.Mock).mockResolvedValue({
      note_reference: "NOTE-ARF-202608-BX5",
    });

    const result = await service.getPaymentInstructions("clabcdefghijklmnop");

    expect(result.referenceFormat).toBe("NOTE-ARF-202608-BX5");
    expect(result.referenceFormat).not.toMatch(/NOTE-[A-Z0-9]{8}$/);
  });

  it("returns the stored legacy note_reference unchanged for historical Notes", async () => {
    (prisma.note.findUnique as jest.Mock).mockResolvedValue({
      note_reference: "NOTE-20260512-A1B2C3D4",
    });

    const result = await service.getPaymentInstructions("clabcdefghijklmnop");

    expect(result.referenceFormat).toBe("NOTE-20260512-A1B2C3D4");
  });

  it("does not manufacture a reference from the Note CUID", async () => {
    const noteId = "clabcdefghijklmnop";
    (prisma.note.findUnique as jest.Mock).mockResolvedValue({
      note_reference: "NOTE-ARF-202608-BX5",
    });

    const result = await service.getPaymentInstructions(noteId);

    expect(result.referenceFormat).not.toBe(`NOTE-${noteId.slice(-8).toUpperCase()}`);
    expect(result.referenceFormat).toBe("NOTE-ARF-202608-BX5");
  });
});
