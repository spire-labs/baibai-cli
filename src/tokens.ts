import type { Api } from "./api";
import { NATIVE_TOKEN_ADDRESS } from "./config";
import {
  HYPERCORE_CHAIN_ID,
  HYPERCORE_PERPS_USDC,
  HYPERCORE_SPOT_USDC,
  type Network,
} from "./networks";
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

const HYPERCORE_TOKENS: TokenInfo[] = [
  {
    address: HYPERCORE_PERPS_USDC,
    decimals: 6,
    name: "USD Coin",
    order: 0,
    symbol: "USDC",
  },
  {
    address: HYPERCORE_SPOT_USDC,
    decimals: 8,
    name: "USD Coin",
    order: 0,
    symbol: "SPOT",
  },
];

export const tokenFromDetails = (details: TokenDetails): TokenInfo => ({
  address: details.address,
  decimals: details.decimals,
  logoURI: details.logoURI,
  name: details.name,
  order: details.order,
  stock: details.stock,
  symbol: details.symbol,
});

const hypercoreToken = (input: string): TokenInfo => {
  const key = input.toLowerCase();
  if (key === "usdc-spot" || key === "spot-usdc") {
    const spot = HYPERCORE_TOKENS[1];
    if (!spot) throw new Error("Unknown token.");
    return spot;
  }
  if (isAddress(input)) {
    const found = tokenByAddress(input, HYPERCORE_TOKENS);
    if (!found) throw new Error(`Unknown token ${input}.`);
    return found;
  }
  return resolveSymbol(key === "perps" ? "usdc" : input, HYPERCORE_TOKENS);
};

export const listNetworkTokens = (
  api: Pick<Api, "tokens">,
  network: Network,
) =>
  network.id === HYPERCORE_CHAIN_ID
    ? Promise.resolve(HYPERCORE_TOKENS)
    : api.tokens.list.query({ chainId: network.id });

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
  if (network.id === HYPERCORE_CHAIN_ID) return hypercoreToken(input);
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
