export type Address = `0x${string}`;

export type TokenInfo = {
  address: string;
  decimals: number;
  isStock?: boolean;
  logoURI?: string;
  name: string;
  order?: number;
  symbol: string;
};

export type NetworkTokenInfo = TokenInfo & {
  chainId: number;
};

export type TokenDetails = TokenInfo & {
  balance: { status: "available"; value: string } | { status: "unavailable" };
};

export type QuoteRequest = {
  destinationChainId: number;
  intent:
    | { amountIn: string; type: "exactIn" }
    | { amountOut: string; type: "exactOut" };
  owner: Address;
  recipient?: Address;
  slippageBps: number;
  sourceChainId: number;
  tokenIn: Address;
  tokenOut: Address;
};

export type TypedDataField = { name: string; type: string };

export type PermitTypedData = {
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
  primaryType: string;
  types: Record<string, readonly TypedDataField[]>;
};

type QuoteShared = {
  attestation: string;
  chainIdIn: number;
  chainIdOut: number;
  expectedAmountIn: string;
  expectedAmountOut: string;
  expectedOutUsd?: number;
  expiresAtMs: number;
  maxAmountIn: string;
  maximumInputUsd?: number;
  minAmountOut: string;
  owner: string;
  priceImpactBps: number;
  quoteId: string;
  recipient: string;
  slippageBps: number;
  tokenIn: string;
  tokenOut: string;
};

export type LifiVenue = {
  lifi: { calldata: string; step: unknown };
};

export type KyberRelayerVenue = {
  kyber: { routeSummary: unknown };
};

export type KyberUserVenue = {
  kyber: { calldata: string; routeSummary: unknown };
};

export type SwapTransaction = {
  chainId: number;
  data: string;
  to: string;
  value: string;
};

export type RelayerQuote = QuoteShared & {
  permit2TypedData: PermitTypedData;
  settlement: "relayer";
  venue: LifiVenue | KyberRelayerVenue;
};

export type UserQuote = QuoteShared & {
  settlement: "user";
  transactionRequest: SwapTransaction;
  venue: LifiVenue | KyberUserVenue;
};

export type Quote = RelayerQuote | UserQuote;

export type Order = {
  amountInSpent?: string;
  amountOutDelivered?: string;
  confirmedAtMs?: number;
  createdAtMs?: number;
  error?: { code: string; message: string };
  expectedAmountOut: string;
  gain?: { amountOutUsd: string; source: string };
  maxAmountIn: string;
  orderId: string;
  owner: string;
  quoteId: string;
  status: "pending" | "filled" | "failed" | "expired";
  tokenIn?: string;
  tokenOut?: string;
  txHash?: string;
};

export type OrderPage = {
  items: Order[];
  nextCursor?: string;
};

export type GainStats = {
  filledTrades: number;
  totalGainCount: number;
  totalGainUsd: string;
};

export type Portfolio = {
  balances: Array<{
    balance: string;
    balanceUsd?: string;
    decimals: number;
    isNative?: boolean;
    name: string;
    priceUsd?: string;
    symbol: string;
    token: string;
  }>;
  chainId: number;
  incomplete?: { checkedTokens: string[] };
  owner: string;
  totalUsd: string;
};

export type TokenPrice = {
  priceUsd?: string;
  symbol?: string;
  token: string;
};

export type TokenPriceHistory = {
  period: "1d" | "1w" | "1m" | "1y";
  points: Array<{ priceUsd: number; timestampMs: number }>;
  token: string;
};

export type TokenStats = {
  circulatingSupply: number | null;
  description: string | null;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  maxSupply: number | null;
  networks: Array<{ address: string; chainId: number }>;
  token: string;
  totalSupply: number | null;
  volume24hUsd: number | null;
  websiteUrl: string | null;
  xUrl: string | null;
};

export type PointsSummary = {
  boost?: {
    allowanceUsd: string;
    commit?: { goalUsd: string; progressUsd: string };
    consumedUsd: string;
    expired: boolean;
  };
  breakdown?: {
    boostPoints: string;
    questPoints: string;
    refereeBoostPoints: string;
    referralPoints: string;
    tradePoints: string;
  };
  owner: string;
  quests: Array<{ quest: string }>;
  rank?: number;
  referral: {
    canBeReferred: boolean;
    referred: boolean;
    referredCount: number;
    referrerUsername?: string;
    username?: { renamed: boolean; username: string };
  };
  streak: { activeToday: boolean; days: number; multiplier: number };
  totalPoints?: string;
  volumeUsd: string;
};

export type PointsLeaderboard = {
  entries: Array<{
    owner: string;
    rank: number;
    totalGainUsd: string;
    totalPoints: string;
    volumeUsd: string;
  }>;
  total: number;
};

export type PointsProgramConfig = {
  activeDayMinVolumeUsd: number;
  basePointsPerUsd: number;
  boostDifferentialPerUsd: number;
  commitGoalTiersUsd: number[];
  refereeBoostRate: number;
  referrerShareRate: number;
};
