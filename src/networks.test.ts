import { describe, expect, test } from "bun:test";
import { lifiDiamondForChain, resolveNetwork } from "./networks";
import {
  createReferralUsernameTypedData,
  pointsSignatureDeadlineMs,
} from "./points-signing";

describe("resolveNetwork", () => {
  test("matches a slug, an alias, and a chain id", () => {
    expect(resolveNetwork("arbitrum").id).toBe(42161);
    expect(resolveNetwork("ARB").id).toBe(42161);
    expect(resolveNetwork("8453").name).toBe("Base");
  });

  test("rejects an unknown network", () => {
    expect(() => resolveNetwork("nope")).toThrow("Unknown network nope.");
  });
});

describe("lifiDiamondForChain", () => {
  test("uses the shared diamond except where a chain deploys its own", () => {
    expect(lifiDiamondForChain(8453).toLowerCase()).toBe(
      "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae",
    );
    expect(lifiDiamondForChain(999).toLowerCase()).toBe(
      "0x0a0758d937d1059c356d4714e57f5df0239bce1a",
    );
  });
});

describe("points typed data", () => {
  test("signs the BaiBai Points domain the API verifies", () => {
    const now = 1_000;
    const typed = createReferralUsernameTypedData({
      deadlineMs: pointsSignatureDeadlineMs(now),
      owner: "0x2222222222222222222222222222222222222222",
    });
    expect(typed.domain).toEqual({ name: "BaiBai Points", version: "1" });
    expect(typed.primaryType).toBe("CreateReferralUsername");
    expect(typed.message.deadline).toBe(BigInt(now + 10 * 60_000));
  });
});
