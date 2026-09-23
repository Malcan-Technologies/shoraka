import { loadShorakaCertificatePdfs, sha256Hex } from "./compile-facility-agreement-package";

describe("loadShorakaCertificatePdfs", () => {
  it("skips rows without a stored file and keeps hashes when present", async () => {
    const loadPdf = jest.fn(async (key: string) => Buffer.from(`pdf:${key}`));
    const certificates = await loadShorakaCertificatePdfs(
      [
        {
          id: "order-a",
          created_at: new Date("2026-09-01"),
          certificate_s3_key: "notes/a.pdf",
          certificate_file_sha256: "hash-a",
          withdrawalInstruction: {
            withdrawal_type: "ISSUER_DISBURSEMENT",
            created_at: new Date("2026-09-01"),
          },
        },
        {
          id: "order-b",
          created_at: new Date("2026-09-02"),
          certificate_s3_key: "  ",
          certificate_file_sha256: null,
          withdrawalInstruction: {
            withdrawal_type: "ISSUER_RESIDUAL_RETURN",
            created_at: new Date("2026-09-02"),
          },
        },
      ],
      loadPdf
    );

    expect(loadPdf).toHaveBeenCalledTimes(1);
    expect(certificates).toEqual([
      { id: "order-a", buffer: Buffer.from("pdf:notes/a.pdf"), sha256: "hash-a" },
    ]);
  });

  it("hashes the PDF when the stored checksum is missing", async () => {
    const buffer = Buffer.from("cert-bytes");
    const certificates = await loadShorakaCertificatePdfs(
      [
        {
          id: "order-a",
          created_at: new Date("2026-09-01"),
          certificate_s3_key: "notes/a.pdf",
          certificate_file_sha256: null,
          withdrawalInstruction: {
            withdrawal_type: "ISSUER_DISBURSEMENT",
            created_at: new Date("2026-09-01"),
          },
        },
      ],
      async () => buffer
    );
    expect(certificates[0]?.sha256).toBe(sha256Hex(buffer));
  });
});
