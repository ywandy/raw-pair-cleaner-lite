import { describe, expect, it } from "vitest";
import { createMockScanBundle } from "./mockData";

describe("createMockScanBundle", () => {
  it("creates a reviewable scan result with selected delete candidates", () => {
    const bundle = createMockScanBundle();

    expect(bundle.scanResult.rootPath).toContain("Sample Shoot");
    expect(bundle.compareResult.deleteCandidates).toHaveLength(3);
    expect(bundle.compareResult.conflicts).toHaveLength(1);
    expect([...bundle.selectedPaths].sort()).toEqual(
      bundle.compareResult.deleteCandidates.map((file) => file.path).sort()
    );
    expect(bundle.compareResult.totalDeleteSize).toBe(
      bundle.compareResult.deleteCandidates.reduce((total, file) => total + file.size, 0)
    );
  });
});
