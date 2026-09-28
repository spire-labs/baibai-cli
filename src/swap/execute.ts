import { ORDER_POLL_INTERVAL_MS, ORDER_POLL_TIMEOUT_MS } from "../config";
import { assertQuotePermit } from "../permit";
import type { Signer } from "../signer";
import type { Order, Quote, QuoteRequest } from "../types";

export const executeSwap = async (args: {
  allowance: () => Promise<bigint>;
  approve: () => Promise<void>;
  authorizedAmountIn: bigint;
  createOrder: (input: {
    permit2Signature: `0x${string}`;
    quoteId: string;
  }) => Promise<Order>;
  intent: "exactIn" | "exactOut";
  intervalMs?: number;
  minimumAmountOut: bigint;
  now?: () => number;
  orderStatus: (orderId: string) => Promise<Order>;
  owner: `0x${string}`;
  quoteOnce: (input: QuoteRequest) => Promise<Quote>;
  recipient: `0x${string}`;
  requiredAllowance: bigint;
  signer: Signer;
  skipPreflight?: boolean;
  sleep?: (ms: number) => Promise<void>;
  slippageBps: number;
  timeoutMs?: number;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
}) => {
  if (
    !args.skipPreflight &&
    (await args.allowance()) < args.requiredAllowance
  ) {
    await args.approve();
  }

  const fresh = await args.quoteOnce({
    intent:
      args.intent === "exactIn"
        ? { amountIn: args.authorizedAmountIn.toString(), type: "exactIn" }
        : { amountOut: args.minimumAmountOut.toString(), type: "exactOut" },
    owner: args.owner,
    recipient: args.recipient,
    slippageBps: args.slippageBps,
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
  });
  assertQuotePermit({
    authorizedAmountIn: args.authorizedAmountIn,
    intent: args.intent,
    minimumAmountOut: args.minimumAmountOut,
    nowMs: (args.now ?? Date.now)(),
    owner: args.owner,
    quote: fresh,
    recipient: args.recipient,
    slippageBps: args.slippageBps,
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
  });

  const permit2Signature = await args.signer.signTypedData(
    fresh.permit2TypedData,
  );
  let order = await args.createOrder({
    permit2Signature,
    quoteId: fresh.quoteId,
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
  return order;
};
