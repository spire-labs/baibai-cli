import type { PermitTypedData } from "./types";

export type TransactionRequest = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
};

export type Signer = {
  kind: "key" | "walletconnect";
  address: `0x${string}`;
  signTypedData(typedData: PermitTypedData): Promise<`0x${string}`>;
  sendTransaction(tx: TransactionRequest): Promise<`0x${string}`>;
  close?: () => Promise<void>;
};
