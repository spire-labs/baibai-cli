import { createApi } from "../api";
import { HelpRequested, parseTradeArgs, type TradeArgs } from "../args";
import { asAddress, defaultHome } from "../config";
import { formatDuration, formatRawAmount, writeOut } from "../format";
import { approvalSpender } from "../permit";
import { promptConfirm } from "../prompt";
import type { Signer } from "../signer";
import { requireSigner } from "../signers/open";
import { parseHumanAmount } from "../swap/amounts";
import {
  approveSpender,
  depositNative,
  readAllowance,
  readBalance,
  waitForReceipt,
  withdrawNative,
} from "../swap/chain";
import { executeSwap } from "../swap/execute";
import { swapCompletedOutput, transferredOutput } from "../swap/receipt";
import { describeTrade } from "../swap/trade";
import type { TokenInfo, UserQuote } from "../types";
import { presentQuote, requestQuote, resolveRecipient } from "./quote";

const SWAP_USAGE =
  "Usage: baibai swap <amount> <tokenIn> <tokenOut> [--from <network>] [--to <network>]";

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

  const signer = await requireSigner(
    defaultHome(),
    trade.source.id,
    trade.rpcUrl,
  );
  try {
    const api = createApi(trade.apiUrl);
    const described = await describeTrade(api, trade);
    const amount = parseHumanAmount(
      trade.amount,
      trade.exactOut ? described.buy.decimals : described.sell.decimals,
    );
    const recipient = await resolveRecipient(
      api,
      trade.recipient,
      signer.address,
    );

    if (described.plan === "wrap" || described.plan === "unwrap") {
      const rpcUrl = requireTradeRpc(trade);
      await requireBalance(trade, described.sell, signer.address, amount);
      if (!(await accept(trade.yes))) return;
      const wrapped = wrappedAddress(trade, described.plan);
      if (described.plan === "wrap") {
        await depositNative(signer, wrapped, amount, trade.source.id, rpcUrl);
      } else {
        await withdrawNative(signer, wrapped, amount, trade.source.id, rpcUrl);
      }
      writeOut(
        trade.json,
        {
          amount: trade.amount,
          plan: described.plan,
          symbol: described.sell.symbol,
        },
        `${described.plan === "wrap" ? "Wrapped" : "Unwrapped"} ${trade.amount} ${described.sell.symbol}.\n`,
      );
      return;
    }

    const { buy, quotedBuy, quotedSell, sell } = described;
    if (described.plan !== "wrap-then-swap" && !trade.exactOut) {
      await requireBalance(trade, sell, signer.address, amount);
    }

    const displayed = await requestQuote({
      amount,
      api,
      buy: quotedBuy,
      destinationChainId: trade.destination.id,
      exactOut: trade.exactOut,
      owner: signer.address,
      recipient,
      sell: quotedSell,
      slippageBps: trade.slippageBps,
      sourceChainId: trade.source.id,
    });
    const presented = presentQuote({
      buy: described.plan === "swap-then-unwrap" ? buy : quotedBuy,
      destinationName: trade.destination.name,
      indicative: false,
      nowMs: Date.now(),
      quote: displayed,
      sell: described.plan === "wrap-then-swap" ? sell : quotedSell,
      sellAmount: trade.exactOut
        ? formatRawAmount(displayed.expectedAmountIn, quotedSell.decimals)
        : trade.amount,
      sourceName: trade.source.name,
    });
    if (!trade.json) {
      process.stderr.write(presented.text);
      if (described.plan === "wrap-then-swap") {
        process.stderr.write(
          `${sell.symbol} will be wrapped before the swap.\n`,
        );
      }
      if (described.plan === "swap-then-unwrap") {
        process.stderr.write(
          `${buy.symbol} will be unwrapped after the swap.\n`,
        );
      }
      if (displayed.settlement === "user") {
        process.stderr.write("You pay gas for this swap.\n");
      }
      if (displayed.settlement === "message") {
        process.stderr.write(
          "This withdrawal is signed messages. You pay no gas.\n",
        );
      }
    }
    if (!(await accept(trade.yes))) return;

    const inputAmount = trade.exactOut ? BigInt(displayed.maxAmountIn) : amount;
    if (described.plan === "wrap-then-swap" || trade.exactOut) {
      await requireBalance(
        trade,
        described.plan === "wrap-then-swap" ? sell : quotedSell,
        signer.address,
        inputAmount,
      );
    }
    if (described.plan === "wrap-then-swap") {
      await depositNative(
        signer,
        wrappedAddress(trade, "wrap"),
        inputAmount,
        trade.source.id,
        requireTradeRpc(trade),
      );
    }

    const message = displayed.settlement === "message";
    const rpcUrl = message ? trade.rpcUrl : requireTradeRpc(trade);
    const spender = message ? undefined : approvalSpender(displayed);
    const startedAt = Date.now();
    const settled = await executeSwap({
      allowance: () => {
        if (!spender || rpcUrl === undefined) return Promise.resolve(0n);
        return readAllowance(
          asAddress(quotedSell.address),
          signer.address,
          spender,
          trade.source.id,
          rpcUrl,
        );
      },
      approve: () => {
        if (!spender || rpcUrl === undefined) return Promise.resolve();
        return approveSpender(
          signer,
          asAddress(quotedSell.address),
          spender,
          trade.source.id,
          rpcUrl,
        );
      },
      authorizedAmountIn: inputAmount,
      createOrder: (input) => api.order.create.mutate(input),
      createSignedOrder: (input) => api.order.createSigned.mutate(input),
      destinationChainId: trade.destination.id,
      expectedSettlement: displayed.settlement,
      intent: trade.exactOut ? "exactOut" : "exactIn",
      minimumAmountOut: trade.exactOut
        ? amount
        : BigInt(displayed.minAmountOut),
      orderStatus: async (orderId) => api.order.status.query({ orderId }),
      owner: signer.address,
      quoteOnce: (input) => api.quote.once.query(input),
      recipient,
      recordUserPaid: (input) => api.order.recordUserPaid.mutate(input),
      requiredAllowance: inputAmount,
      sellTokenDecimals: quotedSell.decimals,
      sendUserSwap: (quote) => {
        if (rpcUrl === undefined) {
          throw new Error(`${trade.source.name} has no RPC.`);
        }
        return sendUserSwap(signer, quote, trade.source.id, rpcUrl);
      },
      signer,
      skipPreflight: trade.fast || message,
      slippageBps: trade.slippageBps,
      sourceChainId: trade.source.id,
      tokenIn: asAddress(quotedSell.address),
      tokenOut: asAddress(quotedBuy.address),
    });

    if (described.plan === "swap-then-unwrap") {
      await withdrawNative(
        signer,
        wrappedAddress(trade, "unwrap"),
        BigInt(settled.amountOut),
        trade.source.id,
        requireTradeRpc(trade),
      );
    }

    const outputToken = described.plan === "swap-then-unwrap" ? buy : quotedBuy;
    const inputToken = described.plan === "wrap-then-swap" ? sell : quotedSell;
    const filledInMs = Date.now() - startedAt;
    const result = {
      amountIn: settled.amountIn
        ? formatRawAmount(settled.amountIn, inputToken.decimals)
        : undefined,
      amountOut: formatRawAmount(settled.amountOut, outputToken.decimals),
      filledInMs,
      orderId: settled.orderId,
      settlement: settled.settlement,
      status: settled.status,
      tokenIn: inputToken.symbol,
      tokenOut: outputToken.symbol,
      txHash: settled.txHash,
    };
    writeOut(
      trade.json,
      result,
      [
        `filled in ${formatDuration(filledInMs)}`,
        `in      ${result.amountIn ?? "?"} ${result.tokenIn}`,
        `out     ${result.amountOut} ${result.tokenOut}`,
        result.orderId ? `order   ${result.orderId}` : undefined,
        `tx      ${result.txHash ?? ""}`,
        "",
      ]
        .filter((line): line is string => line !== undefined)
        .join("\n"),
    );
  } finally {
    await signer.close?.();
  }
};

