import type { Api } from "../api";
import type { TradeArgs } from "../args";
import { loadToken, loadWrappedNative } from "../tokens";
import type { TokenInfo } from "../types";
import { nativePlan, resolveSwapTokens } from "./native";

const same = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

export const describeTrade = async (
  api: Pick<Api, "tokens">,
  trade: TradeArgs,
) => {
  const sourceList = await api.tokens.list.query({ chainId: trade.source.id });
  const destinationList =
    trade.destination.id === trade.source.id
      ? sourceList
      : await api.tokens.list.query({ chainId: trade.destination.id });
  const sell = await loadToken(api, trade.source, trade.tokenIn, sourceList);
  const buy = await loadToken(
    api,
    trade.destination,
    trade.tokenOut,
    destinationList,
  );
  const plan = nativePlan(
    sell.address,
    buy.address,
    trade.source.id,
    trade.destination.id,
  );
  if (plan === "wrap" || plan === "unwrap") {
    return {
      buy,
      destinationList,
      plan,
      quotedBuy: buy,
      quotedSell: sell,
      sell,
      sourceList,
    };
  }
  const quoted = resolveSwapTokens({
    buy: { address: buy.address, chainId: trade.destination.id },
    sell: { address: sell.address, chainId: trade.source.id },
  });
  const quotedSell = same(quoted.tokenIn, sell.address)
    ? sell
    : await loadQuotedToken(api, trade.source, quoted.tokenIn, sourceList);
  const quotedBuy = same(quoted.tokenOut, buy.address)
    ? buy
    : await loadQuotedToken(
        api,
        trade.destination,
        quoted.tokenOut,
        destinationList,
      );
  return {
    buy,
    destinationList,
    plan,
    quotedBuy,
    quotedSell,
    sell,
    sourceList,
  };
};

const loadQuotedToken = async (
  api: Pick<Api, "tokens">,
  network: TradeArgs["source"],
  address: `0x${string}`,
  listed: TokenInfo[],
) => {
  const wrapped = network.wrappedNativeToken;
  if (wrapped && same(address, wrapped)) {
    return loadWrappedNative(api, network, listed);
  }
  return loadToken(api, network, address, listed);
};
