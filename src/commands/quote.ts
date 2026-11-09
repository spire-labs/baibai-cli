import type { Api } from "../api";
import { createApi } from "../api";
import { HelpRequested, parseTradeArgs, type TradeArgs } from "../args";
import { asAddress, defaultHome, INDICATIVE_OWNER } from "../config";
import { formatQuoteText, formatRawAmount, writeOut } from "../format";
import { openSigner } from "../signers/open";
import { parseHumanAmount } from "../swap/amounts";
import { describeTrade } from "../swap/trade";
import { isAddress } from "../tokens";
import type { CompetitorQuote, Quote, QuoteRequest, TokenInfo } from "../types";

export const QUOTE_USAGE =
  "Usage: baibai quote <amount> <tokenIn> <tokenOut> [--from <network>] [--to <network>]";

export const quoteIntent = (
  exactOut: boolean,
  amount: bigint,
): QuoteRequest["intent"] =>
  exactOut
    ? { amountOut: amount.toString(), type: "exactOut" }
    : { amountIn: amount.toString(), type: "exactIn" };

const competitorLine = (quote: CompetitorQuote, decimals: number) => {
  let amount = quote.amountOut;
  try {
    amount = formatRawAmount(quote.amountOut, decimals);
  } catch {
    amount = quote.amountOut;
  }
  const gas = quote.gasFeeUsd === undefined ? "" : `  gas $${quote.gasFeeUsd}`;
  return `${quote.source.padEnd(14)} ${amount}${gas}`;
};

export const presentQuote = (args: {
  buy: TokenInfo;
  competitor?: CompetitorQuote;
  destinationName: string;
  indicative: boolean;
  nowMs: number;
  quote: Quote;
  sell: TokenInfo;
  sellAmount: string;
  sourceName: string;
}) => {
  const body = {
    buy: {
      address: args.buy.address,
      amount: formatRawAmount(args.quote.expectedAmountOut, args.buy.decimals),
      chain: args.destinationName,
      symbol: args.buy.symbol,
    },
    chainIdIn: args.quote.chainIdIn,
    chainIdOut: args.quote.chainIdOut,
    expiresAtMs: args.quote.expiresAtMs,
    indicative: args.indicative,
    minAmountOut: formatRawAmount(args.quote.minAmountOut, args.buy.decimals),
    priceImpactBps: args.quote.priceImpactBps,
    quoteId: args.quote.quoteId,
    sell: {
      address: args.sell.address,
      amount: args.sellAmount,
      chain: args.sourceName,
      symbol: args.sell.symbol,
    },
    settlement: args.quote.settlement,
    slippageBps: args.quote.slippageBps,
    ...(args.quote.estimatedDurationMs === undefined
      ? {}
      : { estimatedDurationMs: args.quote.estimatedDurationMs }),
    ...(args.quote.settlement === "user" && args.quote.gasFeeUsd !== undefined
      ? { gasFeeUsd: args.quote.gasFeeUsd }
      : {}),
    ...(args.quote.settlement === "user" &&
    args.quote.sponsorMinimumUsd !== undefined
      ? { sponsorMinimumUsd: args.quote.sponsorMinimumUsd }
      : {}),
    ...(args.competitor ? { competitor: args.competitor } : {}),
  };
  const text = formatQuoteText({
    bridgeMs: args.quote.estimatedDurationMs,
    buyAmount: body.buy.amount,
    buyChain: args.destinationName,
    buySymbol: args.buy.symbol,
    competitor: args.competitor
      ? competitorLine(args.competitor, args.buy.decimals)
      : undefined,
    expiresAtMs: args.quote.expiresAtMs,
    gasFeeUsd:
      args.quote.settlement === "user" ? args.quote.gasFeeUsd : undefined,
    indicative: args.indicative,
    minAmount: body.minAmountOut,
    nowMs: args.nowMs,
    priceImpactBps: args.quote.priceImpactBps,
    sellAmount: args.sellAmount,
    sellChain: args.sourceName,
    sellSymbol: args.sell.symbol,
    settlement: args.quote.settlement,
    slippageBps: args.quote.slippageBps,
    sponsorMinimumUsd:
      args.quote.settlement === "user"
        ? args.quote.sponsorMinimumUsd
        : undefined,
  });
  return { body, text };
};

