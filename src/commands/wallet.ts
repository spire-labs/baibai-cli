import { defaultHome, resolveRpcUrl } from "../config";
import { promptHidden } from "../prompt";
import {
  clearSigner,
  deleteKeyFile,
  readConfig,
  saveKey,
  selectSignerSource,
} from "../session";
import { localKeySigner } from "../signers/local-key";
import { openSigner } from "../signers/open";

const USAGE = `Usage:
  baibai wallet import
  baibai wallet status
  baibai wallet disconnect

import stores the private key in plaintext at ~/.baibai/key.
Anyone who can read that file can spend its funds.
`;

export const walletCommand = async (argv: string[]) => {
  const action = argv[0];
  if (action === undefined || action === "--help" || action === "-h") {
    process.stdout.write(USAGE);
    return;
  }
  const home = defaultHome();
  if (action === "import") {
    process.stderr.write(
      "Warning: the private key is stored in plaintext at ~/.baibai/key.\nAnyone who can read that file can spend its funds. Use a dedicated key.\n",
    );
    const key = await promptHidden("Private key: ");
    const saved = saveKey(home, key);
    const signer = localKeySigner(saved, resolveRpcUrl(undefined));
    process.stdout.write(`Saved key for ${signer.address}\n`);
    return;
  }
  if (action === "status") {
    const source = selectSignerSource({
      configured: readConfig(home).signer,
      envKey: process.env.PRIVATE_KEY,
    });
    if (!source) throw new Error("No wallet. Run baibai wallet import.");
    const signer = await openSigner(home);
    if (!signer) throw new Error("No wallet. Run baibai wallet import.");
    const via = source === "env" ? " (environment)" : "";
    process.stdout.write(`${signer.kind} ${signer.address}${via}\n`);
    return;
  }
  if (action === "disconnect") {
    const source = selectSignerSource({
      configured: readConfig(home).signer,
      envKey: process.env.PRIVATE_KEY,
    });
    if (source === "env") {
      throw new Error(
        "PRIVATE_KEY is set for this process. Unset it to stop using that key.",
      );
    }
    deleteKeyFile(home);
    clearSigner(home);
    process.stdout.write("Disconnected\n");
    return;
  }
  throw new Error(`Unknown wallet command ${action}\n${USAGE}`);
};
