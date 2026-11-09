import { describe, expect, test } from "bun:test";
import {
  BASE_CHAIN_ID,
  PERMIT2_ADDRESS,
  PERMIT2_PROXY_ADDRESS,
} from "../config";
import { LIFI_DIAMOND_ADDRESS } from "../permit";
import type { Signer } from "../signer";
import type {
  MessageQuote,
  Order,
  Quote,
  RelayerQuote,
  UserQuote,
} from "../types";
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

const quote = (spender: string = PERMIT2_PROXY_ADDRESS): RelayerQuote => {
  const deadline = Math.floor(Date.now() / 1000) + 60;
  return {
    attestation: "attest",
    chainIdIn: BASE_CHAIN_ID,
    chainIdOut: BASE_CHAIN_ID,
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
    settlement: "relayer" as const,
    slippageBps: 100,
    tokenIn: WETH,
    tokenOut: USDC,
    venue: { lifi: { calldata: CALLDATA, step: {} } },
  };
};

const order = (status: Order["status"], error?: Order["error"]): Order => ({
  chainIdIn: BASE_CHAIN_ID,
  chainIdOut: BASE_CHAIN_ID,
  createdAtMs: 0,
  error,
  expectedAmountOut: RAW_OUT,
  maxAmountIn: RAW_IN,
  orderId: "order-1",
  owner: OWNER,
  quoteId: "quote-1",
  settlement: "relayer",
  status,
  updatedAtMs: 0,
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

const run = (args: {
  allowance: bigint;
  fresh?: Quote;
  recordUserPaid?: (input: {
    quote: Quote;
    txHash: `0x${string}`;
  }) => Promise<Order>;
  sellTokenDecimals?: number;
  skipPreflight?: boolean;
  status?: Order;
  statuses?: Order["status"][];
  warn?: (message: string) => void;
}) => {
  const wallet = signer();
  const approvals: string[] = [];
  let allowanceReads = 0;
  let statusReads = 0;
  const created: Array<{ permit2Signature: string; quoteId: string }> = [];
  const signed: Array<{ quoteId: string; signatures: string[] }> = [];
  const promise = executeSwap({
    allowance: async () => {
      allowanceReads += 1;
      return args.allowance;
    },
    approve: async () => {
      approvals.push("approve");
    },
    authorizedAmountIn: BigInt(RAW_IN),
    createOrder: async (input) => {
      created.push({
        permit2Signature: input.permit2Signature,
        quoteId: input.quote.quoteId,
      });
      return args.status ?? order("pending");
    },
    createSignedOrder: async (input) => {
      signed.push({
        quoteId: input.quote.quoteId,
        signatures: input.signatures,
      });
      return args.status ?? order("pending");
    },
    destinationChainId: BASE_CHAIN_ID,
    expectedSettlement: (args.fresh ?? quote()).settlement,
    intent: "exactIn",
    minimumAmountOut: BigInt(RAW_MIN),
    orderStatus: async () => {
      if (args.statuses) {
        const status = args.statuses[statusReads] ?? "filled";
        statusReads += 1;
        return order(status);
      }
      return args.status ?? order("filled");
    },
    owner: OWNER,
    quoteOnce: async () => args.fresh ?? quote(),
    recipient: OWNER,
    recordUserPaid: args.recordUserPaid,
    requiredAllowance: BigInt(RAW_IN),
    sellTokenDecimals: args.sellTokenDecimals,
    sendUserSwap: async () => {
      wallet.calls.push("send");
      return { amountOut: RAW_OUT, txHash: `0x${"cd".repeat(32)}` };
    },
    signer: wallet,
    skipPreflight: args.skipPreflight,
    sleep: async () => undefined,
    slippageBps: 100,
    sourceChainId: BASE_CHAIN_ID,
    tokenIn: WETH,
    tokenOut: USDC,
    warn: args.warn,
  });
  return { allowanceReads, approvals, created, promise, signed, wallet };
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

  test("submits without reading allowance when preflight is skipped", async () => {
    const { allowanceReads, approvals, promise, wallet } = run({
      allowance: 0n,
      skipPreflight: true,
    });
    const filled = await promise;
    expect(allowanceReads).toBe(0);
    expect(approvals).toEqual([]);
    expect(wallet.calls).toEqual(["sign"]);
    expect(filled.status).toBe("filled");
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

  test("submits the quote that was signed", async () => {
    const { created, promise } = run({ allowance: BigInt(RAW_IN) });
    await promise;
    expect(created).toEqual([
      {
        permit2Signature: `0x${"ab".repeat(65)}`,
        quoteId: "quote-1",
      },
    ]);
  });

  test("broadcasts an owner-paid quote without signing", async () => {
    const {
      permit2TypedData: _typed,
      settlement: _settlement,
      venue: _venue,
      ...rest
    } = quote();
    const fresh: UserQuote = {
      ...rest,
      settlement: "user",
      transactionRequest: {
        chainId: BASE_CHAIN_ID,
        data: CALLDATA,
        to: LIFI_DIAMOND_ADDRESS,
        value: "0",
      },
      venue: { lifi: { calldata: CALLDATA, step: {} } },
    };
    const { created, promise, wallet } = run({
      allowance: BigInt(RAW_IN),
      fresh,
    });
    const filled = await promise;
    expect(wallet.calls).toEqual(["send"]);
    expect(created).toEqual([]);
    expect(filled.settlement).toBe("user");
    expect(filled.txHash).toBe(`0x${"cd".repeat(32)}`);
  });

  test("waits through a bridging order", async () => {
    const { promise } = run({
      allowance: BigInt(RAW_IN),
      statuses: ["bridging", "filled"],
    });
    const filled = await promise;
    expect(filled.status).toBe("filled");
    expect(filled.orderId).toBe("order-1");
  });

  test("records an owner-paid swap and keeps the fill when recording fails", async () => {
    const {
      permit2TypedData: _typed,
      settlement: _settlement,
      venue: _venue,
      ...rest
    } = quote();
    const fresh: UserQuote = {
      ...rest,
      settlement: "user",
      transactionRequest: {
        chainId: BASE_CHAIN_ID,
        data: CALLDATA,
        to: LIFI_DIAMOND_ADDRESS,
        value: "0",
      },
      venue: { lifi: { calldata: CALLDATA, step: {} } },
    };
    const warnings: string[] = [];
    const { promise } = run({
      allowance: BigInt(RAW_IN),
      fresh,
      recordUserPaid: async () => {
        throw new Error("history unavailable");
      },
      warn: (message) => {
        warnings.push(message);
      },
    });
    const filled = await promise;
    expect(filled.settlement).toBe("user");
    expect(filled.txHash).toBe(`0x${"cd".repeat(32)}`);
    expect(warnings).toEqual([
      "Swap sent, but it was not recorded: history unavailable",
    ]);
  });

  test("signs a withdrawal and submits the signatures", async () => {
    const fresh: MessageQuote = {
      attestation: "attest",
      chainIdIn: BASE_CHAIN_ID,
      chainIdOut: BASE_CHAIN_ID,
      expectedAmountIn: RAW_IN,
      expectedAmountOut: RAW_OUT,
      expiresAtMs: Date.now() + 180_000,
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
    const { allowanceReads, promise, signed, wallet } = run({
      allowance: 0n,
      fresh,
      sellTokenDecimals: 18,
    });
    const filled = await promise;
    expect(allowanceReads).toBe(0);
    expect(wallet.calls).toEqual(["sign"]);
    expect(signed).toEqual([
      { quoteId: "quote-1", signatures: [`0x${"ab".repeat(65)}`] },
    ]);
    expect(filled.settlement).toBe("message");
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
