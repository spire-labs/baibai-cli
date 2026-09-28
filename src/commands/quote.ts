import type { Api } from "../api";
import { createApi } from "../api";
import { HelpRequested, parseTradeArgs, type TradeArgs } from "../args";
import { asAddress, defaultHome, INDICATIVE_OWNER } from "../config";
import { formatQuoteText, formatRawAmount, writeOut } from "../format";
import { openSigner } from "../signers/open";
import { parseHumanAmount } from "../swap/amounts";
import { isAddress, resolveSymbol, tokenByAddress } from "../tokens";
import type { Quote, QuoteRequest, TokenInfo } from "../types";

export const QUOTE_USAGE = "Usage: baibai quote <amount> <tokenIn> <tokenOut>";

export const loadToken = async (
  input: string,
  tokens: TokenInfo[],
  getByAddress: (address: `0x${string}`) => Promise<TokenInfo>,
) => {
  if (isAddress(input)) {
    return (
      tokenByAddress(input, tokens) ??
      getByAddress(input.toLowerCase() as `0x${string}`)
    );
  }
  return resolveSymbol(input, tokens);
};

export const quoteIntent = (
  exactOut: boolean,
  amount: bigint,
): QuoteRequest["intent"] =>
  exactOut
    ? { amountOut: amount.toString(), type: "exactOut" }
    : { amountIn: amount.toString(), type: "exactIn" };

export const presentQuote = (args: {
  buy: TokenInfo;
  indicative: boolean;
  nowMs: number;
  quote: Quote;
  sell: TokenInfo;
  sellAmount: string;
}) => {
  const body = {
    buy: {
      address: args.buy.address,
      amount: formatRawAmount(args.quote.expectedAmountOut, args.buy.decimals),
      symbol: args.buy.symbol,
    },
    expiresAtMs: args.quote.expiresAtMs,
    indicative: args.indicative,
    minAmountOut: formatRawAmount(args.quote.minAmountOut, args.buy.decimals),
    priceImpactBps: args.quote.priceImpactBps,
    quoteId: args.quote.quoteId,
    sell: {
      address: args.sell.address,
      amount: args.sellAmount,
      symbol: args.sell.symbol,
    },
    slippageBps: args.quote.slippageBps,
  };
  const text = formatQuoteText({
    buyAmount: body.buy.amount,
    buySymbol: args.buy.symbol,
    expiresAtMs: args.quote.expiresAtMs,
    indicative: args.indicative,
    minAmount: body.minAmountOut,
    nowMs: args.nowMs,
    priceImpactBps: args.quote.priceImpactBps,
    sellAmount: args.sellAmount,
    sellSymbol: args.sell.symbol,
    slippageBps: args.quote.slippageBps,
  });
  return { body, text };
};

export const requestQuote = async (args: {
  amount: bigint;
  api: Pick<Api, "quote">;
  exactOut: boolean;
  owner: `0x${string}`;
  recipient?: `0x${string}`;
  sell: TokenInfo;
  buy: TokenInfo;
  slippageBps: number;
}) =>
  args.api.quote.once.query({
    intent: quoteIntent(args.exactOut, args.amount),
    owner: args.owner,
    recipient: args.recipient ?? args.owner,
    slippageBps: args.slippageBps,
    tokenIn: asAddress(args.sell.address),
    tokenOut: asAddress(args.buy.address),
  });

export const runQuote = async (args: {
  api: Api;
  nowMs?: number;
  owner?: `0x${string}`;
  trade: TradeArgs;
}) => {
  const listed = await args.api.tokens.list.query();
  const getByAddress = async (address: `0x${string}`) =>
    args.api.tokens.get.query({ address });
  const sell = await loadToken(args.trade.tokenIn, listed, getByAddress);
  const buy = await loadToken(args.trade.tokenOut, listed, getByAddress);
  if (sell.address.toLowerCase() === buy.address.toLowerCase()) {
    throw new Error("Choose two different tokens.");
  }
  const decimals = args.trade.exactOut ? buy.decimals : sell.decimals;
  const amount = parseHumanAmount(args.trade.amount, decimals);
  const owner = args.owner ?? INDICATIVE_OWNER;
  const quote = await requestQuote({
    amount,
    api: args.api,
    buy,
    exactOut: args.trade.exactOut,
    owner,
    recipient: args.trade.recipient,
    sell,
    slippageBps: args.trade.slippageBps,
  });
  return presentQuote({
    buy,
    indicative: args.owner === undefined,
    nowMs: args.nowMs ?? Date.now(),
    quote,
    sell,
    sellAmount: args.trade.exactOut
      ? formatRawAmount(quote.expectedAmountIn, sell.decimals)
      : args.trade.amount,
  });
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
  const presented = await runQuote({
    api: createApi(trade.apiUrl),
    owner: signer?.address,
    trade,
  });
  await signer?.close?.();
  writeOut(trade.json, presented.body, presented.text);
};
