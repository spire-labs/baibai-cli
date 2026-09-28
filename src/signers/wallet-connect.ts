import { SignClient } from "@walletconnect/sign-client";
import QRCode from "qrcode";
import {
  assertWalletConnectConfigured,
  WALLETCONNECT_PROJECT_ID,
} from "../config";
import { readPermit2Signature } from "../permit";
import { walletConnectPath } from "../session";
import type { Signer, TransactionRequest } from "../signer";
import { FileStorage } from "./file-storage";

const BASE_CHAIN = "eip155:8453";
const BASE_ACCOUNT = /^eip155:8453:(0x[a-fA-F0-9]{40})$/i;

type Client = Awaited<ReturnType<typeof SignClient.init>>;

const metadata = {
  description: "Trade on baibai",
  icons: ["https://app.baibai.cx/favicon.ico"],
  name: "baibai",
  url: "https://app.baibai.cx",
};

export const baseAccount = (accounts: readonly string[]) => {
  for (const account of accounts) {
    const match = BASE_ACCOUNT.exec(account);
    const address = match?.[1];
    if (address) return address as `0x${string}`;
  }
  return undefined;
};

const openClient = async (home: string) => {
  assertWalletConnectConfigured();
  return SignClient.init({
    metadata,
    projectId: WALLETCONNECT_PROJECT_ID,
    storage: new FileStorage(walletConnectPath(home)),
  });
};

const sessionAccounts = (client: Client) =>
  client.session
    .getAll()
    .flatMap((session) => session.namespaces.eip155?.accounts ?? []);

const signerFromClient = (client: Client, address: `0x${string}`): Signer => {
  const session = client.session.getAll()[0];
  if (!session) throw new Error("No WalletConnect session.");
  const request = (method: string, params: unknown) =>
    client.request({
      chainId: BASE_CHAIN,
      request: { method, params },
      topic: session.topic,
    });
  return {
    address,
    close: async () => {
      const relayer = client.core.relayer as {
        transportClose?: () => Promise<void>;
      };
      await relayer.transportClose?.();
    },
    kind: "walletconnect",
    sendTransaction: async (tx: TransactionRequest) => {
      const hash = await request("eth_sendTransaction", [
        {
          data: tx.data,
          from: address,
          to: tx.to,
          value:
            tx.value === undefined ? undefined : `0x${tx.value.toString(16)}`,
        },
      ]);
      if (typeof hash !== "string" || !hash.startsWith("0x")) {
        throw new Error("Wallet did not return a transaction hash.");
      }
      return hash as `0x${string}`;
    },
    signTypedData: async (typedData) => {
      const signature = await request("eth_signTypedData_v4", [
        address,
        JSON.stringify(typedData),
      ]);
      return readPermit2Signature(signature);
    },
  };
};

export const savedWalletConnectSigner = async (
  home: string,
): Promise<Signer> => {
  const client = await openClient(home);
  const address = baseAccount(sessionAccounts(client));
  if (!address) {
    const relayer = client.core.relayer as {
      transportClose?: () => Promise<void>;
    };
    await relayer.transportClose?.();
    throw new Error("No WalletConnect session. Run baibai wallet connect.");
  }
  return signerFromClient(client, address);
};

export const connectWallet = async (home: string) => {
  const client = await openClient(home);
  const existing = baseAccount(sessionAccounts(client));
  if (existing) return signerFromClient(client, existing);

  const { approval, uri } = await client.connect({
    requiredNamespaces: {
      eip155: {
        chains: [BASE_CHAIN],
        events: ["chainChanged", "accountsChanged"],
        methods: [
          "eth_signTypedData_v4",
          "eth_sendTransaction",
          "wallet_switchEthereumChain",
        ],
      },
    },
  });
  if (uri) {
    process.stderr.write(`${uri}\n`);
    process.stderr.write(
      `${await QRCode.toString(uri, { small: true, type: "terminal" })}\n`,
    );
    process.stderr.write("Approve the connection in your wallet.\n");
  }
  const session = await approval();
  const address = await requireBaseAccount(client, session);
  return signerFromClient(client, address);
};

const requireBaseAccount = async (
  client: Client,
  session: {
    namespaces: { eip155?: { accounts?: string[]; chains?: string[] } };
    topic: string;
  },
) => {
  const current = baseAccount(session.namespaces.eip155?.accounts ?? []);
  if (current) return current;
  const chainId = session.namespaces.eip155?.chains?.[0];
  if (chainId) {
    await client.request({
      chainId,
      request: {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }],
      },
      topic: session.topic,
    });
  }
  const updated = client.session.get(session.topic);
  const address = baseAccount(updated?.namespaces.eip155?.accounts ?? []);
  if (!address) {
    throw new Error("The wallet did not connect an account on Base.");
  }
  return address;
};

export const disconnectWallet = async (home: string) => {
  const client = await openClient(home);
  for (const session of client.session.getAll()) {
    await client.disconnect({
      reason: { code: 6000, message: "User disconnected" },
      topic: session.topic,
    });
  }
  const relayer = client.core.relayer as {
    transportClose?: () => Promise<void>;
  };
  await relayer.transportClose?.();
};
