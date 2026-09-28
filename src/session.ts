import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";

type Config = {
  signer?: "key";
};

export const ensureHome = (home: string) => {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  chmodSync(home, 0o700);
};

const configPath = (home: string) => join(home, "config.json");
export const keyPath = (home: string) => join(home, "key");

export const readConfig = (home: string): Config => {
  const path = configPath(home);
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Config;
  if (parsed.signer !== undefined && parsed.signer !== "key") {
    throw new Error("Wallet config is invalid.");
  }
  return parsed;
};

export const writeConfig = (home: string, config: Config) => {
  ensureHome(home);
  writeFileSync(configPath(home), `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
};

export const clearSigner = (home: string) => {
  writeConfig(home, {});
};

export const normalizePrivateKey = (value: string): `0x${string}` => {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  try {
    privateKeyToAccount(hex as `0x${string}`);
  } catch {
    throw new Error("Private key must be a 32-byte hex string.");
  }
  return hex as `0x${string}`;
};

export const saveKey = (home: string, key: string) => {
  const normalized = normalizePrivateKey(key);
  ensureHome(home);
  const path = keyPath(home);
  writeFileSync(path, `${normalized}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  writeConfig(home, { signer: "key" });
  return normalized;
};

export const readKeyFile = (home: string) => {
  const path = keyPath(home);
  if (!existsSync(path)) {
    throw new Error("No saved key. Run baibai wallet import.");
  }
  return normalizePrivateKey(readFileSync(path, "utf8"));
};

export const deleteKeyFile = (home: string) => {
  const path = keyPath(home);
  if (existsSync(path)) unlinkSync(path);
};

export const selectSignerSource = (args: {
  configured: "key" | undefined;
  envKey: string | undefined;
}): "env" | "key" | undefined => {
  if (args.envKey !== undefined && args.envKey.length > 0) return "env";
  return args.configured;
};
