import {
  normalizePrivateKey,
  readConfig,
  readKeyFile,
  selectSignerSource,
} from "../session";
import type { Signer } from "../signer";
import { localKeySigner } from "./local-key";
import { savedWalletConnectSigner } from "./wallet-connect";

export const openSigner = async (home: string): Promise<Signer | undefined> => {
  const envKey = process.env.BAIBAI_PRIVATE_KEY;
  const source = selectSignerSource({
    configured: readConfig(home).signer,
    envKey,
  });
  if (source === "env")
    return localKeySigner(normalizePrivateKey(envKey ?? ""));
  if (source === "key") return localKeySigner(readKeyFile(home));
  if (source === "walletconnect") return savedWalletConnectSigner(home);
  return undefined;
};

export const requireSigner = async (home: string) => {
  const signer = await openSigner(home);
  if (!signer) {
    throw new Error(
      "No wallet. Run baibai wallet connect or baibai wallet import.",
    );
  }
  return signer;
};
