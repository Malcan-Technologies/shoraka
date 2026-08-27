import { NoteStatus } from "@prisma/client";
import { frozenMarcFromProspectusSnapshot, resolveMarcSnapshotForProspectus } from "./prospectus-marc-snapshot";
import { getCurrentMarcAssessment } from "../../paymaster/service";

jest.mock("../../paymaster/service", () => ({
  getCurrentMarcAssessment: jest.fn(),
}));

const mockLive = getCurrentMarcAssessment as jest.MockedFunction<typeof getCurrentMarcAssessment>;

describe("prospectus MARC freeze", () => {
  beforeEach(() => {
    mockLive.mockReset();
    mockLive.mockResolvedValue({
      creditGrade: "SME-9",
      creditScore: 12,
      probabilityOfDefault: 37.63,
      reportDate: "2026-01-01",
      reportFileName: "live.pdf",
      assessedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("reads frozen MARC from approved note_identity and ignores later live org MARC", async () => {
    const frozen = {
      creditGrade: "SME-4",
      creditScore: 65,
      probabilityOfDefault: 7.43,
      reportDate: "2025-06-01",
      reportFileName: "frozen.pdf",
      assessedAt: "2025-06-01T00:00:00.000Z",
    };
    const snapshot = { note_identity: { marc_snapshot: frozen } };
    expect(frozenMarcFromProspectusSnapshot(snapshot)).toEqual(frozen);

    const published = await resolveMarcSnapshotForProspectus({
      status: NoteStatus.PUBLISHED,
      published_at: new Date("2025-07-01T00:00:00.000Z"),
      prospectus_snapshot: snapshot,
      issuer_organization_id: "org-1",
    });
    expect(published).toEqual(frozen);
    expect(mockLive).not.toHaveBeenCalled();
  });

  it("uses live org MARC only when unpublished and no freeze exists", async () => {
    const live = await resolveMarcSnapshotForProspectus({
      status: NoteStatus.FUNDING,
      published_at: null,
      prospectus_snapshot: null,
      issuer_organization_id: "org-1",
    });
    expect(live?.creditGrade).toBe("SME-9");
    expect(mockLive).toHaveBeenCalledWith("org-1");
  });
});
