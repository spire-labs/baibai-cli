import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { RPC_URL } from "../config";
import { readPermit2Signature } from "../permit";
import type { Signer } from "../signer";
import type { PermitTypedData } from "../types";

const typedDataForViem = (typedData: PermitTypedData) => {
  const { EIP712Domain: _domainType, ...types } = typedData.types;
  return {
    domain: typedData.domain,
    message: typedData.message,
    primaryType: typedData.primaryType,
    types,
  };
};

export const localKeySigner = (privateKey: `0x${string}`): Signer => {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({
    account,
    chain: base,
    transport: http(RPC_URL),
  });
  return {
    address: account.address,
    kind: "key",
    sendTransaction: (tx) =>
      wallet.sendTransaction({
        account,
        chain: base,
        data: tx.data,
        to: tx.to,
        value: tx.value,
      }),
    signTypedData: async (typedData) => {
      const signature = await wallet.signTypedData(
        typedDataForViem(typedData) as Parameters<
          typeof wallet.signTypedData
        >[0],
      );
      return readPermit2Signature(signature);
    },
  };
};
