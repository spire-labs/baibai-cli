import { NATIVE_TOKEN_ADDRESS, WRAPPED_NATIVE_ADDRESS } from "../config";

export type NativePlan =
  | "swap"
  | "unwrap"
  | "wrap"
  | "swap-then-unwrap"
  | "wrap-then-swap";

const same = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

export const nativePlan = (tokenIn: string, tokenOut: string): NativePlan => {
  const sellsNative = same(tokenIn, NATIVE_TOKEN_ADDRESS);
  const buysNative = same(tokenOut, NATIVE_TOKEN_ADDRESS);
  if (sellsNative && buysNative) {
    throw new Error("Choose two different tokens.");
  }
  const sellsWrapped = same(tokenIn, WRAPPED_NATIVE_ADDRESS);
  const buysWrapped = same(tokenOut, WRAPPED_NATIVE_ADDRESS);
  if (sellsNative && buysWrapped) return "wrap";
  if (sellsWrapped && buysNative) return "unwrap";
  if (sellsNative) return "wrap-then-swap";
  if (buysNative) return "swap-then-unwrap";
  return "swap";
};
