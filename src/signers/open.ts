import { resolveRpcUrl } from "../config";
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
  rpcUrl: string = resolveRpcUrl(undefined),
): Promise<Signer | undefined> => {
  const envKey = process.env.PRIVATE_KEY;
  const source = selectSignerSource({
    configured: readConfig(home).signer,
    envKey,
  });
  if (source === "env")
    return localKeySigner(normalizePrivateKey(envKey ?? ""), rpcUrl);
  if (source === "key") return localKeySigner(readKeyFile(home), rpcUrl);
  return undefined;
};

export const requireSigner = async (
  home: string,
  rpcUrl: string = resolveRpcUrl(undefined),
) => {
  const signer = await openSigner(home, rpcUrl);
  if (!signer) {
    throw new Error("No wallet. Run baibai wallet import.");
  }
  return signer;
};
