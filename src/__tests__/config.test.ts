import { describe, it, expect, afterEach } from "vitest";

// Test IS_MAINNET logic in isolation without importing the module
// (module is loaded once; we test the logic formula directly)
function isMainnet(xrplNetwork?: string, publicXrplNetwork?: string): boolean {
  return xrplNetwork !== "testnet" && publicXrplNetwork !== "testnet";
}

describe("IS_MAINNET config logic", () => {
  it("defaults to mainnet when no env var is set", () => {
    expect(isMainnet(undefined, undefined)).toBe(true);
  });

  it("is testnet when XRPL_NETWORK=testnet", () => {
    expect(isMainnet("testnet", undefined)).toBe(false);
  });

  it("is testnet when NEXT_PUBLIC_XRPL_NETWORK=testnet", () => {
    expect(isMainnet(undefined, "testnet")).toBe(false);
  });

  it("is mainnet when XRPL_NETWORK=mainnet (explicit)", () => {
    expect(isMainnet("mainnet", undefined)).toBe(true);
  });
});
