import { keccak256, parseUnits } from "viem";
import { BASE_CHAIN_ID, NATIVE_TOKEN_ADDRESS } from "./config";
import { requireNetwork } from "./networks";
import type { MessageQuote, Quote, RelayerQuote, UserQuote } from "./types";

export const LIFI_DIAMOND_ADDRESS =
  "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
const MAX_QUOTE_LIFETIME_MS = 2 * 60 * 1000;
const MAX_WITHDRAWAL_QUOTE_LIFETIME_MS = (180 + 60) * 1000;
const HYPERLIQUID_WITHDRAWAL_ACTIONS = new Set([
  "HyperliquidTransaction:SendAsset",
  "HyperliquidTransaction:Withdraw",
]);
const ERC6492_MAGIC_SUFFIX = "6492".repeat(16);

export const SETTLEMENT_CHANGED_MESSAGE =
  "Gas sponsorship changed for this trade. Review the updated quote and try again.";

const LIFI_TYPED_DATA_FIELDS = {
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

const ORDER_WITNESS_TYPED_DATA_FIELDS = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  OrderWitness: [
    { name: "recipient", type: "address" },
    { name: "tokenOut", type: "address" },
    { name: "minAmountOut", type: "uint256" },
  ],
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "OrderWitness" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
} as const;

export type QuotePermitExpectation = {
  authorizedAmountIn: bigint;
  destinationChainId?: number;
  expectedSettlement?: Quote["settlement"];
  intent: "exactIn" | "exactOut";
  minimumAmountOut: bigint;
  nowMs?: number;
  owner: string;
  quote: Quote;
  recipient: string;
  sellTokenDecimals?: number;
  slippageBps: number;
  sourceChainId?: number;
  tokenIn: string;
  tokenOut: string;
};

export const approvalSpender = (quote: Quote): `0x${string}` => {
  if (quote.settlement === "message") {
    throw new Error("A withdrawal is signed, not approved.");
  }
  const network = requireNetwork(quote.chainIdIn);
  if (quote.settlement !== "user") return network.permit2;
  if ("kyber" in quote.venue) {
    if (!network.kyberRouter) {
      throw new Error("The backend returned an invalid swap transaction.");
    }
    return network.kyberRouter;
  }
  return network.lifiDiamond;
};

