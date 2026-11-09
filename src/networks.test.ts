import { describe, expect, test } from "bun:test";
import { lifiDiamondForChain, resolveNetwork } from "./networks";
import {
  commitGoalTypedData,
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

  test("matches the app's settlement networks", () => {
    expect(resolveNetwork("robinhood").kyberSettler?.toLowerCase()).toBe(
      "0x551f25e294f9dae56463a62dbcfd063ca8785b83",
    );
    expect(resolveNetwork("hypercore")).toMatchObject({
      id: 1337,
      rpcUrl: undefined,
    });
    expect(() => resolveNetwork("blast")).toThrow("Unknown network blast.");
    expect(() => resolveNetwork("lens")).toThrow("Unknown network lens.");
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

  test("signs a points commit the API verifies", () => {
    const typed = commitGoalTypedData({
      deadlineMs: 5_000,
      goalUsd: 1000,
      owner: "0x2222222222222222222222222222222222222222",
    });
    expect(typed.primaryType).toBe("CommitGoal");
    expect(typed.message).toEqual({
      deadline: 5_000n,
      goalUsd: 1_000n,
      owner: "0x2222222222222222222222222222222222222222",
    });
  });
});
