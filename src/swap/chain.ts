import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  maxUint256,
  type TransactionReceipt,
} from "viem";
import { NATIVE_TOKEN_ADDRESS } from "../config";
import { chainFor, requireNetwork } from "../networks";
import type { Signer } from "../signer";

const wrappedNativeAbi = [
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "wad", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const same = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

export const settlementClient = (chainId: number, rpcUrl: string) => {
  const network = requireNetwork(chainId);
  return createPublicClient({
    chain: chainFor(network, rpcUrl),
    transport: http(rpcUrl),
  });
};

export const readAllowance = async (
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
  chainId: number,
  rpcUrl: string,
) => {
  if (same(token, NATIVE_TOKEN_ADDRESS)) return maxUint256;
  return settlementClient(chainId, rpcUrl).readContract({
    abi: erc20Abi,
    address: token,
    args: [owner, spender],
    functionName: "allowance",
  });
};

export const readBalance = async (
  token: `0x${string}`,
  owner: `0x${string}`,
  chainId: number,
  rpcUrl: string,
) => {
  const client = settlementClient(chainId, rpcUrl);
  if (same(token, NATIVE_TOKEN_ADDRESS)) {
    return client.getBalance({ address: owner });
  }
  return client.readContract({
    abi: erc20Abi,
    address: token,
    args: [owner],
    functionName: "balanceOf",
  });
};

export const waitForReceipt = async (
  hash: `0x${string}`,
  chainId: number,
  rpcUrl: string,
) => settlementClient(chainId, rpcUrl).waitForTransactionReceipt({ hash });

export const approveSpender = async (
  signer: Signer,
  token: `0x${string}`,
  spender: `0x${string}`,
  chainId: number,
  rpcUrl: string,
) => {
  const hash = await signer.sendTransaction({
    data: encodeFunctionData({
      abi: erc20Abi,
      args: [spender, maxUint256],
      functionName: "approve",
    }),
    to: token,
  });
  const receipt = await waitForReceipt(hash, chainId, rpcUrl);
  if (receipt.status !== "success") {
    throw new Error("Token approval failed.");
  }
};

export const depositNative = async (
  signer: Signer,
  wrapped: `0x${string}`,
  amount: bigint,
  chainId: number,
  rpcUrl: string,
) => {
  const hash = await signer.sendTransaction({
    data: encodeFunctionData({
      abi: wrappedNativeAbi,
      functionName: "deposit",
    }),
    to: wrapped,
    value: amount,
  });
  const receipt = await waitForReceipt(hash, chainId, rpcUrl);
  if (receipt.status !== "success") throw new Error("Wrap failed.");
};

export const withdrawNative = async (
  signer: Signer,
  wrapped: `0x${string}`,
  amount: bigint,
  chainId: number,
  rpcUrl: string,
) => {
  const hash = await signer.sendTransaction({
    data: encodeFunctionData({
      abi: wrappedNativeAbi,
      args: [amount],
      functionName: "withdraw",
    }),
    to: wrapped,
  });
  const receipt = await waitForReceipt(hash, chainId, rpcUrl);
  if (receipt.status !== "success") throw new Error("Unwrap failed.");
};

export type SettlementReceipt = Pick<TransactionReceipt, "logs" | "status">;
