import { OrganizationMemberRole } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import {
  runPersonScopedInvitationIssue,
  type PersonScopedInvitationMatch,
} from "./party-platform-link";

const service = readFileSync(join(__dirname, "service.ts"), "utf8");

type StoredInvite = PersonScopedInvitationMatch & { active: boolean };

class Mutex {
  private locked = false;
  private readonly waiters: Array<() => void> = [];

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
        return;
      }
      this.waiters.push(resolve);
    });
    try {
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.locked = false;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPartyInviteStore() {
  const invites: StoredInvite[] = [];
  let seq = 0;

  return {
    invites,
    listActive(): StoredInvite[] {
      return invites.filter((row) => row.active);
    },
    supersede(exceptId?: string): void {
      for (const row of invites) {
        if (row.active && row.id !== exceptId) {
          row.active = false;
        }
      }
    },
    create(email: string, role: string): StoredInvite {
      seq += 1;
      const row: StoredInvite = {
        id: `inv-${seq}`,
        token: `tok-${seq}`,
        email,
        role,
        active: true,
      };
      invites.push(row);
      return row;
    },
  };
}

async function issueAgainstStore(
  store: ReturnType<typeof createPartyInviteStore>,
  email: string,
  role: string,
  options?: { holdLock?: Mutex; staleListMs?: number; createDelayMs?: number }
) {
  const run = () =>
    runPersonScopedInvitationIssue({
      email,
      role,
      lockParty: async () => undefined,
      listActive: async () => {
        const snapshot = store.listActive();
        if (options?.staleListMs) {
          await delay(options.staleListMs);
        }
        return snapshot;
      },
      supersede: async (exceptId) => {
        store.supersede(exceptId);
      },
      create: async () => {
        if (options?.createDelayMs) {
          await delay(options.createDelayMs);
        }
        return store.create(email, role);
      },
    });
  if (options?.holdLock) {
    return options.holdLock.runExclusive(run);
  }
  return run();
}

describe("runPersonScopedInvitationIssue concurrency", () => {
  it("locks the party before listing or creating invitations", async () => {
    const order: string[] = [];
    await runPersonScopedInvitationIssue({
      email: "darren@example.com",
      role: OrganizationMemberRole.ORGANIZATION_MEMBER,
      lockParty: async () => {
        order.push("lock");
      },
      listActive: async () => {
        order.push("list");
        return [];
      },
      supersede: async () => {
        order.push("supersede");
      },
      create: async () => {
        order.push("create");
        return {
          id: "inv-1",
          token: "tok-1",
          email: "darren@example.com",
          role: OrganizationMemberRole.ORGANIZATION_MEMBER,
        };
      },
    });
    expect(order).toEqual(["lock", "list", "supersede", "create"]);
  });

  it("without a lock, concurrent same-email creates can both insert", async () => {
    const store = createPartyInviteStore();
    const [first, second] = await Promise.all([
      issueAgainstStore(store, "darren@example.com", OrganizationMemberRole.ORGANIZATION_MEMBER, {
        staleListMs: 20,
        createDelayMs: 20,
      }),
      issueAgainstStore(store, "darren@example.com", OrganizationMemberRole.ORGANIZATION_MEMBER, {
        staleListMs: 20,
        createDelayMs: 20,
      }),
    ]);
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(false);
    expect(first.invitation.id).not.toBe(second.invitation.id);
    expect(store.listActive()).toHaveLength(2);
  });

  it("concurrent same-email/same-role Person invites reuse one active invitation", async () => {
    const store = createPartyInviteStore();
    const lock = new Mutex();
    const started: string[] = [];
    const [first, second] = await Promise.all([
      (async () => {
        started.push("inviteMember");
        return issueAgainstStore(
          store,
          "  Darren@Example.com ",
          OrganizationMemberRole.ORGANIZATION_MEMBER,
          { holdLock: lock }
        );
      })(),
      (async () => {
        started.push("generate-link");
        return issueAgainstStore(
          store,
          "darren@example.com",
          OrganizationMemberRole.ORGANIZATION_MEMBER,
          { holdLock: lock }
        );
      })(),
    ]);
    expect(started.sort()).toEqual(["generate-link", "inviteMember"]);
    expect(store.listActive()).toHaveLength(1);
    expect(first.invitation.id).toBe(second.invitation.id);
    expect(first.invitation.token).toBe(second.invitation.token);
    expect([first.reused, second.reused].sort()).toEqual([false, true]);
  });

  it("concurrent different-email Person invites leave one active invite and make the old token unusable", async () => {
    const store = createPartyInviteStore();
    const lock = new Mutex();
    await Promise.all([
      issueAgainstStore(store, "darren.old@example.com", OrganizationMemberRole.ORGANIZATION_MEMBER, {
        holdLock: lock,
      }),
      issueAgainstStore(store, "darren.new@example.com", OrganizationMemberRole.ORGANIZATION_MEMBER, {
        holdLock: lock,
      }),
    ]);
    const active = store.listActive();
    expect(active).toHaveLength(1);
    const superseded = store.invites.filter((row) => !row.active);
    expect(superseded).toHaveLength(1);
    expect(active[0]?.token).not.toBe(superseded[0]?.token);
    expect(store.invites).toHaveLength(2);
  });

  it("concurrent different-role Person invites leave one active final invite", async () => {
    const store = createPartyInviteStore();
    const lock = new Mutex();
    await Promise.all([
      issueAgainstStore(store, "darren@example.com", OrganizationMemberRole.ORGANIZATION_MEMBER, {
        holdLock: lock,
      }),
      issueAgainstStore(store, "darren@example.com", OrganizationMemberRole.ORGANIZATION_ADMIN, {
        holdLock: lock,
      }),
    ]);
    const active = store.listActive();
    expect(active).toHaveLength(1);
    expect(store.invites).toHaveLength(2);
    expect(store.invites.filter((row) => !row.active)).toHaveLength(1);
  });
});

describe("Person-scoped invite paths share the concurrency-safe helper", () => {
  it("uses the same helper from inviteMember and generateMemberInvitationUrl", () => {
    const invite = service.slice(
      service.indexOf("async inviteMember"),
      service.indexOf("async generateMemberInvitationUrl")
    );
    const generate = service.slice(
      service.indexOf("async generateMemberInvitationUrl"),
      service.indexOf("async acceptInvitation")
    );
    expect(invite).toContain("issuePersonScopedInvitation");
    expect(generate).toContain("issuePersonScopedInvitation");
    expect(service).toContain("runPersonScopedInvitationIssue");
    expect(service).toContain("lockOrganizationPartyProfileForUpdate");
  });

  it("does not lock or supersede generic Members invitations", () => {
    const generate = service.slice(
      service.indexOf("async generateMemberInvitationUrl"),
      service.indexOf("async acceptInvitation")
    );
    const generic = generate.slice(generate.indexOf("} else {"));
    expect(generic).toContain("existingInvitation");
    expect(generic).not.toContain("lockOrganizationPartyProfileForUpdate");
    expect(generic).not.toContain("runPersonScopedInvitationIssue");
  });
});
