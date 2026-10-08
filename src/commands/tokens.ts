import { createApi } from "../api";
import { HelpRequested, parseLimitArgs } from "../args";
import { writeOut } from "../format";
import { findNetwork, resolveNetwork } from "../networks";
import { isAddress, loadToken } from "../tokens";
import type { NetworkTokenInfo, TokenPriceHistory } from "../types";

const TOKENS_USAGE = `Usage:
  baibai tokens
  baibai tokens search <query>
  baibai tokens stocks
`;

const TOKEN_USAGE =
  "Usage: baibai token <network> <token> [--period 1d|1w|1m|1y]";

export const tokensCommand = async (argv: string[]) => {
  const [action, ...rest] = argv;
  if (action === "--help" || action === "-h") {
    process.stdout.write(TOKENS_USAGE);
    return;
  }
  if (action === undefined) return listTokens([], "popular");
  if (action === "search") return searchTokens(rest);
  if (action === "stocks") return listTokens(rest, "stocks");
  if (action.startsWith("-")) return listTokens([action, ...rest], "popular");
  throw new Error(`Unknown tokens command ${action}\n${TOKENS_USAGE}`);
};

const searchTokens = async (argv: string[]) => {
  let parsed: ReturnType<typeof parseLimitArgs>;
  try {
    parsed = parseLimitArgs(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write("Usage: baibai tokens search <query>\n");
      return;
    }
    throw error;
  }
  const query = parsed.positionals.join(" ").trim();
  if (query.length === 0)
    throw new Error("Usage: baibai tokens search <query>");
  const tokens = await createApi(parsed.apiUrl).tokens.search.query({
    limit: parsed.limit,
    query,
  });
  writeTokens(parsed.json, tokens);
};

const listTokens = async (argv: string[], kind: "popular" | "stocks") => {
  let parsed: ReturnType<typeof parseLimitArgs>;
  try {
    parsed = parseLimitArgs(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write(TOKENS_USAGE);
      return;
    }
    throw error;
  }
  if (parsed.positionals.length > 0) throw new Error(TOKENS_USAGE);
  const api = createApi(parsed.apiUrl);
  const tokens =
    kind === "stocks"
      ? await api.tokens.stocks.query()
      : await api.tokens.popular.query();
  writeTokens(parsed.json, tokens);
};

const writeTokens = (json: boolean, tokens: NetworkTokenInfo[]) => {
  const rows = tokens.map((token) => ({
    address: token.address,
    chain: findNetwork(token.chainId)?.name ?? String(token.chainId),
    chainId: token.chainId,
    name: token.name,
    symbol: token.symbol,
  }));
  const text =
    rows.length === 0
      ? "No tokens\n"
      : `${rows
          .map(
            (row) =>
              `${row.chain.padEnd(16)} ${row.symbol.padEnd(12)} ${row.address}`,
          )
          .join("\n")}\n`;
  writeOut(json, { tokens: rows }, text);
};

export const tokenCommand = async (argv: string[]) => {
  let parsed: ReturnType<typeof parseLimitArgs>;
  try {
    parsed = parseLimitArgs(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write(`${TOKEN_USAGE}\n`);
      return;
    }
    throw error;
  }
  const [networkName, tokenInput, extra] = parsed.positionals;
  if (!networkName || !tokenInput || extra !== undefined) {
    throw new Error(TOKEN_USAGE);
  }
  const network = resolveNetwork(networkName);
  const api = createApi(parsed.apiUrl);
  const token = await loadToken(api, network, tokenInput);
  const address = token.address.toLowerCase() as `0x${string}`;
  if (!isAddress(address)) throw new Error(`Unknown token ${tokenInput}.`);
  const [stats, prices, history] = await Promise.all([
    api.tokens.stats.query({ chainId: network.id, token: address }),
    api.tokens.prices.query({ chainId: network.id, tokens: [address] }),
    api.tokens.priceHistory.query({
      chainId: network.id,
      period: parsed.period,
      token: address,
    }),
  ]);
  const price = prices[0]?.priceUsd;
  const first = history.points[0];
  const last = history.points.at(-1);
  const body = {
    address: token.address,
    chain: network.name,
    marketCapUsd: stats.marketCapUsd,
    name: token.name,
    period: history.period,
    priceUsd: price,
    symbol: token.symbol,
    volume24hUsd: stats.volume24hUsd,
    websiteUrl: stats.websiteUrl,
  };
  writeOut(
    parsed.json,
    body,
    [
      `${token.symbol}  ${token.name} on ${network.name}`,
      price ? `price        $${price}` : undefined,
      stats.marketCapUsd !== null
        ? `market cap   $${formatAmount(stats.marketCapUsd)}`
        : undefined,
      stats.volume24hUsd !== null
        ? `24h volume   $${formatAmount(stats.volume24hUsd)}`
        : undefined,
      historyLine(history.period, first, last),
      "",
    ]
      .filter((line): line is string => line !== undefined)
      .join("\n"),
  );
};

const historyLine = (
  period: TokenPriceHistory["period"],
  first: TokenPriceHistory["points"][number] | undefined,
  last: TokenPriceHistory["points"][number] | undefined,
) => {
  if (!first || !last) return undefined;
  return `${period.padEnd(12)} $${formatAmount(first.priceUsd)} → $${formatAmount(last.priceUsd)}`;
};

const formatAmount = (value: number) => {
  if (value >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return value.toPrecision(4);
};
