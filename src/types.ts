export type Address = `0x${string}`;

export type TokenInfo = {
  address: string;
  decimals: number;
  name: string;
  order?: number;
  symbol: string;
};

export type QuoteRequest = {
  intent:
    | { amountIn: string; type: "exactIn" }
    | { amountOut: string; type: "exactOut" };
  owner: Address;
  recipient?: Address;
  slippageBps: number;
  tokenIn: Address;
  tokenOut: Address;
};

export type TypedDataField = { name: string; type: string };

export type PermitTypedData = {
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
  primaryType: string;
  types: Record<string, TypedDataField[]>;
};

export type Quote = {
  expectedAmountIn: string;
  expectedAmountOut: string;
  expiresAtMs: number;
  maxAmountIn: string;
  minAmountOut: string;
  owner: string;
  permit2TypedData: PermitTypedData;
  priceImpactBps: number;
  quoteId: string;
  recipient: string;
  slippageBps: number;
  tokenIn: string;
  tokenOut: string;
  venue: { lifi: { calldata: string; step: unknown } };
};

export type Order = {
  amountInSpent?: string;
  amountOutDelivered?: string;
  error?: { code: string; message: string };
  expectedAmountOut: string;
  maxAmountIn: string;
  orderId: string;
  owner: string;
  quoteId: string;
  status: "pending" | "filled" | "failed" | "expired";
  txHash?: string;
};

export type Portfolio = {
  balances: Array<{
    balance: string;
    balanceUsd?: string;
    decimals: number;
    name: string;
    symbol: string;
    token: string;
  }>;
  owner: string;
  totalUsd: string;
};
