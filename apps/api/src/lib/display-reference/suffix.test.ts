import { generateSecureSuffix } from "./suffix";

describe("display-reference secure suffix", () => {
  it("returns exact length 3 with allowed charset", () => {
    const suffix = generateSecureSuffix();
    expect(suffix).toHaveLength(3);
    expect(suffix).toMatch(/^[A-Z0-9]{3}$/);
  });

  it("supports custom positive length", () => {
    const suffix = generateSecureSuffix(5);
    expect(suffix).toHaveLength(5);
    expect(suffix).toMatch(/^[A-Z0-9]{5}$/);
  });

  it("rejects invalid lengths", () => {
    expect(() => generateSecureSuffix(0)).toThrow();
    expect(() => generateSecureSuffix(-1)).toThrow();
    expect(() => generateSecureSuffix(2.5)).toThrow();
  });
});
