import type {
  Address,
  GainStats,
  NetworkTokenInfo,
  Order,
  OrderPage,
  PointsLeaderboard,
  PointsProgramConfig,
  PointsScan,
  PointsSummary,
  Portfolio,
  Quote,
  QuoteCompetitors,
  QuoteRequest,
  StockPurchases,
  TokenDetails,
  TokenInfo,
  TokenPrice,
  TokenPriceHistory,
  TokenStats,
} from "./types";

export type Api = {
  names: {
    resolve: {
      query: (input: { name: string }) => Promise<{ address: string | null }>;
    };
    reverse: {
      query: (input: { address: Address }) => Promise<{ name: string | null }>;
    };
  };
  order: {
    byOwner: {
      query: (input: {
        cursor?: string;
        limit?: number;
        owner: Address;
      }) => Promise<OrderPage>;
    };
    create: {
      mutate: (input: {
        permit2Signature: Address;
        quote: Quote;
      }) => Promise<Order>;
    };
    createSigned: {
      mutate: (input: {
        quote: Quote;
        signatures: Address[];
      }) => Promise<Order>;
    };
    gainsByOwner: {
      query: (input: { owner: Address }) => Promise<GainStats>;
    };
    recordUserPaid: {
      mutate: (input: { quote: Quote; txHash: Address }) => Promise<Order>;
    };
    status: {
      query: (input: { orderId: string }) => Promise<Order>;
    };
    stockPurchasesByOwner: {
      query: (input: { owner: Address }) => Promise<StockPurchases>;
    };
  };
  points: {
    bindReferral: {
      mutate: (input: {
        deadlineMs: number;
        owner: Address;
        referrerUsername: string;
        signature: Address;
      }) => Promise<null>;
    };
    commitGoal: {
      mutate: (input: {
        deadlineMs: number;
        goalUsd: number;
        owner: Address;
        signature: Address;
      }) => Promise<null>;
    };
    createReferralUsername: {
      mutate: (input: {
        deadlineMs: number;
        owner: Address;
        signature: Address;
      }) => Promise<null>;
    };
    leaderboard: {
      query: (input: {
        limit?: number;
        page?: number;
      }) => Promise<PointsLeaderboard>;
    };
    programConfig: {
      query: () => Promise<PointsProgramConfig>;
    };
    scan: {
      mutate: (input: { owner: Address }) => Promise<PointsScan>;
    };
    summary: {
      query: (input: { owner: Address }) => Promise<PointsSummary>;
    };
    updateReferralUsername: {
      mutate: (input: {
        deadlineMs: number;
        owner: Address;
        signature: Address;
        username: string;
      }) => Promise<null>;
    };
  };
  quote: {
    competitors: {
      query: (input: {
        amountIn: string;
        destinationChainId: number;
        owner: Address;
        sourceChainId: number;
        tokenIn: Address;
        tokenOut: Address;
      }) => Promise<QuoteCompetitors>;
    };
    once: { query: (input: QuoteRequest) => Promise<Quote> };
  };
  tokens: {
    get: {
      query: (input: {
        address: Address;
        owner?: Address;
      }) => Promise<TokenDetails>;
    };
    list: { query: (input: { chainId: number }) => Promise<TokenInfo[]> };
    popular: { query: () => Promise<NetworkTokenInfo[]> };
    priceHistory: {
      query: (input: {
        chainId: number;
        period: TokenPriceHistory["period"];
        token: Address;
      }) => Promise<TokenPriceHistory>;
    };
    prices: {
      query: (input: {
        chainId: number;
        tokens: Address[];
      }) => Promise<TokenPrice[]>;
    };
    search: {
      query: (input: {
        category?: "stocks" | "tokens";
        limit?: number;
        query: string;
      }) => Promise<NetworkTokenInfo[]>;
    };
    stats: {
      query: (input: {
        chainId: number;
        token: Address;
      }) => Promise<TokenStats>;
    };
    stocks: { query: () => Promise<NetworkTokenInfo[]> };
  };
  wallet: {
    portfolio: {
      query: (input: {
        chainId?: number;
        owner: Address;
        tokens?: Address[];
      }) => Promise<Portfolio>;
    };
    portfolios: {
      query: (input: { owner: Address }) => Promise<Portfolio[]>;
    };
  };
};

