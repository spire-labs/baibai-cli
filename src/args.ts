import { parseArgs } from "node:util";
import { parseSlippageBps, resolveApiUrl, resolveRpcUrl } from "./config";
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
  exactOut: boolean;
  fast: boolean;
  json: boolean;
  recipient?: `0x${string}`;
  rpcUrl: string;
  slippageBps: number;
  tokenIn: string;
  tokenOut: string;
  yes: boolean;
};

export const parseTradeArgs = (argv: string[], usage: string): TradeArgs => {
  const parsed = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      api: { type: "string" },
      "exact-out": { type: "boolean", default: false },
      fast: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      json: { type: "boolean", default: false },
      recipient: { type: "string" },
      rpc: { type: "string" },
      slippage: { type: "string" },
      yes: { type: "boolean", default: false },
    },
  });
  if (parsed.values.help) throw new HelpRequested();
  const [amount, tokenIn, tokenOut, extra] = parsed.positionals;
  if (!amount || !tokenIn || !tokenOut || extra !== undefined) {
    throw new Error(usage);
  }
  const recipient = parsed.values.recipient;
  if (recipient !== undefined && !isAddress(recipient)) {
    throw new Error("Recipient must be an 0x address.");
  }
  return {
    amount,
    apiUrl: resolveApiUrl(parsed.values.api),
    exactOut: parsed.values["exact-out"] ?? false,
    fast: parsed.values.fast ?? false,
    json: parsed.values.json ?? false,
    recipient,
    rpcUrl: resolveRpcUrl(parsed.values.rpc),
    slippageBps: parseSlippageBps(parsed.values.slippage),
    tokenIn,
    tokenOut,
    yes: parsed.values.yes ?? false,
  };
};

export const parseLimitArgs = (argv: string[]) => {
  const parsed = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      api: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      json: { type: "boolean", default: false },
      limit: { type: "string" },
    },
  });
  if (parsed.values.help) throw new HelpRequested();
  const limit = parsed.values.limit ?? "20";
  if (!/^\d+$/.test(limit))
    throw new Error("Limit must be a positive integer.");
  const parsedLimit = Number(limit);
  if (parsedLimit < 1 || parsedLimit > 100) {
    throw new Error("Limit must be between 1 and 100.");
  }
  return {
    apiUrl: resolveApiUrl(parsed.values.api),
    json: parsed.values.json ?? false,
    limit: parsedLimit,
    positionals: parsed.positionals,
  };
};
