import { homedir } from "node:os";
import { join } from "node:path";
import packageJson from "../package.json" with { type: "json" };
import {
  BASE_CHAIN_ID,
  defaultNetwork,
  LIFI_PERMIT2_PROXY,
  PERMIT2,
  requireNetwork,
} from "./networks";

export { BASE_CHAIN_ID };
export const PERMIT2_ADDRESS = PERMIT2;
export const PERMIT2_PROXY_ADDRESS = LIFI_PERMIT2_PROXY;
export const WRAPPED_NATIVE_ADDRESS = defaultNetwork()
  .wrappedNativeToken as `0x${string}`;

export const VERSION = packageJson.version;
export const NATIVE_TOKEN_ADDRESS =
  "0x0000000000000000000000000000000000000000";
export const INDICATIVE_OWNER =
  "0x0000000000000000000000000000000000000001" as const;
export const DEFAULT_API_URL = "https://app.baibai.cx/v1/trpc";

const baseRpcUrl = () => {
  const rpcUrl = defaultNetwork().rpcUrl;
  if (rpcUrl === undefined) throw new Error("Base has no RPC.");
  return rpcUrl;
};

export const DEFAULT_RPC_URL = baseRpcUrl();
export const DEFAULT_SLIPPAGE_BPS = 100;
export const ORDER_POLL_INTERVAL_MS = 200;
export const ORDER_POLL_TIMEOUT_MS = 2 * 60 * 1000;

export const asAddress = (value: string) => value as `0x${string}`;

export const defaultHome = () => join(homedir(), ".baibai");

export const resolveApiUrl = (flag: string | undefined) => {
  const url = flag ?? process.env.BAIBAI_API_URL ?? DEFAULT_API_URL;
  if (url.trim().length === 0) {
    throw new Error("API URL is empty.");
  }
  return url;
};

export const resolveRpcUrl = (
  flag: string | undefined,
  chainId: number = BASE_CHAIN_ID,
) => {
  if (flag !== undefined) {
    const url = flag.trim();
    if (url.length === 0) throw new Error("RPC URL is empty.");
    return url;
  }
  if (chainId === BASE_CHAIN_ID && process.env.RPC_URL !== undefined) {
    const url = process.env.RPC_URL.trim();
    if (url.length === 0) throw new Error("RPC URL is empty.");
    return url;
  }
  const network = requireNetwork(chainId);
  if (network.rpcUrl === undefined) {
    throw new Error(`${network.name} has no RPC.`);
  }
  return network.rpcUrl;
};

export const parseSlippageBps = (value: string | undefined) => {
  if (value === undefined) return DEFAULT_SLIPPAGE_BPS;
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error("Slippage must be a percent, for example 1.");
  }
  const bps = Math.round(Number(value) * 100);
  if (bps < 1 || bps > 2_000) {
    throw new Error("Slippage must be between 0.01 and 20 percent.");
  }
  return bps;
};
