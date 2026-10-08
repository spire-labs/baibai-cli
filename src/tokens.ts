import type { Api } from "./api";
import { NATIVE_TOKEN_ADDRESS } from "./config";
import type { Network } from "./networks";
import type { TokenDetails, TokenInfo } from "./types";

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

const same = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

export const isNativeSymbol = (input: string, network: Network) => {
  const symbol = input.toLowerCase();
  return symbol === "eth" || symbol === network.nativeSymbol.toLowerCase();
};

export const nativeToken = (network: Network): TokenInfo => ({
  address: NATIVE_TOKEN_ADDRESS,
  decimals: network.nativeDecimals,
  name: network.nativeSymbol,
  symbol: network.nativeSymbol,
});

export const tokenFromDetails = (details: TokenDetails): TokenInfo => ({
  address: details.address,
  decimals: details.decimals,
  isStock: details.isStock,
  logoURI: details.logoURI,
  name: details.name,
  order: details.order,
  symbol: details.symbol,
});

export const isAddress = (value: string): value is `0x${string}` =>
  ADDRESS.test(value);

export const tokenByAddress = (address: string, tokens: TokenInfo[]) =>
  tokens.find((token) => token.address.toLowerCase() === address.toLowerCase());

export const resolveSymbol = (
  input: string,
  tokens: TokenInfo[],
): TokenInfo => {
  const matches = tokens.filter(
    (token) => token.symbol.toLowerCase() === input.toLowerCase(),
  );
  const curated = matches.filter((token) => token.order !== undefined);
  const pool = curated.length > 0 ? curated : matches;
  if (pool.length === 0) {
    throw new Error(`Unknown token ${input}.`);
  }
  const ranked = [...pool].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0),
  );
  const best = ranked[0];
  if (!best) throw new Error(`Unknown token ${input}.`);
  const tied = ranked.filter((token) => token.order === best.order);
  if (tied.length === 1) return best;
  const lines = tied
    .map((token) => `  ${token.address}  ${token.symbol}`)
    .join("\n");
  throw new Error(`${input} matches more than one token:\n${lines}`);
};

export const loadToken = async (
  api: Pick<Api, "tokens">,
  network: Network,
  input: string,
  listed?: TokenInfo[],
) => {
  if (isNativeSymbol(input, network) || same(input, NATIVE_TOKEN_ADDRESS)) {
    return nativeToken(network);
  }
  const tokens =
    listed ?? (await api.tokens.list.query({ chainId: network.id }));
  if (isAddress(input)) {
    return (
      tokenByAddress(input, tokens) ??
      tokenFromDetails(
        await api.tokens.get.query({
          address: input.toLowerCase() as `0x${string}`,
        }),
      )
    );
  }
  return resolveSymbol(input, tokens);
};

export const loadWrappedNative = async (
  api: Pick<Api, "tokens">,
  network: Network,
  listed: TokenInfo[],
) => {
  const wrapped = network.wrappedNativeToken;
  if (!wrapped) {
    throw new Error(`${network.name} has no wrapped native token.`);
  }
  return (
    tokenByAddress(wrapped, listed) ??
    tokenFromDetails(
      await api.tokens.get.query({
        address: wrapped.toLowerCase() as `0x${string}`,
      }),
    )
  );
};
