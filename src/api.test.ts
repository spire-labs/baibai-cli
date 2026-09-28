import { describe, expect, test } from "bun:test";
import { createApi } from "./api";
import { BASE_CHAIN_ID } from "./config";

describe("tokens.list", () => {
  test("sends the Base chain id", async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return Response.json({ result: { data: [] } });
    }) as typeof fetch;
    try {
      await createApi("https://app.example/v1/trpc").tokens.list.query();
    } finally {
      globalThis.fetch = original;
    }
    const url = new URL(calls[0] ?? "");
    expect(url.pathname).toBe("/v1/trpc/tokens.list");
    expect(JSON.parse(url.searchParams.get("input") ?? "")).toEqual({
      chainId: BASE_CHAIN_ID,
    });
  });
});
