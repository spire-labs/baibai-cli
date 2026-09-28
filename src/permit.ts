import { keccak256 } from "viem";
import {
  BASE_CHAIN_ID,
  PERMIT2_ADDRESS,
  PERMIT2_PROXY_ADDRESS,
} from "./config";
import type { Quote } from "./types";

export const LIFI_DIAMOND_ADDRESS =
  "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
const MAX_QUOTE_LIFETIME_MS = 2 * 60 * 1000;
const ERC6492_MAGIC_SUFFIX = "6492".repeat(16);

const EXPECTED_TYPED_DATA_FIELDS = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  LiFiCall: [
    { name: "diamondAddress", type: "address" },
    { name: "diamondCalldataHash", type: "bytes32" },
  ],
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "LiFiCall" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
} as const;

export type QuotePermitExpectation = {
  authorizedAmountIn: bigint;
  intent: "exactIn" | "exactOut";
  minimumAmountOut: bigint;
  nowMs?: number;
  owner: string;
  quote: Quote;
  recipient: string;
  slippageBps: number;
  tokenIn: string;
  tokenOut: string;
};

export const assertQuotePermit = ({
  authorizedAmountIn,
  intent,
  minimumAmountOut,
  nowMs = Date.now(),
  owner,
  quote,
  recipient,
  slippageBps,
  tokenIn,
  tokenOut,
}: QuotePermitExpectation): void => {
  if (
    !sameHex(quote.owner, owner) ||
    !sameHex(quote.recipient, recipient) ||
    !sameHex(quote.tokenIn, tokenIn) ||
    !sameHex(quote.tokenOut, tokenOut) ||
    quote.slippageBps !== slippageBps ||
    quote.expiresAtMs <= nowMs ||
    quote.expiresAtMs > nowMs + MAX_QUOTE_LIFETIME_MS
  ) {
    throw new Error("The refreshed quote no longer matches this trade.");
  }

  const expectedAmountIn = quoteAmount(
    quote.expectedAmountIn,
    "expected input amount",
  );
  const maxAmountIn = quoteAmount(quote.maxAmountIn, "maximum input amount");
  const expectedAmountOut = quoteAmount(
    quote.expectedAmountOut,
    "expected output amount",
  );
  const minAmountOut = quoteAmount(quote.minAmountOut, "minimum output amount");
  if (expectedAmountIn > maxAmountIn || expectedAmountOut < minAmountOut) {
    throw new Error("The backend returned an internally inconsistent quote.");
  }

  if (intent === "exactIn") {
    if (
      expectedAmountIn !== authorizedAmountIn ||
      maxAmountIn !== authorizedAmountIn ||
      minAmountOut < minimumAmountOut
    ) {
      throw new Error("The refreshed quote is worse than the quote shown.");
    }
  } else if (
    maxAmountIn > authorizedAmountIn ||
    minAmountOut < minimumAmountOut
  ) {
    throw new Error("The refreshed quote is worse than the quote shown.");
  }

  const domain = asRecord(quote.permit2TypedData.domain);
  const message = asRecord(quote.permit2TypedData.message);
  const permitted = asRecord(message?.permitted);
  const witness = asRecord(message?.witness);
  const calldata = quote.venue.lifi.calldata;
  if (
    !hasExactKeys(domain, ["chainId", "name", "verifyingContract"]) ||
    !hasExactKeys(message, [
      "deadline",
      "nonce",
      "permitted",
      "spender",
      "witness",
    ]) ||
    !hasExactKeys(permitted, ["amount", "token"]) ||
    !hasExactKeys(witness, ["diamondAddress", "diamondCalldataHash"]) ||
    !hasExpectedTypedDataFields(quote.permit2TypedData.types) ||
    quote.permit2TypedData.primaryType !== "PermitWitnessTransferFrom" ||
    domain?.name !== "Permit2" ||
    asBigInt(domain?.chainId) !== BigInt(BASE_CHAIN_ID) ||
    !sameHex(domain?.verifyingContract, PERMIT2_ADDRESS) ||
    !sameHex(message?.spender, PERMIT2_PROXY_ADDRESS) ||
    !sameHex(permitted?.token, tokenIn) ||
    asBigInt(permitted?.amount) !== maxAmountIn ||
    (asBigInt(message?.nonce) ?? -1n) < 0n ||
    !sameHex(witness?.diamondAddress, LIFI_DIAMOND_ADDRESS) ||
    !sameHex(
      witness?.diamondCalldataHash,
      keccak256(calldata as `0x${string}`),
    ) ||
    asBigInt(message?.deadline) !== BigInt(Math.floor(quote.expiresAtMs / 1000))
  ) {
    throw new Error("The backend returned an invalid Permit2 quote.");
  }
};

export const readPermit2Signature = (value: unknown): `0x${string}` => {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new Error("Wallet did not return a valid signature.");
  }
  if (value.toLowerCase().endsWith(ERC6492_MAGIC_SUFFIX)) {
    throw new Error(
      "Deploy this smart wallet with the token approval, then retry the swap.",
    );
  }
  return value as `0x${string}`;
};

const sameHex = (left: unknown, right: string) =>
  typeof left === "string" && left.toLowerCase() === right.toLowerCase();

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asBigInt = (value: unknown) => {
  try {
    return typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint"
      ? BigInt(value)
      : null;
  } catch {
    return null;
  }
};

const hasExactKeys = (
  value: Record<string, unknown> | null,
  keys: readonly string[],
) => {
  if (!value) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const hasExpectedTypedDataFields = (value: unknown) => {
  const types = asRecord(value);
  if (!types || !hasExactKeys(types, Object.keys(EXPECTED_TYPED_DATA_FIELDS))) {
    return false;
  }

  return Object.entries(EXPECTED_TYPED_DATA_FIELDS).every(
    ([typeName, expectedFields]) => {
      const fields = types[typeName];
      return (
        Array.isArray(fields) &&
        fields.length === expectedFields.length &&
        fields.every((field, index) => {
          const record = asRecord(field);
          const expected = expectedFields[index];
          return (
            expected !== undefined &&
            hasExactKeys(record, ["name", "type"]) &&
            record?.name === expected.name &&
            record.type === expected.type
          );
        })
      );
    },
  );
};

const quoteAmount = (value: string, label: string) => {
  try {
    const amount = BigInt(value);
    if (amount <= 0n) throw new Error();
    return amount;
  } catch {
    throw new Error(`The backend returned an invalid ${label}.`);
  }
};
