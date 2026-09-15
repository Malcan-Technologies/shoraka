describe("withAdvisoryLock SSL configuration", () => {
  const originalEnv = process.env;

  async function loadModuleWithMocks({
    exists,
    caCert,
  }: {
    exists: boolean;
    caCert?: string;
  }) {
    jest.resetModules();

    jest.doMock("fs", () => ({
      existsSync: jest.fn(() => exists),
      readFileSync: jest.fn(() => caCert ?? "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n"),
      default: {
        existsSync: jest.fn(() => exists),
        readFileSync: jest.fn(() => caCert ?? "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n"),
      },
    }));

    const poolCtor = jest.fn();

    jest.doMock("pg", () => ({
      Pool: jest.fn((config) => {
        poolCtor(config);
        return {
          connect: jest.fn(),
          end: jest.fn(),
          on: jest.fn(),
        };
      }),
    }));

    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pass@host:5432/db?sslmode=require";

    await import("./with-advisory-lock");

    return { poolCtor };
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses CA + rejectUnauthorized=true when the RDS CA bundle exists", async () => {
    const { poolCtor } = await loadModuleWithMocks({ exists: true, caCert: "CA_CERT_VALUE" });

    expect(poolCtor).toHaveBeenCalledTimes(1);
    const config = poolCtor.mock.calls[0][0];
    expect(config.connectionString).toContain("host:5432/db");
    expect(config.ssl).toEqual({ ca: "CA_CERT_VALUE", rejectUnauthorized: true });
  });

  it("falls back to rejectUnauthorized=false when the RDS CA bundle is missing", async () => {
    const { poolCtor } = await loadModuleWithMocks({ exists: false });

    expect(poolCtor).toHaveBeenCalledTimes(1);
    const config = poolCtor.mock.calls[0][0];
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });
});

