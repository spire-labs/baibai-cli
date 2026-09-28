import { createApi } from "../api";
import { HelpRequested, parseTradeArgs } from "../args";
import { asAddress, defaultHome, WRAPPED_NATIVE_ADDRESS } from "../config";
import { formatRawAmount, writeOut } from "../format";
import { promptConfirm } from "../prompt";
import { requireSigner } from "../signers/open";
import { parseHumanAmount } from "../swap/amounts";
import {
  approvePermit2,
  depositNative,
  readAllowance,
  readBalance,
  withdrawNative,
} from "../swap/chain";
import { executeSwap } from "../swap/execute";
import { nativePlan } from "../swap/native";
import { isAddress, resolveSymbol, tokenByAddress } from "../tokens";
import type { TokenInfo } from "../types";
import { presentQuote, requestQuote } from "./quote";

const SWAP_USAGE = "Usage: baibai swap <amount> <tokenIn> <tokenOut>";

export const swapCommand = async (argv: string[]) => {
  let trade: ReturnType<typeof parseTradeArgs>;
  try {
    trade = parseTradeArgs(argv, SWAP_USAGE);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write(`${SWAP_USAGE}\n`);
      return;
    }
    throw error;
  }

  const signer = await requireSigner(defaultHome());
  try {
    const api = createApi(trade.apiUrl);
    const listed = await api.tokens.list.query();
    const load = async (input: string) => {
      if (!isAddress(input)) return resolveSymbol(input, listed);
      return (
        tokenByAddress(input, listed) ??
        api.tokens.get.query({
          address: input.toLowerCase() as `0x${string}`,
        })
      );
    };
    const tokenIn = await load(trade.tokenIn);
    const tokenOut = await load(trade.tokenOut);
    const plan = nativePlan(tokenIn.address, tokenOut.address);
    const amount = parseHumanAmount(
      trade.amount,
      trade.exactOut ? tokenOut.decimals : tokenIn.decimals,
    );
    const recipient = trade.recipient ?? signer.address;

    if (plan === "wrap" || plan === "unwrap") {
      await ensureBalance(tokenIn, signer.address, amount);
      if (!(await accept(trade.yes))) return;
      if (plan === "wrap") await depositNative(signer, amount);
      else await withdrawNative(signer, amount);
      writeOut(
        trade.json,
        { amount: trade.amount, plan, symbol: tokenIn.symbol },
        `${plan === "wrap" ? "Wrapped" : "Unwrapped"} ${trade.amount} ${tokenIn.symbol}.\n`,
      );
      return;
    }

    const sell = plan === "wrap-then-swap" ? wrappedToken(listed) : tokenIn;
    const buy = plan === "swap-then-unwrap" ? wrappedToken(listed) : tokenOut;
    if (plan !== "wrap-then-swap" && !trade.exactOut) {
      await ensureBalance(sell, signer.address, amount);
    }

    const displayed = await requestQuote({
      amount,
      api,
      buy,
      exactOut: trade.exactOut,
      owner: signer.address,
      recipient,
      sell,
      slippageBps: trade.slippageBps,
    });
    const presented = presentQuote({
      buy: plan === "swap-then-unwrap" ? tokenOut : buy,
      indicative: false,
      nowMs: Date.now(),
      quote: displayed,
      sell: plan === "wrap-then-swap" ? tokenIn : sell,
      sellAmount: trade.exactOut
        ? formatRawAmount(displayed.expectedAmountIn, sell.decimals)
        : trade.amount,
    });
    if (!trade.json) {
      process.stderr.write(presented.text);
      if (plan === "wrap-then-swap") {
        process.stderr.write("ETH will be wrapped to WETH before the swap.\n");
      }
      if (plan === "swap-then-unwrap") {
        process.stderr.write("WETH will be unwrapped to ETH after the swap.\n");
      }
    }
    if (!(await accept(trade.yes))) return;

    const inputAmount = trade.exactOut ? BigInt(displayed.maxAmountIn) : amount;
    if (plan === "wrap-then-swap" || trade.exactOut) {
      await ensureBalance(
        plan === "wrap-then-swap" ? tokenIn : sell,
        signer.address,
        inputAmount,
      );
    }
    if (plan === "wrap-then-swap") await depositNative(signer, inputAmount);

    const order = await executeSwap({
      allowance: () => readAllowance(asAddress(sell.address), signer.address),
      approve: () => approvePermit2(signer, asAddress(sell.address)),
      authorizedAmountIn: inputAmount,
      createOrder: (input) => api.order.create.mutate(input),
      intent: trade.exactOut ? "exactOut" : "exactIn",
      minimumAmountOut: trade.exactOut
        ? amount
        : BigInt(displayed.minAmountOut),
      orderStatus: async (orderId) => api.order.status.query({ orderId }),
      owner: signer.address,
      quoteOnce: (input) => api.quote.once.query(input),
      recipient,
      requiredAllowance: inputAmount,
      signer,
      slippageBps: trade.slippageBps,
      tokenIn: asAddress(sell.address),
      tokenOut: asAddress(buy.address),
    });

    if (plan === "swap-then-unwrap") {
      if (!order.amountOutDelivered) {
        throw new Error("The fill did not report an output amount to unwrap.");
      }
      await withdrawNative(signer, BigInt(order.amountOutDelivered));
    }

    const outputToken = plan === "swap-then-unwrap" ? tokenOut : buy;
    const inputToken = plan === "wrap-then-swap" ? tokenIn : sell;
    const result = {
      amountIn: order.amountInSpent
        ? formatRawAmount(order.amountInSpent, inputToken.decimals)
        : undefined,
      amountOut: order.amountOutDelivered
        ? formatRawAmount(order.amountOutDelivered, outputToken.decimals)
        : undefined,
      orderId: order.orderId,
      status: order.status,
      tokenIn: inputToken.symbol,
      tokenOut: outputToken.symbol,
      txHash: order.txHash,
    };
    writeOut(
      trade.json,
      result,
      [
        "filled",
        `in      ${result.amountIn ?? "?"} ${result.tokenIn}`,
        `out     ${result.amountOut ?? "?"} ${result.tokenOut}`,
        `tx      ${result.txHash ?? ""}`,
        "",
      ].join("\n"),
    );
  } finally {
    await signer.close?.();
  }
};

const accept = async (yes: boolean) => yes || promptConfirm();

const wrappedToken = (tokens: TokenInfo[]) => {
  const token = tokenByAddress(WRAPPED_NATIVE_ADDRESS, tokens);
  if (!token) throw new Error("WETH is not in the token list.");
  return token;
};

const ensureBalance = async (
  token: TokenInfo,
  owner: `0x${string}`,
  amount: bigint,
) => {
  const balance = await readBalance(asAddress(token.address), owner);
  if (balance < amount) {
    throw new Error(
      `Insufficient ${token.symbol} balance. Have ${formatRawAmount(balance.toString(), token.decimals)}.`,
    );
  }
};
