/**
 * No-fallback legal version state machine.
 *
 * Authoritative model: status === "PUBLISHED" means active.
 * Publishing archives every other Published version for the same definition.
 * Archiving the active Published version leaves NONE — older rows stay Archived.
 */

export type SimStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type SimVersion = {
  id: string;
  version: number;
  status: SimStatus;
  publishedAt: string | null;
};

export function resolveActivePublished(versions: SimVersion[]): SimVersion | null {
  const published = versions
    .filter((v) => v.status === "PUBLISHED")
    .sort((a, b) => b.version - a.version);
  return published[0] ?? null;
}

export function publishVersion(versions: SimVersion[], versionId: string): SimVersion[] {
  const target = versions.find((v) => v.id === versionId);
  if (!target) throw new Error("not found");
  if (target.status !== "DRAFT" && target.status !== "ARCHIVED") {
    throw new Error("invalid status");
  }

  return versions.map((v) => {
    if (v.id === versionId) {
      return {
        ...v,
        status: "PUBLISHED",
        publishedAt: v.publishedAt ?? new Date().toISOString(),
      };
    }
    if (v.status === "PUBLISHED") {
      return { ...v, status: "ARCHIVED" };
    }
    return v;
  });
}

export function archiveVersion(versions: SimVersion[], versionId: string): SimVersion[] {
  return versions.map((v) =>
    v.id === versionId ? { ...v, status: "ARCHIVED" as const } : v
  );
}

describe("legal documents no-fallback invariant", () => {
  it("after publish v2 then archive v2, active published is NONE (v1 does not return)", () => {
    let versions: SimVersion[] = [
      {
        id: "v1",
        version: 1,
        status: "PUBLISHED",
        publishedAt: "2026-08-01T00:00:00.000Z",
      },
    ];

    versions = [
      ...versions,
      {
        id: "v2",
        version: 2,
        status: "DRAFT",
        publishedAt: null,
      },
    ];

    versions = publishVersion(versions, "v2");
    expect(resolveActivePublished(versions)?.id).toBe("v2");
    expect(versions.find((v) => v.id === "v1")?.status).toBe("ARCHIVED");
    expect(versions.filter((v) => v.status === "PUBLISHED")).toHaveLength(1);

    versions = archiveVersion(versions, "v2");
    expect(resolveActivePublished(versions)).toBeNull();
    expect(versions.find((v) => v.id === "v1")?.status).toBe("ARCHIVED");
    expect(versions.find((v) => v.id === "v2")?.status).toBe("ARCHIVED");
    expect(versions.filter((v) => v.status === "PUBLISHED")).toHaveLength(0);
  });

  it("never selects an archived historical version as active", () => {
    const versions: SimVersion[] = [
      {
        id: "v1",
        version: 1,
        status: "ARCHIVED",
        publishedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "v2",
        version: 2,
        status: "ARCHIVED",
        publishedAt: "2026-08-02T00:00:00.000Z",
      },
    ];
    expect(resolveActivePublished(versions)).toBeNull();
  });

  it("keeps exactly one Published after successive publishes", () => {
    let versions: SimVersion[] = [
      { id: "v1", version: 1, status: "DRAFT", publishedAt: null },
    ];
    versions = publishVersion(versions, "v1");
    versions = [
      ...versions,
      { id: "v2", version: 2, status: "DRAFT", publishedAt: null },
    ];
    versions = publishVersion(versions, "v2");
    versions = [
      ...versions,
      { id: "v3", version: 3, status: "DRAFT", publishedAt: null },
    ];
    versions = publishVersion(versions, "v3");

    expect(versions.filter((v) => v.status === "PUBLISHED").map((v) => v.id)).toEqual([
      "v3",
    ]);
    expect(resolveActivePublished(versions)?.id).toBe("v3");
  });
});
