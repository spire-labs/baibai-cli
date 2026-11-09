import { ORDER_POLL_INTERVAL_MS, ORDER_POLL_TIMEOUT_MS } from "../config";
import { assertQuotePermit } from "../permit";
import type { Signer } from "../signer";
import type { Address, Order, Quote, QuoteRequest, UserQuote } from "../types";

export type SettledSwap = {
  amountIn?: string;
  amountOut: string;
  orderId?: string;
  settlement: Quote["settlement"];
  status: "filled";
  txHash?: string;
};

const inFlight = (status: Order["status"]) =>
  status === "pending" || status === "bridging";

export const executeSwap = async (args: {
  allowance: () => Promise<bigint>;
  approve: () => Promise<void>;
  authorizedAmountIn: bigint;
  createOrder: (input: {
    permit2Signature: Address;
    quote: Quote;
  }) => Promise<Order>;
  createSignedOrder?: (input: {
    quote: Quote;
    signatures: Address[];
  }) => Promise<Order>;
  destinationChainId: number;
  expectedSettlement: Quote["settlement"];
  intent: "exactIn" | "exactOut";
  intervalMs?: number;
  minimumAmountOut: bigint;
  now?: () => number;
  orderStatus: (orderId: string) => Promise<Order>;
  owner: Address;
  quoteOnce: (input: QuoteRequest) => Promise<Quote>;
  recipient: Address;
  recordUserPaid?: (input: { quote: Quote; txHash: Address }) => Promise<Order>;
  requiredAllowance: bigint;
  sellTokenDecimals?: number;
  sendUserSwap: (quote: UserQuote) => Promise<{
    amountOut: string;
    txHash: Address;
  }>;
  signer: Signer;
  skipPreflight?: boolean;
  sleep?: (ms: number) => Promise<void>;
  slippageBps: number;
  sourceChainId: number;
  timeoutMs?: number;
  tokenIn: Address;
  tokenOut: Address;
  warn?: (message: string) => void;
}): Promise<SettledSwap> => {
  if (
    !args.skipPreflight &&
    args.expectedSettlement !== "message" &&
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
    sellTokenDecimals: args.sellTokenDecimals,
    slippageBps: args.slippageBps,
    sourceChainId: args.sourceChainId,
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
  });

  if (fresh.settlement === "user") {
    const sent = await args.sendUserSwap(fresh);
    let orderId: string | undefined;
    if (args.recordUserPaid) {
      try {
        const recorded = await args.recordUserPaid({
          quote: fresh,
          txHash: sent.txHash,
        });
        orderId = recorded.orderId;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        (args.warn ?? ((message) => process.stderr.write(`${message}\n`)))(
          `Swap sent, but it was not recorded: ${detail}`,
        );
      }
    }
    return {
      amountIn: fresh.maxAmountIn,
      amountOut: sent.amountOut,
      orderId,
      settlement: "user",
      status: "filled",
      txHash: sent.txHash,
    };
  }

  const order =
    fresh.settlement === "message"
      ? await submitSignedOrder(args, fresh)
      : await args.createOrder({
          permit2Signature: await args.signer.signTypedData(
            fresh.permit2TypedData,
          ),
          quote: fresh,
        });
  const filled = await waitForFill(args, order, fresh.estimatedDurationMs);
  return {
    amountIn: filled.amountInSpent,
    amountOut: filled.amountOutDelivered ?? "",
    orderId: filled.orderId,
    settlement: fresh.settlement,
    status: "filled",
    txHash: filled.txHash,
  };
};

const submitSignedOrder = async (
  args: {
    createSignedOrder?: (input: {
      quote: Quote;
      signatures: Address[];
    }) => Promise<Order>;
    signer: Signer;
  },
  quote: Extract<Quote, { settlement: "message" }>,
) => {
  if (!args.createSignedOrder) {
    throw new Error("A withdrawal quote cannot be submitted.");
  }
  const signatures: Address[] = [];
  for (const typedData of quote.typedData) {
    signatures.push(await args.signer.signTypedData(typedData));
  }
  return args.createSignedOrder({ quote, signatures });
};

const waitForFill = async (
  args: {
    intervalMs?: number;
    now?: () => number;
    orderStatus: (orderId: string) => Promise<Order>;
    sleep?: (ms: number) => Promise<void>;
    timeoutMs?: number;
  },
  initial: Order,
  estimatedDurationMs: number | undefined,
) => {
  const now = args.now ?? Date.now;
  const sleep =
    args.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = Math.max(
    args.timeoutMs ?? ORDER_POLL_TIMEOUT_MS,
    estimatedDurationMs ?? 0,
  );
  const deadline = now() + timeoutMs;
  let order = initial;
  while (inFlight(order.status)) {
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
  return order;
};
