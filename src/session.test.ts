import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { keyPath, saveKey, writeConfig } from "./session";
import { openSigner } from "./signers/open";

const ENV_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SAVED_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

describe("openSigner", () => {
  test("an environment key overrides a saved walletconnect session and does not write the key file", async () => {
    const home = mkdtempSync(join(tmpdir(), "baibai-"));
    writeConfig(home, { signer: "walletconnect" });
    saveKey(home, SAVED_KEY);
    writeConfig(home, { signer: "walletconnect" });
    const before = readFileSync(keyPath(home), "utf8");
    const previous = process.env.BAIBAI_PRIVATE_KEY;
    process.env.BAIBAI_PRIVATE_KEY = ENV_KEY;
    try {
      const signer = await openSigner(home);
      expect(signer?.kind).toBe("key");
      expect(signer?.address).toBe(privateKeyToAccount(ENV_KEY).address);
      expect(readFileSync(keyPath(home), "utf8")).toBe(before);
    } finally {
      if (previous === undefined) delete process.env.BAIBAI_PRIVATE_KEY;
      else process.env.BAIBAI_PRIVATE_KEY = previous;
    }
  });

  test("saves an imported key with user-only permissions", () => {
    const home = mkdtempSync(join(tmpdir(), "baibai-"));
    saveKey(home, SAVED_KEY);
    expect(statSync(keyPath(home)).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(home, "config.json"), "utf8")).toContain('"key"');
    writeFileSync(keyPath(home), readFileSync(keyPath(home)));
  });
});
