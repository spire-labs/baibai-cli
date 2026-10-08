import { ORDER_POLL_INTERVAL_MS, ORDER_POLL_TIMEOUT_MS } from "../config";
import { assertQuotePermit } from "../permit";
import type { Signer } from "../signer";
import type { Order, Quote, QuoteRequest, UserQuote } from "../types";

export type SettledSwap = {
  amountIn?: string;
  amountOut: string;
  orderId?: string;
  settlement: Quote["settlement"];
  status: "filled";
  txHash?: string;
};

export const executeSwap = async (args: {
  allowance: () => Promise<bigint>;
  approve: () => Promise<void>;
  authorizedAmountIn: bigint;
  createOrder: (input: {
    permit2Signature: `0x${string}`;
    quote: Quote;
  }) => Promise<Order>;
  destinationChainId: number;
  expectedSettlement: Quote["settlement"];
  intent: "exactIn" | "exactOut";
  intervalMs?: number;
  minimumAmountOut: bigint;
  now?: () => number;
  orderStatus: (orderId: string) => Promise<Order>;
  owner: `0x${string}`;
  quoteOnce: (input: QuoteRequest) => Promise<Quote>;
  recipient: `0x${string}`;
  requiredAllowance: bigint;
  sendUserSwap: (quote: UserQuote) => Promise<{
    amountOut: string;
    txHash: `0x${string}`;
  }>;
  signer: Signer;
  skipPreflight?: boolean;
  sleep?: (ms: number) => Promise<void>;
  slippageBps: number;
  sourceChainId: number;
  timeoutMs?: number;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
}): Promise<SettledSwap> => {
  if (
    !args.skipPreflight &&
    (await args.allowance()) < args.requiredAllowance
  ) {
    await args.approve();
  }

  const fresh = await args.quoteOnce({
    destinationChainId: args.destinationChainId,
    intent:
      args.intent === "exactIn"
        ? { amountIn: args.authorizedAmountIn.toString(), type: "exactIn" }
        : { amountOut: args.minimumAmountOut.toString(), type: "exactOut" },
    owner: args.owner,
    recipient: args.recipient,
    slippageBps: args.slippageBps,
    sourceChainId: args.sourceChainId,
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
  });
  assertQuotePermit({
    authorizedAmountIn: args.authorizedAmountIn,
    destinationChainId: args.destinationChainId,
    expectedSettlement: args.expectedSettlement,
    intent: args.intent,
    minimumAmountOut: args.minimumAmountOut,
    nowMs: (args.now ?? Date.now)(),
    owner: args.owner,
    quote: fresh,
    recipient: args.recipient,
    slippageBps: args.slippageBps,
    sourceChainId: args.sourceChainId,
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
  });

  if (fresh.settlement === "user") {
    const sent = await args.sendUserSwap(fresh);
    return {
      amountIn: fresh.maxAmountIn,
      amountOut: sent.amountOut,
      settlement: "user",
      status: "filled",
      txHash: sent.txHash,
    };
  }

  const permit2Signature = await args.signer.signTypedData(
    fresh.permit2TypedData,
  );
  let order = await args.createOrder({
    permit2Signature,
    quote: fresh,
  });
  const now = args.now ?? Date.now;
  const sleep =
    args.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + (args.timeoutMs ?? ORDER_POLL_TIMEOUT_MS);
  while (order.status === "pending") {
    if (now() >= deadline) {
      throw new Error("Timed out waiting for the order to settle.");
    }
    await sleep(args.intervalMs ?? ORDER_POLL_INTERVAL_MS);
    order = await args.orderStatus(order.orderId);
  }
  if (order.status !== "filled") {
    const detail = order.error
      ? `${order.error.code}: ${order.error.message}`
      : order.status;
    throw new Error(detail);
  }
  if (!order.amountOutDelivered) {
    throw new Error("The fill did not report an output amount.");
  }
  return {
    amountIn: order.amountInSpent,
    amountOut: order.amountOutDelivered,
    orderId: order.orderId,
    settlement: "relayer",
    status: "filled",
    txHash: order.txHash,
  };
};