export const assertQuotePermit = ({
  authorizedAmountIn,
  destinationChainId = BASE_CHAIN_ID,
  expectedSettlement,
  intent,
  minimumAmountOut,
  nowMs = Date.now(),
  owner,
  quote,
  recipient,
  sellTokenDecimals,
  slippageBps,
  sourceChainId = BASE_CHAIN_ID,
  tokenIn,
  tokenOut,
}: QuotePermitExpectation): void => {
  const maxLifetimeMs =
    quote.settlement === "message"
      ? MAX_WITHDRAWAL_QUOTE_LIFETIME_MS
      : MAX_QUOTE_LIFETIME_MS;
  if (
    !sameHex(quote.owner, owner) ||
    !sameHex(quote.recipient, recipient) ||
    !sameHex(quote.tokenIn, tokenIn) ||
    !sameHex(quote.tokenOut, tokenOut) ||
    quote.slippageBps !== slippageBps ||
    quote.chainIdIn !== sourceChainId ||
    quote.chainIdOut !== destinationChainId ||
    quote.expiresAtMs <= nowMs ||
    quote.expiresAtMs > nowMs + maxLifetimeMs
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

  if (
    expectedSettlement !== undefined &&
    quote.settlement !== expectedSettlement
  ) {
    throw new Error(SETTLEMENT_CHANGED_MESSAGE);
  }

  if (quote.settlement === "message") {
    if (sellTokenDecimals === undefined) {
      throw new Error("Sell decimals are required to check a withdrawal.");
    }
    assertWithdrawalMessages(quote, {
      amountIn: maxAmountIn,
      owner,
      sellTokenDecimals,
    });
    return;
  }

  if (quote.settlement === "user") {
    assertUserSwapTransaction(quote, {
      maxAmountIn,
      sourceChainId,
      tokenIn,
    });
    return;
  }

  assertRelayerPermit(quote, {
    maxAmountIn,
    minAmountOut,
    recipient,
    sourceChainId,
    tokenIn,
    tokenOut,
  });
};

const assertRelayerPermit = (
  quote: RelayerQuote,
  args: {
    maxAmountIn: bigint;
    minAmountOut: bigint;
    recipient: string;
    sourceChainId: number;
    tokenIn: string;
    tokenOut: string;
  },
) => {
  const network = requireNetwork(args.sourceChainId);
  const domain = asRecord(quote.permit2TypedData.domain);
  const message = asRecord(quote.permit2TypedData.message);
  const permitted = asRecord(message?.permitted);
  const witness = asRecord(message?.witness);
  const sharedValid =
    hasExactKeys(domain, ["chainId", "name", "verifyingContract"]) &&
    hasExactKeys(message, [
      "deadline",
      "nonce",
      "permitted",
      "spender",
      "witness",
    ]) &&
    hasExactKeys(permitted, ["amount", "token"]) &&
    quote.permit2TypedData.primaryType === "PermitWitnessTransferFrom" &&
    domain?.name === "Permit2" &&
    asBigInt(domain?.chainId) === BigInt(args.sourceChainId) &&
    sameHex(domain?.verifyingContract, network.permit2) &&
    sameHex(permitted?.token, args.tokenIn) &&
    asBigInt(permitted?.amount) === args.maxAmountIn &&
    (asBigInt(message?.nonce) ?? -1n) >= 0n &&
    asBigInt(message?.deadline) ===
      BigInt(Math.floor(quote.expiresAtMs / 1000));

  const venueValid =
    "kyber" in quote.venue
      ? network.kyberSettler !== undefined &&
        hasExactKeys(witness, ["recipient", "tokenOut", "minAmountOut"]) &&
        hasExpectedTypedDataFields(
          quote.permit2TypedData.types,
          ORDER_WITNESS_TYPED_DATA_FIELDS,
        ) &&
        sameHex(message?.spender, network.kyberSettler) &&
        sameHex(witness?.recipient, args.recipient) &&
        sameHex(witness?.tokenOut, args.tokenOut) &&
        asBigInt(witness?.minAmountOut) === args.minAmountOut
      : hasExactKeys(witness, ["diamondAddress", "diamondCalldataHash"]) &&
        hasExpectedTypedDataFields(
          quote.permit2TypedData.types,
          LIFI_TYPED_DATA_FIELDS,
        ) &&
        sameHex(message?.spender, network.permit2Proxy) &&
        sameHex(witness?.diamondAddress, network.lifiDiamond) &&
        sameHex(
          witness?.diamondCalldataHash,
          keccak256(quote.venue.lifi.calldata as `0x${string}`),
        );

  if (!sharedValid || !venueValid) {
    throw new Error("The backend returned an invalid Permit2 quote.");
  }
};

const assertWithdrawalMessages = (
  quote: MessageQuote,
  args: { amountIn: bigint; owner: string; sellTokenDecimals: number },
) => {
  const invalid = () =>
    new Error("The backend returned an invalid withdrawal to sign.");
  let actions = 0;
  for (const typedData of quote.typedData) {
    const domain = asRecord(typedData.domain);
    const message = asRecord(typedData.message);
    if (HYPERLIQUID_WITHDRAWAL_ACTIONS.has(typedData.primaryType)) {
      actions += 1;
      const amount = message?.amount;
      if (
        domain?.name !== "HyperliquidSignTransaction" ||
        message?.hyperliquidChain !== "Mainnet" ||
        typeof amount !== "string" ||
        !/^\d+(\.\d+)?$/.test(amount) ||
        parseUnits(amount, args.sellTokenDecimals) !== args.amountIn
      ) {
        throw invalid();
      }
      const moves =
        typedData.primaryType === "HyperliquidTransaction:Withdraw"
          ? sameHex(message?.destination, args.owner)
          : typeof message?.token === "string" &&
            message.token.startsWith("USDC:") &&
            message?.fromSubAccount === "" &&
            (message?.sourceDex === "" || message?.sourceDex === "spot");
      if (!moves) throw invalid();
      continue;
    }
    if (
      typedData.primaryType !== "NonceMapping" ||
      domain?.name !== "RelayNonceMapping" ||
      !sameHex(message?.wallet, args.owner) ||
      !sameHex(message?.depositor, args.owner)
    ) {
      throw invalid();
    }
  }
  if (actions !== 1) throw invalid();
};

const assertUserSwapTransaction = (
  quote: UserQuote,
  args: {
    maxAmountIn: bigint;
    sourceChainId: number;
    tokenIn: string;
  },
) => {
  const network = requireNetwork(args.sourceChainId);
  const venue =
    "kyber" in quote.venue
      ? { calldata: quote.venue.kyber.calldata, router: network.kyberRouter }
      : { calldata: quote.venue.lifi.calldata, router: network.lifiDiamond };
  const transaction = quote.transactionRequest;
  const value = asBigInt(transaction.value);
  const nativeIn = sameHex(args.tokenIn, NATIVE_TOKEN_ADDRESS);
  if (
    venue.router === undefined ||
    transaction.chainId !== args.sourceChainId ||
    !sameHex(transaction.to, venue.router) ||
    transaction.data.toLowerCase() !== venue.calldata.toLowerCase() ||
    value === null ||
    (nativeIn ? value !== args.maxAmountIn : value !== 0n)
  ) {
    throw new Error("The backend returned an invalid swap transaction.");
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

const hasExpectedTypedDataFields = (
  value: unknown,
  expectedFieldsByType: Record<
    string,
    ReadonlyArray<{ name: string; type: string }>
  >,
) => {
  const types = asRecord(value);
  if (!types || !hasExactKeys(types, Object.keys(expectedFieldsByType))) {
    return false;
  }

  return Object.entries(expectedFieldsByType).every(
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
