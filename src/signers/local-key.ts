import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainFor, requireNetwork } from "../networks";
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

export const localKeySigner = (
  privateKey: `0x${string}`,
  chainId: number,
  rpcUrl?: string,
): Signer => {
  const network = requireNetwork(chainId);
  const endpoint = rpcUrl ?? network.rpcUrl;
  const chain = chainFor(network, endpoint ?? "http://127.0.0.1");
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({
    account,
    chain,
    transport: http(endpoint ?? "http://127.0.0.1"),
  });
  return {
    address: account.address,
    kind: "key",
    sendTransaction: (tx) => {
      if (!endpoint) throw new Error(`${network.name} has no RPC.`);
      return wallet.sendTransaction({
        account,
        chain,
        data: tx.data,
        to: tx.to,
        value: tx.value,
      });
    },
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
