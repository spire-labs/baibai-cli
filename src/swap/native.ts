import { BASE_CHAIN_ID, NATIVE_TOKEN_ADDRESS } from "../config";
import { requireNetwork } from "../networks";

export type NativePlan =
  | "swap"
  | "unwrap"
  | "wrap"
  | "swap-then-unwrap"
  | "wrap-then-swap";

export type NativeSwapOperation = "wrap" | "unwrap";

type SwapSide = { address: string; chainId: number };

type SwapPair = { buy: SwapSide; sell: SwapSide };

const same = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

export const isNativeTokenAddress = (tokenAddress: string) =>
  same(tokenAddress, NATIVE_TOKEN_ADDRESS);

const sellsNative = ({ sell }: SwapPair) => isNativeTokenAddress(sell.address);
const buysNative = ({ buy }: SwapPair) => isNativeTokenAddress(buy.address);

const tradesAsErc20 = ({ address, chainId }: SwapSide) =>
  isNativeTokenAddress(address) &&
  requireNetwork(chainId).nativeErc20 !== undefined;

const tradedAddress = ({ address, chainId }: SwapSide) =>
  (isNativeTokenAddress(address)
    ? requireNetwork(chainId).nativeErc20
    : undefined) ?? address;

const isSameAsset = (pair: SwapPair) =>
  pair.sell.chainId === pair.buy.chainId &&
  (sellsNative(pair) || buysNative(pair)) &&
  same(tradedAddress(pair.sell), tradedAddress(pair.buy));

export const resolveNativeSwapOperation = (
  pair: SwapPair,
): NativeSwapOperation | "unsupported" | null => {
  if (!sellsNative(pair) && !buysNative(pair)) return null;

  const wrapped =
    pair.sell.chainId === pair.buy.chainId
      ? requireNetwork(pair.sell.chainId).wrappedNativeToken
      : null;
  if (wrapped && sellsNative(pair) && same(pair.buy.address, wrapped)) {
    return "wrap";
  }
  if (wrapped && buysNative(pair) && same(pair.sell.address, wrapped)) {
    return "unwrap";
  }
  return "unsupported";
};

export const shouldWrapBeforeSwap = (pair: SwapPair) =>
  resolveNativeSwapOperation(pair) === "unsupported" &&
  sellsNative(pair) &&
  !isSameAsset(pair) &&
  requireNetwork(pair.sell.chainId).wrappedNativeToken !== null;

export const shouldUnwrapAfterSwap = (pair: SwapPair) =>
  resolveNativeSwapOperation(pair) === "unsupported" &&
  buysNative(pair) &&
  pair.sell.chainId === pair.buy.chainId &&
  !isSameAsset(pair) &&
  requireNetwork(pair.buy.chainId).wrappedNativeToken !== null;

export const canRouteNativeSides = (pair: SwapPair) =>
  !isSameAsset(pair) &&
  (!sellsNative(pair) ||
    tradesAsErc20(pair.sell) ||
    shouldWrapBeforeSwap(pair)) &&
  (!buysNative(pair) ||
    tradesAsErc20(pair.buy) ||
    pair.sell.chainId !== pair.buy.chainId ||
    shouldUnwrapAfterSwap(pair));

const tradedAs = (side: SwapSide, wrap: boolean) => {
  const wrapped =
    isNativeTokenAddress(side.address) && !tradesAsErc20(side) && wrap
      ? requireNetwork(side.chainId).wrappedNativeToken
      : null;
  return (wrapped ?? tradedAddress(side)) as `0x${string}`;
};

export const resolveSwapTokens = (pair: SwapPair) => ({
  tokenIn: tradedAs(pair.sell, true),
  tokenOut: tradedAs(pair.buy, shouldUnwrapAfterSwap(pair)),
});

export const nativePlan = (
  tokenIn: string,
  tokenOut: string,
  sourceChainId: number = BASE_CHAIN_ID,
  destinationChainId: number = sourceChainId,
): NativePlan => {
  const pair = {
    buy: { address: tokenOut, chainId: destinationChainId },
    sell: { address: tokenIn, chainId: sourceChainId },
  };
  if (
    same(tradedAddress(pair.sell), tradedAddress(pair.buy)) &&
    pair.sell.chainId === pair.buy.chainId &&
    !sellsNative(pair) &&
    !buysNative(pair)
  ) {
    throw new Error("Choose two different tokens.");
  }
  const operation = resolveNativeSwapOperation(pair);
  if (operation === "wrap" || operation === "unwrap") return operation;
  if (operation === "unsupported" && !canRouteNativeSides(pair)) {
    throw new Error("Choose two different tokens.");
  }
  if (shouldWrapBeforeSwap(pair)) return "wrap-then-swap";
  if (shouldUnwrapAfterSwap(pair)) return "swap-then-unwrap";
  return "swap";
};
