import { BASE_CHAIN_ID, resolveRpcUrl } from "../config";
import {
  normalizePrivateKey,
  readConfig,
  readKeyFile,
  selectSignerSource,
} from "../session";
import type { Signer } from "../signer";
import { localKeySigner } from "./local-key";

export const openSigner = async (
  home: string,
  chainId: number = BASE_CHAIN_ID,
  rpcUrl: string = resolveRpcUrl(undefined, chainId),
): Promise<Signer | undefined> => {
  const envKey = process.env.PRIVATE_KEY;
  const source = selectSignerSource({
    configured: readConfig(home).signer,
    envKey,
  });
  if (source === "env") {
    return localKeySigner(normalizePrivateKey(envKey ?? ""), chainId, rpcUrl);
  }
  if (source === "key") {
    return localKeySigner(readKeyFile(home), chainId, rpcUrl);
  }
  return undefined;
};

export const requireSigner = async (
  home: string,
  chainId: number = BASE_CHAIN_ID,
  rpcUrl: string = resolveRpcUrl(undefined, chainId),
) => {
  const signer = await openSigner(home, chainId, rpcUrl);
  if (!signer) {
    throw new Error("No wallet. Run baibai wallet import.");
  }
  return signer;
};
