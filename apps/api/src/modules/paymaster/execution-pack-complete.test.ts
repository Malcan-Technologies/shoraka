jest.mock("../../lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: jest.fn() },
    signingEnvelope: { findFirst: jest.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { isExecutionPackCompleteForNote } from "./service";

describe("isExecutionPackCompleteForNote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("treats a completed facility package as complete for a contract-linked invoice note", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ contract_id: "fac-1" });
    (prisma.signingEnvelope.findFirst as jest.Mock).mockResolvedValue({ id: "env-facility" });

    await expect(
      isExecutionPackCompleteForNote({
        sourceContractId: "fac-1",
        sourceInvoiceId: "inv-draw",
      })
    ).resolves.toBe(true);

    expect(prisma.signingEnvelope.findFirst).toHaveBeenCalledWith({
      where: { status: "COMPLETED", contract_id: "fac-1" },
      select: { id: true },
    });
  });

  it("does not require the envelope to live on the note application or invoice row", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ contract_id: "fac-1" });
    (prisma.signingEnvelope.findFirst as jest.Mock).mockResolvedValue({ id: "env-origin" });

    await isExecutionPackCompleteForNote({
      sourceContractId: "fac-1",
      sourceInvoiceId: "inv-draw",
    });

    const where = (prisma.signingEnvelope.findFirst as jest.Mock).mock.calls[0][0].where;
    expect(where).not.toHaveProperty("application_id");
    expect(where).not.toHaveProperty("invoice_id");
    expect(where).not.toHaveProperty("OR");
  });

  it("looks up the invoice envelope for invoice-only notes", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ contract_id: null });
    (prisma.signingEnvelope.findFirst as jest.Mock).mockResolvedValue({ id: "env-inv" });

    await expect(
      isExecutionPackCompleteForNote({
        sourceContractId: null,
        sourceInvoiceId: "inv-1",
      })
    ).resolves.toBe(true);

    expect(prisma.signingEnvelope.findFirst).toHaveBeenCalledWith({
      where: { status: "COMPLETED", invoice_id: "inv-1" },
      select: { id: true },
    });
  });

  it("is incomplete when the facility package is not completed", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ contract_id: "fac-1" });
    (prisma.signingEnvelope.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      isExecutionPackCompleteForNote({
        sourceContractId: "fac-1",
        sourceInvoiceId: "inv-draw",
      })
    ).resolves.toBe(false);
  });

  it("is incomplete when the note has no contract or invoice to look up", async () => {
    await expect(
      isExecutionPackCompleteForNote({
        sourceContractId: null,
        sourceInvoiceId: null,
      })
    ).resolves.toBe(false);

    expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
    expect(prisma.signingEnvelope.findFirst).not.toHaveBeenCalled();
  });
});
