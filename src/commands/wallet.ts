import { defaultHome } from "../config";
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
  if (action === "status") {
    const source = selectSignerSource({
      configured: readConfig(home).signer,
      envKey: process.env.BAIBAI_PRIVATE_KEY,
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
      envKey: process.env.BAIBAI_PRIVATE_KEY,
    });
    if (source === "env") {
      throw new Error(
        "BAIBAI_PRIVATE_KEY is set for this process. Unset it to stop using that key.",
      );
    }
    deleteKeyFile(home);
    clearSigner(home);
    process.stdout.write("Disconnected\n");
    return;
  }
  throw new Error(`Unknown wallet command ${action}\n${USAGE}`);
};
