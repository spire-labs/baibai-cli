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
  buySymbol: string;
  expiresAtMs: number;
  indicative: boolean;
  minAmount: string;
  nowMs: number;
  priceImpactBps: number;
  sellAmount: string;
  sellSymbol: string;
  slippageBps: number;
}) => {
  const expires = Math.max(
    0,
    Math.round((args.expiresAtMs - args.nowMs) / 1000),
  );
  const lines = [
    `${args.sellAmount} ${args.sellSymbol} → ${args.buyAmount} ${args.buySymbol}`,
    `min received   ${args.minAmount} ${args.buySymbol}`,
    `price impact   ${args.priceImpactBps} bps`,
    `slippage       ${formatPercentFromBps(args.slippageBps)}`,
    `expires        ${expires}s`,
  ];
  if (args.indicative) {
    lines.push("Indicative quote. Import a key to trade.");
  }
  return `${lines.join("\n")}\n`;
};

export const writeOut = (json: boolean, value: unknown, text: string) => {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : text);
};
