import {
  decodeEventLog,
  type Hex,
  keccak256,
  parseAbi,
  stringToBytes,
} from "viem";

const SWAP_COMPLETED_ABI = parseAbi([
  "event LiFiGenericSwapCompleted(bytes32 indexed transactionId, string integrator, string referrer, address receiver, address fromAssetId, address toAssetId, uint256 fromAmount, uint256 toAmount)",
]);

const SWAP_COMPLETED_TOPIC = keccak256(
  stringToBytes(
    "LiFiGenericSwapCompleted(bytes32,string,string,address,address,address,uint256,uint256)",
  ),
);
const TRANSFER_TOPIC = keccak256(
  stringToBytes("Transfer(address,address,uint256)"),
);

export type ReceiptLog = {
  address: Hex;
  data: Hex;
  topics: readonly Hex[];
};

const same = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

export const swapCompletedOutput = (
  logs: readonly ReceiptLog[] | undefined,
) => {
  let delivered: string | null = null;
  for (const log of logs ?? []) {
    if (log.topics[0] !== SWAP_COMPLETED_TOPIC) continue;
    try {
      const decoded = decodeEventLog({
        abi: SWAP_COMPLETED_ABI,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      delivered = decoded.args.toAmount.toString();
    } catch {
      // A topic match with undecodable data is not this swap's output.
    }
  }
  return delivered;
};

export const transferredOutput = (
  logs: readonly ReceiptLog[] | undefined,
  tokenOut: string,
  recipient: string,
) => {
  let delivered: bigint | null = null;
  for (const log of logs ?? []) {
    if (
      !same(log.address, tokenOut) ||
      log.topics[0] !== TRANSFER_TOPIC ||
      log.topics.length < 3
    ) {
      continue;
    }
    const to = log.topics[2];
    if (!to || !same(`0x${to.slice(26)}`, recipient)) continue;
    try {
      delivered = (delivered ?? 0n) + BigInt(log.data);
    } catch {
      // A non-standard Transfer whose data is not a single amount.
    }
  }
  return delivered === null ? null : delivered.toString();
};
