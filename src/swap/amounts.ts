import { parseUnits } from "viem";

export const parseHumanAmount = (amount: string, decimals: number) => {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) {
    throw new Error("Enter an amount greater than zero.");
  }
  const fraction = amount.split(".")[1];
  if (fraction && fraction.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places.`);
  }
  let parsed: bigint;
  try {
    parsed = parseUnits(amount, decimals);
  } catch {
    throw new Error(`Amount has more than ${decimals} decimal places.`);
  }
  if (parsed <= 0n) throw new Error("Amount must be greater than zero.");
  return parsed;
};
