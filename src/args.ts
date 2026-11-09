import { parseArgs } from "node:util";
import { parseSlippageBps, resolveApiUrl, resolveRpcUrl } from "./config";
import { defaultNetwork, type Network, resolveNetwork } from "./networks";
import { isAddress } from "./tokens";

export class HelpRequested extends Error {
  constructor() {
    super("help");
    this.name = "HelpRequested";
  }
}

export type TradeArgs = {
  amount: string;
  apiUrl: string;
  destination: Network;
  exactOut: boolean;
  fast: boolean;
  json: boolean;
  recipient?: string;
  rpcUrl?: string;
  slippageBps: number;
  source: Network;
  tokenIn: string;
  tokenOut: string;
  yes: boolean;
};

const TOKEN_PREFIX = /^([^:]+):(.+)$/;

export const parseTokenArg = (input: string, fallback: Network) => {
  const match = TOKEN_PREFIX.exec(input);
  if (!match?.[1] || !match[2]) return { chain: fallback, token: input };
  return { chain: resolveNetwork(match[1]), token: match[2] };
};

export const parseTradeArgs = (argv: string[], usage: string): TradeArgs => {
  const parsed = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      api: { type: "string" },
      "exact-out": { type: "boolean", default: false },
      fast: { type: "boolean", default: false },
      from: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      json: { type: "boolean", default: false },
      recipient: { type: "string" },
      rpc: { type: "string" },
      slippage: { type: "string" },
      to: { type: "string" },
      yes: { type: "boolean", default: false },
    },
  });
  if (parsed.values.help) throw new HelpRequested();
  const [amount, tokenIn, tokenOut, extra] = parsed.positionals;
  if (!amount || !tokenIn || !tokenOut || extra !== undefined) {
    throw new Error(usage);
  }
  const recipient = parsed.values.recipient;
  if (
    recipient !== undefined &&
    !isAddress(recipient) &&
    !recipient.includes(".")
  ) {
    throw new Error("Recipient must be an 0x address or ENS name.");
  }
  const fromNetwork = parsed.values.from
    ? resolveNetwork(parsed.values.from)
    : defaultNetwork();
  const toNetwork = parsed.values.to
    ? resolveNetwork(parsed.values.to)
    : fromNetwork;
  const sell = parseTokenArg(tokenIn, fromNetwork);
  const buy = parseTokenArg(tokenOut, toNetwork);
  if (sell.chain.rpcUrl === undefined && parsed.values.rpc !== undefined) {
    throw new Error(`${sell.chain.name} has no RPC.`);
  }
  return {
    amount,
    apiUrl: resolveApiUrl(parsed.values.api),
    destination: buy.chain,
    exactOut: parsed.values["exact-out"] ?? false,
    fast: parsed.values.fast ?? false,
    json: parsed.values.json ?? false,
    recipient,
    rpcUrl:
      sell.chain.rpcUrl === undefined
        ? undefined
        : resolveRpcUrl(parsed.values.rpc, sell.chain.id),
    slippageBps: parseSlippageBps(parsed.values.slippage),
    source: sell.chain,
    tokenIn: sell.token,
    tokenOut: buy.token,
    yes: parsed.values.yes ?? false,
  };
};

const parsePeriod = (value: string | undefined): "1d" | "1w" | "1m" | "1y" => {
  const period = value ?? "1d";
  if (
    period === "1d" ||
    period === "1w" ||
    period === "1m" ||
    period === "1y"
  ) {
    return period;
  }
  throw new Error("Period must be 1d, 1w, 1m, or 1y.");
};

const AMOUNT_CAP = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const parseAmountCap = (value: string | undefined) => {
  if (value === undefined) return undefined;
  if (!AMOUNT_CAP.test(value) || !/[1-9]/.test(value)) {
    throw new Error("Amount must be greater than zero.");
  }
  return value;
};

export type AccumulateArgs = {
  amount?: string;
  apiUrl: string;
  json: boolean;
  network: Network;
  rpcUrl: string;
};

export const parseAccumulateArgs = (
  argv: string[],
  usage: string,
): AccumulateArgs => {
  const parsed = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      amount: { type: "string" },
      api: { type: "string" },
      from: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      json: { type: "boolean", default: false },
      rpc: { type: "string" },
    },
  });
  if (parsed.values.help) throw new HelpRequested();
  if (parsed.positionals.length > 0) throw new Error(usage);
  const network = parsed.values.from
    ? resolveNetwork(parsed.values.from)
    : defaultNetwork();
  return {
    amount: parseAmountCap(parsed.values.amount),
    apiUrl: resolveApiUrl(parsed.values.api),
    json: parsed.values.json ?? false,
    network,
    rpcUrl: resolveRpcUrl(parsed.values.rpc, network.id),
  };
};

export const parseLimitArgs = (argv: string[]) => {
  const parsed = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      api: { type: "string" },
      chain: { type: "string" },
      cursor: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      json: { type: "boolean", default: false },
      limit: { type: "string" },
      page: { type: "string" },
      period: { type: "string" },
    },
  });
  if (parsed.values.help) throw new HelpRequested();
  const limit = parsed.values.limit ?? "20";
  if (!/^\d+$/.test(limit)) {
    throw new Error("Limit must be a positive integer.");
  }
  const parsedLimit = Number(limit);
  if (parsedLimit < 1 || parsedLimit > 100) {
    throw new Error("Limit must be between 1 and 100.");
  }
  const page = parsed.values.page;
  if (page !== undefined && !/^\d+$/.test(page)) {
    throw new Error("Page must be a positive integer.");
  }
  const period = parsePeriod(parsed.values.period);
  return {
    apiUrl: resolveApiUrl(parsed.values.api),
    chain: parsed.values.chain
      ? resolveNetwork(parsed.values.chain)
      : undefined,
    cursor: parsed.values.cursor,
    json: parsed.values.json ?? false,
    limit: parsedLimit,
    page: page === undefined ? undefined : Number(page),
    period,
    positionals: parsed.positionals,
  };
};
