export type Address = `0x${string}`;

export type TokenStock = {
  issuer?: { id: string; name: string };
  underlying: {
    id: string;
    isin?: string;
    kind: "stock" | "etf";
    logoURI?: string;
    name: string;
    symbol?: string;
  };
};

export type TokenInfo = {
  address: string;
  decimals: number;
  logoURI?: string;
  name: string;
  order?: number;
  stock?: TokenStock;
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
  estimatedDurationMs?: number;
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
  lifi: { calldata: string; step?: unknown };
};

export type KyberRelayerVenue = {
  kyber: { calldata?: string; routeSummary?: unknown };
};

export type KyberUserVenue = {
  kyber: { calldata: string; routeSummary?: unknown };
};

export type MessageVenue = {
  lifi: { step?: unknown };
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
  gasFeeUsd?: string;
  settlement: "user";
  sponsorMinimumUsd?: number;
  transactionRequest: SwapTransaction;
  venue: LifiVenue | KyberUserVenue;
};

export type MessageQuote = QuoteShared & {
  settlement: "message";
  typedData: PermitTypedData[];
  venue: MessageVenue;
};

export type Quote = RelayerQuote | UserQuote | MessageQuote;

export type CompetitorSource = "uniswap" | "aerodrome";

export type CompetitorQuote = {
  amountOut: string;
  gasFeeUsd?: string;
  source: CompetitorSource;
};

export type QuoteCompetitors = {
  secondBestQuote?: CompetitorQuote;
};

export type OrderFailureCode =
  | "QUOTE_EXPIRED"
  | "INVALID_SIGNATURE"
  | "PERMIT2_INVALID"
  | "INSUFFICIENT_BALANCE"
  | "FILL_FAILED"
  | "BRIDGE_FAILED"
  | "INTERNAL_ERROR";

export type Order = {
  amountInSpent?: string;
  amountOutDelivered?: string;
  chainIdIn: number;
  chainIdOut: number;
  confirmedAtMs?: number;
  createdAtMs: number;
  destination?: {
    amountReceived?: string;
    chainId: number;
    substatus?: string;
    tokenReceived?: string;
    txHash?: string;
  };
  error?: { code: OrderFailureCode; message: string };
  expectedAmountOut: string;
  gain?: { amountOutUsd: string; source: CompetitorSource };
  maxAmountIn: string;
  orderId: string;
  owner: string;
  permit2Signature?: string;
  quoteId: string;
  secondBestQuote?: CompetitorQuote;
  settlement: Quote["settlement"];
  settlementBlockNumber?: string;
  status: "pending" | "bridging" | "filled" | "failed" | "expired" | "refunded";
  submittedAtMs?: number;
  tokenIn?: string;
  tokenOut?: string;
  txHash?: string;
  updatedAtMs: number;
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

export type StockPurchases = {
  totalUsd: number;
};

export type Portfolio = {
  balances: Array<{
    balance: string;
    balanceUsd?: string;
    coinId?: string;
    decimals: number;
    isNative: boolean;
    logoURI?: string;
    name: string;
    priceUsd?: string;
    stock?: TokenStock;
    symbol: string;
    token: string;
  }>;
  chainId: number;
  incomplete?: { checkedTokens: string[] };
  invalidTokens?: string[];
  observedBlockNumber: string;
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

export type PointsScan = {
  allowanceUsd: string;
  committedGoalUsd?: string;
  pastVolumeUsd: string;
  screen: "allowanceOnly" | "allowanceWithUpgrade" | "commitOnly";
  seasonEndsAtMs: number;
};
