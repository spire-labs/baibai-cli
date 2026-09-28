import { createApi } from "../api";
import { HelpRequested, parseLimitArgs } from "../args";
import { defaultHome } from "../config";
import { writeOut } from "../format";
import { requireSigner } from "../signers/open";
import type { Order } from "../types";

export const ordersCommand = async (argv: string[]) => {
  let parsed: ReturnType<typeof parseLimitArgs>;
  try {
    parsed = parseLimitArgs(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write("Usage: baibai orders [--limit 20]\n");
      return;
    }
    throw error;
  }
  if (parsed.positionals.length > 0) {
    throw new Error("Usage: baibai orders [--limit 20]");
  }
  const signer = await requireSigner(defaultHome());
  try {
    const page = await createApi(parsed.apiUrl).order.byOwner.query({
      limit: parsed.limit,
      owner: signer.address,
    });
    const items = page.items.map(summarize);
    const text =
      items.length === 0
        ? "No orders\n"
        : `${items
            .map(
              (item) =>
                `${item.orderId}  ${item.status}  ${item.amountIn ?? "?"} → ${item.amountOut ?? "?"}`,
            )
            .join("\n")}\n`;
    writeOut(parsed.json, { orders: items }, text);
  } finally {
    await signer.close?.();
  }
};

export const orderCommand = async (argv: string[]) => {
  let parsed: ReturnType<typeof parseLimitArgs>;
  try {
    parsed = parseLimitArgs(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write("Usage: baibai order <orderId>\n");
      return;
    }
    throw error;
  }
  const [orderId, extra] = parsed.positionals;
  if (!orderId || extra !== undefined) {
    throw new Error("Usage: baibai order <orderId>");
  }
  const order = await createApi(parsed.apiUrl).order.status.query({ orderId });
  const summary = summarize(order);
  const lines = [
    `${summary.orderId}  ${summary.status}`,
    summary.txHash ? `tx      ${summary.txHash}` : undefined,
    summary.error,
  ].filter((line): line is string => line !== undefined);
  writeOut(parsed.json, summary, `${lines.join("\n")}\n`);
};

const summarize = (order: Order) => ({
  amountIn: order.amountInSpent ?? order.maxAmountIn,
  amountOut: order.amountOutDelivered ?? order.expectedAmountOut,
  error: order.error
    ? `${order.error.code}: ${order.error.message}`
    : undefined,
  orderId: order.orderId,
  status: order.status,
  txHash: order.txHash,
});
