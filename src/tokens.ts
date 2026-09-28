import type { TokenInfo } from "./types";

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

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
