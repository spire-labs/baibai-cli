import { describe, expect, test } from "bun:test";
import {
  BASE_CHAIN_ID,
  PERMIT2_ADDRESS,
  PERMIT2_PROXY_ADDRESS,
} from "./config";
import { BASE_KYBER_SETTLER, KYBER_ROUTER } from "./networks";
import {
  assertQuotePermit,
  LIFI_DIAMOND_ADDRESS,
  readPermit2Signature,
} from "./permit";
import type { MessageQuote, RelayerQuote, UserQuote } from "./types";

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
}): RelayerQuote => {
  const typed = typedData(overrides?.spender, overrides?.hash);
  return {
    attestation: "attest",
    chainIdIn: BASE_CHAIN_ID,
    chainIdOut: BASE_CHAIN_ID,
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
    settlement: "relayer",
    slippageBps: 100,
    tokenIn: WETH,
    tokenOut: USDC,
    venue: { lifi: { calldata: CALLDATA, step: {} } },
  };
};

const userQuote = (to: `0x${string}`): UserQuote => {
  const {
    permit2TypedData: _typed,
    settlement: _settlement,
    venue: _venue,
    ...rest
  } = quote();
  return {
    ...rest,
    settlement: "user",
    transactionRequest: {
      chainId: BASE_CHAIN_ID,
      data: CALLDATA,
      to,
      value: "0",
    },
    venue: { lifi: { calldata: CALLDATA, step: {} } },
  };
};

const expectPermit = (value: RelayerQuote | UserQuote, nowMs = Date.now()) =>
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

  test("accepts a gasless Kyber quote signed against the settler", () => {
    const value = quote();
    const deadline = Math.floor(value.expiresAtMs / 1000);
    expect(() =>
      expectPermit({
        ...value,
        permit2TypedData: {
          domain: value.permit2TypedData.domain,
          message: {
            deadline: deadline.toString(),
            nonce: "1",
            permitted: { amount: RAW_IN, token: WETH },
            spender: BASE_KYBER_SETTLER,
            witness: {
              minAmountOut: RAW_MIN,
              recipient: OWNER,
              tokenOut: USDC,
            },
          },
          primaryType: "PermitWitnessTransferFrom",
          types: {
            EIP712Domain: [
              { name: "name", type: "string" },
              { name: "chainId", type: "uint256" },
              { name: "verifyingContract", type: "address" },
            ],
            OrderWitness: [
              { name: "recipient", type: "address" },
              { name: "tokenOut", type: "address" },
              { name: "minAmountOut", type: "uint256" },
            ],
            PermitWitnessTransferFrom: [
              { name: "permitted", type: "TokenPermissions" },
              { name: "spender", type: "address" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" },
              { name: "witness", type: "OrderWitness" },
            ],
            TokenPermissions: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
        },
        venue: { kyber: { routeSummary: {} } },
      }),
    ).not.toThrow();
  });

  test("accepts a withdrawal inside its longer lifetime", () => {
    const now = 1_700_000_000_000;
    const withdrawal: MessageQuote = {
      attestation: "attest",
      chainIdIn: BASE_CHAIN_ID,
      chainIdOut: BASE_CHAIN_ID,
      expectedAmountIn: RAW_IN,
      expectedAmountOut: RAW_OUT,
      expiresAtMs: now + 180_000,
      maxAmountIn: RAW_IN,
      minAmountOut: RAW_MIN,
      owner: OWNER,
      priceImpactBps: 0,
      quoteId: "quote-1",
      recipient: OWNER,
      settlement: "message",
      slippageBps: 100,
      tokenIn: WETH,
      tokenOut: USDC,
      typedData: [
        {
          domain: { name: "HyperliquidSignTransaction" },
          message: {
            amount: "1",
            destination: OWNER,
            hyperliquidChain: "Mainnet",
          },
          primaryType: "HyperliquidTransaction:Withdraw",
          types: {},
        },
      ],
      venue: { lifi: {} },
    };
    expect(() =>
      assertQuotePermit({
        authorizedAmountIn: BigInt(RAW_IN),
        intent: "exactIn",
        minimumAmountOut: BigInt(RAW_MIN),
        nowMs: now,
        owner: OWNER,
        quote: withdrawal,
        recipient: OWNER,
        sellTokenDecimals: 18,
        slippageBps: 100,
        tokenIn: WETH,
        tokenOut: USDC,
      }),
    ).not.toThrow();
    expect(() =>
      assertQuotePermit({
        authorizedAmountIn: BigInt(RAW_IN),
        intent: "exactIn",
        minimumAmountOut: BigInt(RAW_MIN),
        nowMs: now,
        owner: OWNER,
        quote: { ...withdrawal, expiresAtMs: now + 241_000 },
        recipient: OWNER,
        sellTokenDecimals: 18,
        slippageBps: 100,
        tokenIn: WETH,
        tokenOut: USDC,
      }),
    ).toThrow("The refreshed quote no longer matches this trade.");
  });

  test("rejects a withdrawal that signs anything except the USDC move", () => {
    const now = Date.now();
    const withdrawal: MessageQuote = {
      attestation: "attest",
      chainIdIn: BASE_CHAIN_ID,
      chainIdOut: BASE_CHAIN_ID,
      expectedAmountIn: RAW_IN,
      expectedAmountOut: RAW_OUT,
      expiresAtMs: now + 60_000,
      maxAmountIn: RAW_IN,
      minAmountOut: RAW_MIN,
      owner: OWNER,
      priceImpactBps: 0,
      quoteId: "quote-1",
      recipient: OWNER,
      settlement: "message",
      slippageBps: 100,
      tokenIn: WETH,
      tokenOut: USDC,
      typedData: [
        {
          domain: { name: "HyperliquidSignTransaction" },
          message: {
            amount: "1",
            destination: "0x3333333333333333333333333333333333333333",
            hyperliquidChain: "Mainnet",
          },
          primaryType: "HyperliquidTransaction:Withdraw",
          types: {},
        },
      ],
      venue: { lifi: {} },
    };
    expect(() =>
      assertQuotePermit({
        authorizedAmountIn: BigInt(RAW_IN),
        intent: "exactIn",
        minimumAmountOut: BigInt(RAW_MIN),
        nowMs: now,
        owner: OWNER,
        quote: withdrawal,
        recipient: OWNER,
        sellTokenDecimals: 18,
        slippageBps: 100,
        tokenIn: WETH,
        tokenOut: USDC,
      }),
    ).toThrow("The backend returned an invalid withdrawal to sign.");
  });

  test("accepts an owner-paid swap sent to the quoted router", () => {
    expect(() => expectPermit(userQuote(LIFI_DIAMOND_ADDRESS))).not.toThrow();
  });

  test("rejects an owner-paid swap aimed at another router", () => {
    expect(() => expectPermit(userQuote(KYBER_ROUTER))).toThrow(
      "The backend returned an invalid swap transaction.",
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
