import { homedir } from "node:os";
import { join } from "node:path";
import packageJson from "../package.json" with { type: "json" };

export const BASE_CHAIN_ID = 8453;
export const PERMIT2_ADDRESS =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
export const PERMIT2_PROXY_ADDRESS =
  "0x89c6340B1a1f4b25D36cd8B063D49045caF3f818" as const;
export const WRAPPED_NATIVE_ADDRESS =
  "0x4200000000000000000000000000000000000006" as const;

export const VERSION = packageJson.version;
export const NATIVE_TOKEN_ADDRESS =
  "0x0000000000000000000000000000000000000000";
export const INDICATIVE_OWNER =
  "0x0000000000000000000000000000000000000001" as const;
export const DEFAULT_API_URL = "https://app.baibai.cx/v1/trpc";
export const RPC_URL = "https://mainnet.base.org";
export const DEFAULT_SLIPPAGE_BPS = 100;
export const ORDER_POLL_INTERVAL_MS = 2_000;
export const ORDER_POLL_TIMEOUT_MS = 2 * 60 * 1000;

// WalletConnect Cloud project id. SignClient runs in the npm bundle and in
// the compiled binary when its storage is a file. The binary has no
// indexedDB, so the client's default browser storage cannot be used.
export const WALLETCONNECT_PROJECT_ID = "";

export const asAddress = (value: string) => value as `0x${string}`;

export const defaultHome = () => join(homedir(), ".baibai");

export const resolveApiUrl = (flag: string | undefined) => {
  const url = flag ?? process.env.BAIBAI_API_URL ?? DEFAULT_API_URL;
  if (url.trim().length === 0) {
    throw new Error("API URL is empty.");
  }
  return url;
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

export const assertWalletConnectConfigured = () => {
  if (!/^[0-9a-f]{32}$/i.test(WALLETCONNECT_PROJECT_ID)) {
    throw new Error(
      "WalletConnect is not configured. Set WALLETCONNECT_PROJECT_ID in src/config.ts to a WalletConnect Cloud project id.",
    );
  }
};
