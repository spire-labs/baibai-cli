import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// WalletConnect's default storage uses indexedDB. The compiled binary does
// not have it, so both install artifacts persist the session here.
export class FileStorage {
  private readonly entries = new Map<string, unknown>();

  constructor(private readonly path: string) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as [
        string,
        unknown,
      ][];
      for (const [key, value] of parsed) this.entries.set(key, value);
    } catch {
      // A missing file is a new session store.
    }
  }

  async getKeys() {
    return [...this.entries.keys()];
  }

  async getEntries<T>() {
    return [...this.entries.entries()] as [string, T][];
  }

  async getItem<T>(key: string) {
    return this.entries.get(key) as T | undefined;
  }

  async setItem(key: string, value: unknown) {
    this.entries.set(key, value);
    this.persist();
  }

  async removeItem(key: string) {
    this.entries.delete(key);
    this.persist();
  }

  private persist() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify([...this.entries.entries()]));
  }
}
