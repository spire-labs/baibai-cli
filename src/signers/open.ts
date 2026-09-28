import {
  normalizePrivateKey,
  readConfig,
  readKeyFile,
  selectSignerSource,
} from "../session";
import type { Signer } from "../signer";
import { localKeySigner } from "./local-key";

export const openSigner = async (home: string): Promise<Signer | undefined> => {
  const envKey = process.env.PRIVATE_KEY;
  const source = selectSignerSource({
    configured: readConfig(home).signer,
    envKey,
  });
  if (source === "env")
    return localKeySigner(normalizePrivateKey(envKey ?? ""));
  if (source === "key") return localKeySigner(readKeyFile(home));
  return undefined;
};

export const requireSigner = async (home: string) => {
  const signer = await openSigner(home);
  if (!signer) {
    throw new Error("No wallet. Run baibai wallet import.");
  }
  return signer;
};