export const createApi = (url: string): Api => ({
  names: {
    resolve: {
      query: (input) => call(url, "names.resolve", "query", input),
    },
    reverse: {
      query: (input) => call(url, "names.reverse", "query", input),
    },
  },
  order: {
    byOwner: {
      query: (input) => call(url, "order.byOwner", "query", input),
    },
    create: {
      mutate: (input) => call(url, "order.create", "mutation", input),
    },
    createSigned: {
      mutate: (input) => call(url, "order.createSigned", "mutation", input),
    },
    gainsByOwner: {
      query: (input) => call(url, "order.gainsByOwner", "query", input),
    },
    recordUserPaid: {
      mutate: (input) => call(url, "order.recordUserPaid", "mutation", input),
    },
    status: { query: (input) => call(url, "order.status", "query", input) },
    stockPurchasesByOwner: {
      query: (input) =>
        call(url, "order.stockPurchasesByOwner", "query", input),
    },
  },
  points: {
    bindReferral: {
      mutate: (input) => call(url, "points.bindReferral", "mutation", input),
    },
    commitGoal: {
      mutate: (input) => call(url, "points.commitGoal", "mutation", input),
    },
    createReferralUsername: {
      mutate: (input) =>
        call(url, "points.createReferralUsername", "mutation", input),
    },
    leaderboard: {
      query: (input) => call(url, "points.leaderboard", "query", input),
    },
    programConfig: {
      query: () => call(url, "points.programConfig", "query"),
    },
    scan: {
      mutate: (input) => call(url, "points.scan", "mutation", input),
    },
    summary: {
      query: (input) => call(url, "points.summary", "query", input),
    },
    updateReferralUsername: {
      mutate: (input) =>
        call(url, "points.updateReferralUsername", "mutation", input),
    },
  },
  quote: {
    competitors: {
      query: (input) => call(url, "quote.competitors", "query", input),
    },
    once: { query: (input) => call(url, "quote.once", "query", input) },
  },
  tokens: {
    get: { query: (input) => call(url, "tokens.get", "query", input) },
    list: {
      query: (input) => call(url, "tokens.list", "query", input),
    },
    popular: { query: () => call(url, "tokens.popular", "query") },
    priceHistory: {
      query: (input) => call(url, "tokens.priceHistory", "query", input),
    },
    prices: { query: (input) => call(url, "tokens.prices", "query", input) },
    search: { query: (input) => call(url, "tokens.search", "query", input) },
    stats: { query: (input) => call(url, "tokens.stats", "query", input) },
    stocks: { query: () => call(url, "tokens.stocks", "query") },
  },
  wallet: {
    portfolio: {
      query: (input) => call(url, "wallet.portfolio", "query", input),
    },
    portfolios: {
      query: (input) => call(url, "wallet.portfolios", "query", input),
    },
  },
});

const call = async <T>(
  url: string,
  path: string,
  type: "query" | "mutation",
  input?: unknown,
): Promise<T> => {
  const endpoint = `${url.replace(/\/$/, "")}/${path}`;
  const response =
    type === "query"
      ? await fetch(
          input === undefined
            ? endpoint
            : `${endpoint}?input=${encodeURIComponent(JSON.stringify(input))}`,
        )
      : await fetch(endpoint, {
          body: JSON.stringify(input),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
  const body = (await response.json()) as {
    error?: { message?: string };
    result?: { data?: T };
  };
  if (body.error || !response.ok || body.result?.data === undefined) {
    throw new Error(
      body.error?.message ?? `Request failed (${response.status}).`,
    );
  }
  return body.result.data;
};
