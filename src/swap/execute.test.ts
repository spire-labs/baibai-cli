import { describe, expect, test } from "bun:test";
import {
  BASE_CHAIN_ID,
  PERMIT2_ADDRESS,
  PERMIT2_PROXY_ADDRESS,
} from "../config";
import { LIFI_DIAMOND_ADDRESS } from "../permit";
import type { Signer } from "../signer";
import type { Order, Quote } from "../types";
import { executeSwap } from "./execute";

const OWNER = "0x2222222222222222222222222222222222222222" as const;
const WETH = "0x4200000000000000000000000000000000000006" as const;
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const;
const CALLDATA = "0x1234";
const CALLDATA_HASH =
  "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432";
const RAW_IN = "1000000000000000000";
const RAW_OUT = "3100000000";
const RAW_MIN = "3069000000";

const quote = (spender: string = PERMIT2_PROXY_ADDRESS): Quote => {
  const deadline = Math.floor(Date.now() / 1000) + 60;
  return {
    expectedAmountIn: RAW_IN,
    expectedAmountOut: RAW_OUT,
    expiresAtMs: deadline * 1000,
    maxAmountIn: RAW_IN,
    minAmountOut: RAW_MIN,
    owner: OWNER,
    permit2TypedData: {
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
          diamondCalldataHash: CALLDATA_HASH,
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
    priceImpactBps: 4,
    quoteId: "quote-1",
    recipient: OWNER,
    slippageBps: 100,
    tokenIn: WETH,
    tokenOut: USDC,
    venue: { lifi: { calldata: CALLDATA, step: {} } },
  };
};

const order = (status: Order["status"], error?: Order["error"]): Order => ({
  error,
  expectedAmountOut: RAW_OUT,
  maxAmountIn: RAW_IN,
  orderId: "order-1",
  owner: OWNER,
  quoteId: "quote-1",
  status,
  ...(status === "filled"
    ? {
        amountInSpent: RAW_IN,
        amountOutDelivered: RAW_OUT,
        txHash: `0x${"cd".repeat(32)}` as const,
      }
    : {}),
});

const signer = (): Signer & { calls: string[] } => {
  const calls: string[] = [];
  return {
    address: OWNER,
    calls,
    kind: "key",
    sendTransaction: async () => {
      calls.push("tx");
      return `0x${"cd".repeat(32)}`;
    },
    signTypedData: async () => {
      calls.push("sign");
      return `0x${"ab".repeat(65)}`;
    },
  };
};

const run = (args: { allowance: bigint; fresh?: Quote; status?: Order }) => {
  const wallet = signer();
  const approvals: string[] = [];
  const promise = executeSwap({
    allowance: async () => args.allowance,
    approve: async () => {
      approvals.push("approve");
    },
    sleep: async () => undefined,
    authorizedAmountIn: BigInt(RAW_IN),
    createOrder: async () => args.status ?? order("pending"),
    intent: "exactIn",
    minimumAmountOut: BigInt(RAW_MIN),
    orderStatus: async () => args.status ?? order("filled"),
    owner: OWNER,
    quoteOnce: async () => args.fresh ?? quote(),
    recipient: OWNER,
    requiredAllowance: BigInt(RAW_IN),
    signer: wallet,
    slippageBps: 100,
    tokenIn: WETH,
    tokenOut: USDC,
  });
  return { approvals, promise, wallet };
};

describe("executeSwap", () => {
  test("skips approval when the allowance covers the trade", async () => {
    const { approvals, promise, wallet } = run({ allowance: BigInt(RAW_IN) });
    const filled = await promise;
    expect(approvals).toEqual([]);
    expect(wallet.calls).toEqual(["sign"]);
    expect(filled.status).toBe("filled");
    expect(filled.txHash).toBe(`0x${"cd".repeat(32)}`);
  });

  test("approves Permit2 when the allowance is short", async () => {
    const { approvals, promise, wallet } = run({ allowance: 0n });
    await promise;
    expect(approvals).toEqual(["approve"]);
    expect(wallet.calls).toEqual(["sign"]);
  });

  test("surfaces a failed order", async () => {
    const failed = order("failed", {
      code: "FILL_FAILED",
      message: "the swap reverted",
    });
    const { promise } = run({ allowance: BigInt(RAW_IN), status: failed });
    await expect(promise).rejects.toThrow("FILL_FAILED: the swap reverted");
  });

  test("does not sign a quote with a substituted spender", async () => {
    const { promise, wallet } = run({
      allowance: BigInt(RAW_IN),
      fresh: quote("0x3333333333333333333333333333333333333333"),
    });
    await expect(promise).rejects.toThrow("invalid Permit2 quote");
    expect(wallet.calls).toEqual([]);
  });
});
