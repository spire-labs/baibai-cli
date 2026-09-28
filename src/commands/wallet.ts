import { existsSync, unlinkSync } from "node:fs";
import { defaultHome } from "../config";
import { promptHidden } from "../prompt";
import {
  clearSigner,
  deleteKeyFile,
  readConfig,
  readKeyFile,
  saveKey,
  selectSignerSource,
  walletConnectPath,
  writeConfig,
} from "../session";
import { localKeySigner } from "../signers/local-key";
import { openSigner } from "../signers/open";
import { connectWallet, disconnectWallet } from "../signers/wallet-connect";

const USAGE = `Usage:
  baibai wallet connect
  baibai wallet import
  baibai wallet use <key|walletconnect>
  baibai wallet status
  baibai wallet disconnect
`;

export const walletCommand = async (argv: string[]) => {
  const action = argv[0];
  if (action === undefined || action === "--help" || action === "-h") {
    process.stdout.write(USAGE);
    return;
  }
  const home = defaultHome();
  if (action === "import") {
    const key = await promptHidden("Private key: ");
    const saved = saveKey(home, key);
    const signer = localKeySigner(saved);
    process.stdout.write(`Saved key for ${signer.address}\n`);
    return;
  }
  if (action === "connect") {
    const signer = await connectWallet(home);
    writeConfig(home, { signer: "walletconnect" });
    process.stdout.write(`Connected ${signer.address}\n`);
    await signer.close?.();
    return;
  }
  if (action === "status") {
    const source = selectSignerSource({
      configured: readConfig(home).signer,
      envKey: process.env.BAIBAI_PRIVATE_KEY,
    });
    if (!source)
      throw new Error(
        "No wallet. Run baibai wallet connect or baibai wallet import.",
      );
    const signer = await openSigner(home);
    if (!signer)
      throw new Error(
        "No wallet. Run baibai wallet connect or baibai wallet import.",
      );
    const via = source === "env" ? " (environment)" : "";
    process.stdout.write(`${signer.kind} ${signer.address}${via}\n`);
    await signer.close?.();
    return;
  }
  if (action === "use") {
    const kind = argv[1];
    if (kind !== "key" && kind !== "walletconnect") {
      throw new Error("Usage: baibai wallet use <key|walletconnect>");
    }
    if (kind === "key") readKeyFile(home);
    if (kind === "walletconnect" && !existsSync(walletConnectPath(home))) {
      throw new Error("No WalletConnect session. Run baibai wallet connect.");
    }
    writeConfig(home, { signer: kind });
    process.stdout.write(`Using ${kind}\n`);
    return;
  }
  if (action === "disconnect") {
    const source = selectSignerSource({
      configured: readConfig(home).signer,
      envKey: process.env.BAIBAI_PRIVATE_KEY,
    });
    if (source === "env") {
      throw new Error(
        "BAIBAI_PRIVATE_KEY is set for this process. Unset it to stop using that key.",
      );
    }
    if (source === "walletconnect") {
      await disconnectWallet(home);
      if (existsSync(walletConnectPath(home))) {
        unlinkSync(walletConnectPath(home));
      }
    }
    if (source === "key") deleteKeyFile(home);
    clearSigner(home);
    process.stdout.write("Disconnected\n");
    return;
  }
  throw new Error(`Unknown wallet command ${action}\n${USAGE}`);
};
