import { createInterface } from "node:readline";

export const confirmed = (answer: string) => {
  const value = answer.trim().toLowerCase();
  return value === "y" || value === "yes";
};

export const promptLine = async (label: string) => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  const answer = await new Promise<string>((resolve) => {
    rl.question(label, resolve);
  });
  rl.close();
  return answer.trim();
};

export const promptHidden = async (label: string) => {
  if (!process.stdin.isTTY) return promptLine(label);
  process.stderr.write(label);
  return new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text === "\u0003") {
        stdin.setRawMode(false);
        stdin.pause();
        reject(new Error("Canceled."));
        return;
      }
      if (text === "\r" || text === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stderr.write("\n");
        resolve(value.trim());
        return;
      }
      if (text === "\u007f" || text === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += text;
    };
    stdin.on("data", onData);
  });
};

export const promptConfirm = async () =>
  confirmed(await promptLine("Swap? [y/N] "));
