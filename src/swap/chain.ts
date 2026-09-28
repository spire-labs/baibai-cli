import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  maxUint256,
} from "viem";
import { base } from "viem/chains";
import {
  asAddress,
  NATIVE_TOKEN_ADDRESS,
  PERMIT2_ADDRESS,
  RPC_URL,
  WRAPPED_NATIVE_ADDRESS,
} from "../config";
import type { Signer } from "../signer";

const wethAbi = [
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

export const settlementClient = () =>
  createPublicClient({ chain: base, transport: http(RPC_URL) });

export const readAllowance = async (
  token: `0x${string}`,
  owner: `0x${string}`,
) => {
  if (same(token, NATIVE_TOKEN_ADDRESS)) return maxUint256;
  return settlementClient().readContract({
    abi: erc20Abi,
    address: token,
    args: [owner, asAddress(PERMIT2_ADDRESS)],
    functionName: "allowance",
  });
};

export const readBalance = async (
  token: `0x${string}`,
  owner: `0x${string}`,
) => {
  const client = settlementClient();
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

export const waitForReceipt = async (hash: `0x${string}`) => {
  await settlementClient().waitForTransactionReceipt({ hash });
};

export const approvePermit2 = async (signer: Signer, token: `0x${string}`) => {
  const hash = await signer.sendTransaction({
    data: encodeFunctionData({
      abi: erc20Abi,
      args: [asAddress(PERMIT2_ADDRESS), maxUint256],
      functionName: "approve",
    }),
    to: token,
  });
  await waitForReceipt(hash);
};

export const depositNative = async (signer: Signer, amount: bigint) => {
  const hash = await signer.sendTransaction({
    data: encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
    to: asAddress(WRAPPED_NATIVE_ADDRESS),
    value: amount,
  });
  await waitForReceipt(hash);
};

export const withdrawNative = async (signer: Signer, amount: bigint) => {
  const hash = await signer.sendTransaction({
    data: encodeFunctionData({
      abi: wethAbi,
      args: [amount],
      functionName: "withdraw",
    }),
    to: asAddress(WRAPPED_NATIVE_ADDRESS),
  });
  await waitForReceipt(hash);
};