export const requestQuote = async (args: {
  amount: bigint;
  api: Pick<Api, "quote">;
  buy: TokenInfo;
  destinationChainId: number;
  exactOut: boolean;
  owner: `0x${string}`;
  recipient?: `0x${string}`;
  sell: TokenInfo;
  slippageBps: number;
  sourceChainId: number;
}) =>
  args.api.quote.once.query({
    destinationChainId: args.destinationChainId,
    intent: quoteIntent(args.exactOut, args.amount),
    owner: args.owner,
    recipient: args.recipient ?? args.owner,
    slippageBps: args.slippageBps,
    sourceChainId: args.sourceChainId,
    tokenIn: asAddress(args.sell.address),
    tokenOut: asAddress(args.buy.address),
  });

export const resolveRecipient = async (
  api: Pick<Api, "names">,
  recipient: string | undefined,
  owner: `0x${string}`,
) => {
  if (recipient === undefined) return owner;
  if (isAddress(recipient)) return recipient;
  const resolved = await api.names.resolve.query({ name: recipient });
  if (!resolved.address) throw new Error(`Could not resolve ${recipient}.`);
  return asAddress(resolved.address);
};

export const runQuote = async (args: {
  api: Api;
  buy: TokenInfo;
  nowMs?: number;
  owner?: `0x${string}`;
  sell: TokenInfo;
  trade: TradeArgs;
}) => {
  const decimals = args.trade.exactOut ? args.buy.decimals : args.sell.decimals;
  const amount = parseHumanAmount(args.trade.amount, decimals);
  const owner = args.owner ?? INDICATIVE_OWNER;
  const recipient = await resolveRecipient(
    args.api,
    args.trade.recipient,
    owner,
  );
  const quote = await requestQuote({
    amount,
    api: args.api,
    buy: args.buy,
    destinationChainId: args.trade.destination.id,
    exactOut: args.trade.exactOut,
    owner,
    recipient,
    sell: args.sell,
    slippageBps: args.trade.slippageBps,
    sourceChainId: args.trade.source.id,
  });
  return { amount, quote, recipient };
};

export const quoteCommand = async (argv: string[]) => {
  let trade: TradeArgs;
  try {
    trade = parseTradeArgs(argv, QUOTE_USAGE);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write(`${QUOTE_USAGE}\n`);
      return;
    }
    throw error;
  }
  const signer = await openSigner(defaultHome()).catch(() => undefined);
  try {
    const api = createApi(trade.apiUrl);
    const described = await describeTrade(api, trade);
    if (described.plan === "wrap" || described.plan === "unwrap") {
      const text = `${trade.amount} ${described.sell.symbol} → ${trade.amount} ${described.buy.symbol}  on ${trade.source.name}\n`;
      writeOut(
        trade.json,
        {
          amount: trade.amount,
          plan: described.plan,
          symbol: described.sell.symbol,
        },
        text,
      );
      return;
    }
    const priced = await runQuote({
      api,
      buy: described.quotedBuy,
      owner: signer?.address,
      sell: described.quotedSell,
      trade,
    });
    const owner = signer?.address ?? INDICATIVE_OWNER;
    const competitors = await api.quote.competitors
      .query({
        amountIn: priced.quote.maxAmountIn,
        destinationChainId: trade.destination.id,
        owner,
        sourceChainId: trade.source.id,
        tokenIn: asAddress(described.quotedSell.address),
        tokenOut: asAddress(described.quotedBuy.address),
      })
      .catch(() => undefined);
    const presented = presentQuote({
      buy:
        described.plan === "swap-then-unwrap"
          ? described.buy
          : described.quotedBuy,
      competitor: competitors?.secondBestQuote,
      destinationName: trade.destination.name,
      indicative: signer?.address === undefined,
      nowMs: Date.now(),
      quote: priced.quote,
      sell:
        described.plan === "wrap-then-swap"
          ? described.sell
          : described.quotedSell,
      sellAmount: trade.exactOut
        ? formatRawAmount(
            priced.quote.expectedAmountIn,
            described.quotedSell.decimals,
          )
        : trade.amount,
      sourceName: trade.source.name,
    });
    writeOut(trade.json, presented.body, presented.text);
  } finally {
    await signer?.close?.();
  }
};
