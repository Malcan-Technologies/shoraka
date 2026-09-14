import * as fs from "fs";
import * as path from "path";

const layoutSource = fs.readFileSync(path.join(__dirname, "offer-terms-layout.tsx"), "utf8");

describe("OfferTermsDlRow mobile wrapping", () => {
  it("uses a shrinkable two-column grid so long fee hints wrap in the value column", () => {
    expect(layoutSource).toContain(
      'dl className="mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-ui"'
    );
    expect(layoutSource).not.toContain("grid-cols-[minmax(0,1fr)_auto]");
  });

  it("lets both label and value columns shrink and wrap while keeping amounts tabular and right-aligned", () => {
    expect(layoutSource).toContain('dt className="min-w-0 break-words text-muted-foreground"');
    expect(layoutSource).toContain(
      '"m-0 min-w-0 break-words text-right font-medium tabular-nums [&>span]:block [&>span]:min-w-0"'
    );
  });
});
