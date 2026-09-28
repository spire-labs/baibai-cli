import { describe, expect, test } from "bun:test";
import { parseTradeArgs } from "./args";
import { DEFAULT_RPC_URL, parseSlippageBps, resolveRpcUrl } from "./config";
import { formatDuration, formatRawAmount } from "./format";
import { accepted } from "./prompt";
import { parseHumanAmount } from "./swap/amounts";
import { nativePlan } from "./swap/native";
import { resolveSymbol, tokenByAddress } from "./tokens";
import type { TokenInfo } from "./types";

const USDC: TokenInfo = {
  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  decimals: 6,
  name: "USDC",
  order: 2,
  symbol: "USDC",
};
const USDC_OTHER: TokenInfo = {
  address: "0x1111111111111111111111111111111111111111",
  decimals: 6,
  name: "Other USDC",
  symbol: "USDC",
};
const WETH: TokenInfo = {
  address: "0x4200000000000000000000000000000000000006",
  decimals: 18,
  name: "Wrapped Ether",
  order: 1,
  symbol: "WETH",
};
const ETH: TokenInfo = {
  address: "0x0000000000000000000000000000000000000000",
  decimals: 18,
  name: "Ethereum",
  order: 0,
  symbol: "ETH",
};

describe("parseTradeArgs", () => {
  test("parses quote 10 usdc weth", () => {
    expect(parseTradeArgs(["10", "usdc", "weth"], "usage")).toMatchObject({
      amount: "10",
      exactOut: false,
      slippageBps: 100,
      tokenIn: "usdc",
      tokenOut: "weth",
    });
  });

  test("parses exact-out and slippage", () => {
    expect(
      parseTradeArgs(
        ["1", "usdc", "weth", "--exact-out", "--slippage", "0.5"],
        "usage",
      ),
    ).toMatchObject({ exactOut: true, slippageBps: 50 });
  });

  test("rejects a missing token", () => {
    expect(() => parseTradeArgs(["10", "usdc"], "usage")).toThrow("usage");
  });

  test("parses --yes", () => {
    expect(parseTradeArgs(["10", "usdc", "weth", "--yes"], "usage").yes).toBe(
      true,
    );
  });

  test("parses --fast", () => {
    expect(parseTradeArgs(["10", "usdc", "weth"], "usage").fast).toBe(false);
    expect(parseTradeArgs(["10", "usdc", "weth", "--fast"], "usage").fast).toBe(
      true,
    );
  });

  test("defaults the rpc url and accepts --rpc", () => {
    const previous = process.env.RPC_URL;
    delete process.env.RPC_URL;
    try {
      expect(parseTradeArgs(["10", "usdc", "weth"], "usage").rpcUrl).toBe(
        DEFAULT_RPC_URL,
      );
      expect(
        parseTradeArgs(
          ["10", "usdc", "weth", "--rpc", "https://base.example"],
          "usage",
        ).rpcUrl,
      ).toBe("https://base.example");
    } finally {
      if (previous === undefined) delete process.env.RPC_URL;
      else process.env.RPC_URL = previous;
    }
  });
});

describe("resolveRpcUrl", () => {
  test("prefers the flag, then the environment, then the default", () => {
    const previous = process.env.RPC_URL;
    process.env.RPC_URL = "https://env.example";
    try {
      expect(resolveRpcUrl("https://flag.example")).toBe(
        "https://flag.example",
      );
      expect(resolveRpcUrl(undefined)).toBe("https://env.example");
    } finally {
      if (previous === undefined) delete process.env.RPC_URL;
      else process.env.RPC_URL = previous;
    }
    expect(resolveRpcUrl(undefined)).toBe(DEFAULT_RPC_URL);
  });

  test("rejects an empty rpc url", () => {
    expect(() => resolveRpcUrl("  ")).toThrow("RPC URL is empty.");
  });
});

describe("accepted", () => {
  test("treats enter, y, and yes as acceptance", () => {
    expect(accepted("")).toBe(true);
    expect(accepted("y")).toBe(true);
    expect(accepted("YES")).toBe(true);
  });

  test("rejects any other answer", () => {
    expect(accepted("n")).toBe(false);
    expect(accepted("no")).toBe(false);
  });
});

describe("amounts", () => {
  test("parses USDC and WETH units", () => {
    expect(parseHumanAmount("10", 6)).toBe(10_000_000n);
    expect(parseHumanAmount("1.5", 18)).toBe(1_500_000_000_000_000_000n);
  });

  test("rejects zero and extra precision", () => {
    expect(() => parseHumanAmount("0", 6)).toThrow("greater than zero");
    expect(() => parseHumanAmount("1.0000001", 6)).toThrow("decimal places");
  });

  test("formats raw amounts without trailing zeros", () => {
    expect(formatRawAmount("10000000", 6)).toBe("10");
    expect(formatRawAmount("1500000", 6)).toBe("1.5");
  });

  test("formats fill time in milliseconds or seconds", () => {
    expect(formatDuration(130)).toBe("130ms");
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(2000)).toBe("2s");
    expect(formatDuration(12_400)).toBe("12s");
  });
});

describe("parseSlippageBps", () => {
  test("defaults to 1 percent", () => {
    expect(parseSlippageBps(undefined)).toBe(100);
  });

  test("rejects a percent outside the quote bounds", () => {
    expect(() => parseSlippageBps("21")).toThrow("between 0.01 and 20");
  });
});

describe("resolveSymbol", () => {
  const tokens = [ETH, WETH, USDC, USDC_OTHER];

  test("prefers the curated symbol", () => {
    expect(resolveSymbol("usdc", tokens).address).toBe(USDC.address);
  });

  test("lists ambiguous uncurated symbols", () => {
    expect(() =>
      resolveSymbol("usdc", [
        USDC_OTHER,
        { ...USDC_OTHER, address: `0x${"2".repeat(40)}` },
      ]),
    ).toThrow("matches more than one token");
  });

  test("resolves weth and eth separately", () => {
    expect(resolveSymbol("weth", tokens).symbol).toBe("WETH");
    expect(resolveSymbol("eth", tokens).symbol).toBe("ETH");
  });

  test("rejects an unknown symbol and resolves an address directly", () => {
    expect(() => resolveSymbol("nope", tokens)).toThrow("Unknown token nope.");
    expect(tokenByAddress(USDC.address, tokens)?.symbol).toBe("USDC");
  });
});

describe("nativePlan", () => {
  test("wraps eth to weth and swaps the other pairs", () => {
    expect(nativePlan(ETH.address, WETH.address)).toBe("wrap");
    expect(nativePlan(WETH.address, ETH.address)).toBe("unwrap");
    expect(nativePlan(ETH.address, USDC.address)).toBe("wrap-then-swap");
    expect(nativePlan(USDC.address, ETH.address)).toBe("swap-then-unwrap");
    expect(nativePlan(USDC.address, WETH.address)).toBe("swap");
  });
});
