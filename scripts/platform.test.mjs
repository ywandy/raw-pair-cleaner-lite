import { describe, expect, it } from "vitest";

import {
  getExecutableSuffixForTarget,
  getTargetConfig,
  getTargetConfigForTriple
} from "./platform.mjs";

describe("platform target helpers", () => {
  it("maps explicit Tauri triples to pkg targets and executable suffixes", () => {
    expect(getTargetConfigForTriple("aarch64-apple-darwin")).toEqual({
      tauriTriple: "aarch64-apple-darwin",
      pkgTarget: "node20-macos-arm64",
      executableSuffix: ""
    });
    expect(getTargetConfigForTriple("x86_64-apple-darwin")).toEqual({
      tauriTriple: "x86_64-apple-darwin",
      pkgTarget: "node20-macos-x64",
      executableSuffix: ""
    });
    expect(getTargetConfigForTriple("x86_64-pc-windows-msvc")).toEqual({
      tauriTriple: "x86_64-pc-windows-msvc",
      pkgTarget: "node20-win-x64",
      executableSuffix: ".exe"
    });
  });

  it("prefers explicit target env over host platform", () => {
    expect(
      getTargetConfig({
        platform: "darwin",
        arch: "arm64",
        env: {
          TAURI_TARGET: "x86_64-apple-darwin"
        }
      })
    ).toEqual({
      tauriTriple: "x86_64-apple-darwin",
      pkgTarget: "node20-macos-x64",
      executableSuffix: ""
    });
  });

  it("keeps Windows suffix tied to target, not host OS", () => {
    expect(getExecutableSuffixForTarget("x86_64-pc-windows-msvc")).toBe(".exe");
    expect(getExecutableSuffixForTarget("aarch64-apple-darwin")).toBe("");
  });
});
