import * as fs from "fs";
import * as path from "path";

const STEPPER = fs.readFileSync(
  path.join(__dirname, "horizontal-offer-stepper.tsx"),
  "utf8"
);

describe("HorizontalOfferStepper overflow and labels", () => {
  it("scrolls on a constrained nav wrapper and keeps the list min-width", () => {
    expect(STEPPER).toContain('aria-label="Offer progress"');
    expect(STEPPER).toContain('className={cn("min-w-0 overflow-x-auto", className)}');
    expect(STEPPER).toContain('className="flex min-w-max items-start pb-1"');
    expect(STEPPER).not.toMatch(/<ol className="[^"]*overflow-x-auto/);
  });

  it("uses a real button for clickable step labels", () => {
    expect(STEPPER).toContain('type="button"');
    expect(STEPPER).toContain("onClick={() => onStepClick?.(step.id)}");
    expect(STEPPER).not.toContain('role={isClickable ? "button"');
    expect(STEPPER).not.toContain("onKeyDown");
  });
});
