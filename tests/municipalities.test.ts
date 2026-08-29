import { describe, expect, it } from "vitest";
import { isSupportedMunicipality, supportedMunicipalities } from "../src/lib/municipalities";

describe("cobertura nacional", () => {
  it("não mantém uma whitelist regional de municípios", () => {
    expect(supportedMunicipalities).toEqual([]);
  });

  it("aceita municípios de diferentes regiões sem hardcode", () => {
    expect(isSupportedMunicipality("  Brejões ")).toBe(true);
    expect(isSupportedMunicipality("Salvador")).toBe(true);
    expect(isSupportedMunicipality("São Paulo")).toBe(true);
    expect(isSupportedMunicipality("Manaus")).toBe(true);
    expect(isSupportedMunicipality("   ")).toBe(false);
  });
});
