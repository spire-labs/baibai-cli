import { formatUnits } from "viem";

export const formatRawAmount = (raw: string, decimals: number) => {
  const formatted = formatUnits(BigInt(raw), decimals);
  const [whole, fraction] = formatted.split(".");
  if (!fraction) return whole ?? "0";
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed.length === 0 ? (whole ?? "0") : `${whole}.${trimmed}`;
};

export const formatDuration = (ms: number) => {
  const rounded = Math.max(0, Math.round(ms));
  if (rounded < 1_000) return `${rounded}ms`;
  const seconds = rounded / 1_000;
  if (seconds < 10) return `${seconds.toFixed(1).replace(/\.0$/, "")}s`;
  return `${Math.round(seconds)}s`;
};

export const formatPercentFromBps = (slippageBps: number) => {
  const percent = slippageBps / 100;
  return `${percent}%`;
};

export const formatQuoteText = (args: {
  buyAmount: string;
  buyChain: string;
  buySymbol: string;
  expiresAtMs: number;
  indicative: boolean;
  minAmount: string;
  nowMs: number;
  priceImpactBps: number;
  sellAmount: string;
  sellChain: string;
  sellSymbol: string;
  settlement: "relayer" | "user" | "message";
  slippageBps: number;
  bridgeMs?: number;
  competitor?: string;
  gasFeeUsd?: string;
  sponsorMinimumUsd?: number;
}) => {
  const expires = Math.max(
    0,
    Math.round((args.expiresAtMs - args.nowMs) / 1000),
  );
  const route =
    args.sellChain === args.buyChain
      ? `on ${args.sellChain}`
      : `${args.sellChain} → ${args.buyChain}`;
  const lines = [
    `${args.sellAmount} ${args.sellSymbol} → ${args.buyAmount} ${args.buySymbol}  ${route}`,
    `min received   ${args.minAmount} ${args.buySymbol}`,
    `price impact   ${args.priceImpactBps} bps`,
    `slippage       ${formatPercentFromBps(args.slippageBps)}`,
    `settlement     ${args.settlement}`,
    `expires        ${expires}s`,
  ];
  if (args.gasFeeUsd !== undefined) {
    lines.push(`gas            $${args.gasFeeUsd}`);
  }
  if (args.sponsorMinimumUsd !== undefined) {
    lines.push(`sponsored from $${args.sponsorMinimumUsd}`);
  }
  if (args.bridgeMs !== undefined) {
    lines.push(`bridge         ${formatDuration(args.bridgeMs)}`);
  }
  if (args.competitor !== undefined) {
    lines.push(args.competitor);
  }
  if (args.indicative) {
    lines.push("Indicative quote. Import a key to trade.");
  }
  return `${lines.join("\n")}\n`;
};

export const writeOut = (json: boolean, value: unknown, text: string) => {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : text);
};
