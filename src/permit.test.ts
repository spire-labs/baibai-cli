import { describe, expect, test } from "bun:test";
import {
  BASE_CHAIN_ID,
  PERMIT2_ADDRESS,
  PERMIT2_PROXY_ADDRESS,
} from "./config";
import {
  assertQuotePermit,
  LIFI_DIAMOND_ADDRESS,
  readPermit2Signature,
} from "./permit";
import type { Quote } from "./types";

const OWNER = "0x2222222222222222222222222222222222222222";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const CALLDATA = "0x1234";
const CALLDATA_HASH =
  "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432";
const RAW_IN = "1000000000000000000";
const RAW_OUT = "3100000000";
const RAW_MIN = "3069000000";

const typedData = (
  spender: string = PERMIT2_PROXY_ADDRESS,
  hash = CALLDATA_HASH,
) => {
  const deadline = Math.floor(Date.now() / 1000) + 60;
  return {
    deadline,
    value: {
      domain: {
        chainId: BASE_CHAIN_ID,
        name: "Permit2",
        verifyingContract: PERMIT2_ADDRESS,
      },
      message: {
        deadline: deadline.toString(),
        nonce: "1",
        permitted: { amount: RAW_IN, token: WETH },
        spender,
        witness: {
          diamondAddress: LIFI_DIAMOND_ADDRESS,
          diamondCalldataHash: hash,
        },
      },
      primaryType: "PermitWitnessTransferFrom",
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        LiFiCall: [
          { name: "diamondAddress", type: "address" },
          { name: "diamondCalldataHash", type: "bytes32" },
        ],
        PermitWitnessTransferFrom: [
          { name: "permitted", type: "TokenPermissions" },
          { name: "spender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "witness", type: "LiFiCall" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    },
  };
};

const quote = (overrides?: {
  hash?: string;
  minAmountOut?: string;
  spender?: string;
}): Quote => {
  const typed = typedData(overrides?.spender, overrides?.hash);
  return {
    expectedAmountIn: RAW_IN,
    expectedAmountOut: RAW_OUT,
    expiresAtMs: typed.deadline * 1000,
    maxAmountIn: RAW_IN,
    minAmountOut: overrides?.minAmountOut ?? RAW_MIN,
    owner: OWNER,
    permit2TypedData: typed.value,
    priceImpactBps: 4,
    quoteId: "quote-1",
    recipient: OWNER,
    slippageBps: 100,
    tokenIn: WETH,
    tokenOut: USDC,
    venue: { lifi: { calldata: CALLDATA, step: {} } },
  };
};

const expectPermit = (value: Quote, nowMs = Date.now()) =>
  assertQuotePermit({
    authorizedAmountIn: BigInt(RAW_IN),
    intent: "exactIn",
    minimumAmountOut: BigInt(RAW_MIN),
    nowMs,
    owner: OWNER,
    quote: value,
    recipient: OWNER,
    slippageBps: 100,
    tokenIn: WETH,
    tokenOut: USDC,
  });

describe("assertQuotePermit", () => {
  test("accepts a quote that binds the requested trade", () => {
    expect(() => expectPermit(quote())).not.toThrow();
  });

  test("rejects a substituted Permit2 spender", () => {
    expect(() =>
      expectPermit(
        quote({ spender: "0x3333333333333333333333333333333333333333" }),
      ),
    ).toThrow("The backend returned an invalid Permit2 quote.");
  });

  test("rejects a calldata hash that does not match the diamond calldata", () => {
    expect(() => expectPermit(quote({ hash: `0x${"11".repeat(32)}` }))).toThrow(
      "The backend returned an invalid Permit2 quote.",
    );
  });

  test("rejects an expired quote", () => {
    const expired = quote();
    expect(() => expectPermit(expired, expired.expiresAtMs + 1)).toThrow(
      "The refreshed quote no longer matches this trade.",
    );
  });

  test("rejects a quote that delivers less than the shown minimum", () => {
    expect(() => expectPermit(quote({ minAmountOut: "1" }))).toThrow(
      "The refreshed quote is worse than the quote shown.",
    );
  });
});

describe("readPermit2Signature", () => {
  test("rejects an ERC-6492 signature", () => {
    expect(() =>
      readPermit2Signature(`0x${"ab".repeat(10)}${"6492".repeat(16)}`),
    ).toThrow(
      "Deploy this smart wallet with the token approval, then retry the swap.",
    );
  });
});
