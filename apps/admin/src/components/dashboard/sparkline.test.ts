import { sparklinePolylinePoints } from "./sparkline";

describe("sparklinePolylinePoints", () => {
  it("hides the sparkline when history has fewer than two points", () => {
    expect(sparklinePolylinePoints([])).toBeNull();
    expect(sparklinePolylinePoints([18.4])).toBeNull();
  });

  it("maps two or more values onto a polyline", () => {
    expect(sparklinePolylinePoints([10, 20], 100, 26)).toBe("0.0,23.0 100.0,3.0");
    expect(sparklinePolylinePoints([4, 8, 6], 100, 26)?.split(" ")).toHaveLength(3);
  });
});
