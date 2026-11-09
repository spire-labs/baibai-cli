import { BASE_CHAIN_ID, resolveRpcUrl } from "../config";
import { requireNetwork } from "../networks";
import {
  normalizePrivateKey,
  readConfig,
  readKeyFile,
  selectSignerSource,
} from "../session";
import type { Signer } from "../signer";
import { localKeySigner } from "./local-key";

const signerRpc = (chainId: number, rpcUrl: string | undefined) => {
  if (rpcUrl !== undefined) return rpcUrl;
  if (requireNetwork(chainId).rpcUrl === undefined) return undefined;
  return resolveRpcUrl(undefined, chainId);
};

export const openSigner = async (
  home: string,
  chainId: number = BASE_CHAIN_ID,
  rpcUrl?: string,
): Promise<Signer | undefined> => {
  const resolvedRpc = signerRpc(chainId, rpcUrl);
  const envKey = process.env.PRIVATE_KEY;
  const source = selectSignerSource({
    configured: readConfig(home).signer,
    envKey,
  });
  if (source === "env") {
    return localKeySigner(
      normalizePrivateKey(envKey ?? ""),
      chainId,
      resolvedRpc,
    );
  }
  if (source === "key") {
    return localKeySigner(readKeyFile(home), chainId, resolvedRpc);
  }
  return undefined;
};

export const requireSigner = async (
  home: string,
  chainId: number = BASE_CHAIN_ID,
  rpcUrl?: string,
) => {
  const signer = await openSigner(home, chainId, rpcUrl);
  if (!signer) {
    throw new Error("No wallet. Run baibai wallet import.");
  }
  return signer;
};
