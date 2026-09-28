import type { Order, Portfolio, Quote, QuoteRequest, TokenInfo } from "./types";

export type Api = {
  order: {
    byOwner: {
      query: (input: { limit?: number; owner: `0x${string}` }) => Promise<{
        items: Order[];
      }>;
    };
    create: {
      mutate: (input: {
        permit2Signature: `0x${string}`;
        quoteId: string;
      }) => Promise<Order>;
    };
    status: {
      query: (input: { orderId: string }) => Promise<Order>;
    };
  };
  quote: {
    once: { query: (input: QuoteRequest) => Promise<Quote> };
  };
  tokens: {
    get: { query: (input: { address: `0x${string}` }) => Promise<TokenInfo> };
    list: { query: () => Promise<TokenInfo[]> };
  };
  wallet: {
    portfolio: {
      query: (input: { owner: `0x${string}` }) => Promise<Portfolio>;
    };
  };
};

export const createApi = (url: string): Api => ({
  order: {
    byOwner: {
      query: (input) => call(url, "order.byOwner", "query", input),
    },
    create: {
      mutate: (input) => call(url, "order.create", "mutation", input),
    },
    status: { query: (input) => call(url, "order.status", "query", input) },
  },
  quote: {
    once: { query: (input) => call(url, "quote.once", "query", input) },
  },
  tokens: {
    get: { query: (input) => call(url, "tokens.get", "query", input) },
    list: { query: () => call(url, "tokens.list", "query") },
  },
  wallet: {
    portfolio: {
      query: (input) => call(url, "wallet.portfolio", "query", input),
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