const requireTradeRpc = (trade: TradeArgs) => {
  if (trade.rpcUrl === undefined) {
    throw new Error(`${trade.source.name} has no RPC.`);
  }
  return trade.rpcUrl;
};

const accept = async (yes: boolean) => yes || promptConfirm();

const wrappedAddress = (trade: TradeArgs, plan: "wrap" | "unwrap") => {
  const network = plan === "unwrap" ? trade.destination : trade.source;
  const wrapped = network.wrappedNativeToken;
  if (!wrapped) throw new Error(`${network.name} has no wrapped native token.`);
  return wrapped;
};

const requireBalance = async (
  trade: TradeArgs,
  token: TokenInfo,
  owner: `0x${string}`,
  amount: bigint,
) => {
  if (trade.fast || trade.rpcUrl === undefined) return;
  const balance = await readBalance(
    asAddress(token.address),
    owner,
    trade.source.id,
    trade.rpcUrl,
  );
  if (balance < amount) {
    throw new Error(
      `Insufficient ${token.symbol} balance. Have ${formatRawAmount(balance.toString(), token.decimals)}.`,
    );
  }
};

const sendUserSwap = async (
  signer: Signer,
  quote: UserQuote,
  chainId: number,
  rpcUrl: string,
) => {
  const transaction = quote.transactionRequest;
  const hash = await signer.sendTransaction({
    data: asAddress(transaction.data),
    to: asAddress(transaction.to),
    value: BigInt(transaction.value),
  });
  const receipt = await waitForReceipt(hash, chainId, rpcUrl);
  if (receipt.status !== "success") throw new Error("Swap transaction failed.");
  const logs = receipt.logs.map((log) => ({
    address: log.address,
    data: log.data,
    topics: log.topics,
  }));
  return {
    amountOut:
      swapCompletedOutput(logs) ??
      transferredOutput(logs, quote.tokenOut, quote.recipient) ??
      quote.expectedAmountOut,
    txHash: hash,
  };
};
