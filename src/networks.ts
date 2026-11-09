import { type Chain, defineChain } from "viem";
import {
  abstract,
  apeChain,
  arbitrum,
  avalanche,
  base,
  berachain,
  bsc,
  celo,
  gnosis,
  hyperEvm,
  ink,
  linea,
  mainnet,
  monad,
  optimism,
  polygon,
  robinhood,
  ronin,
  rootstock,
  scroll,
  soneium,
  unichain,
  worldchain,
  zkSync,
} from "viem/chains";

/**
 * Networks and settlement contracts the web app trades on.
 * Kept in step with baibai-new/web/lib/networks.ts and
 * baibai-new/api/src/chains.ts. This package does not import those.
 */

export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
export const ZKSYNC_PERMIT2 =
  "0x0000000000225e31D15943971F47aD3022F714Fa" as const;
export const LIFI_PERMIT2_PROXY =
  "0x89c6340B1a1f4b25D36cd8B063D49045caF3f818" as const;
export const LIFI_DIAMOND =
  "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE" as const;
export const KYBER_ROUTER =
  "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" as const;
export const BASE_KYBER_SETTLER =
  "0xbf8E65Fe0711F6B2424372A65070b7A4F2B26567" as const;
export const ROBINHOOD_KYBER_SETTLER =
  "0x551f25E294f9dAE56463A62DBcfd063cA8785B83" as const;
export const HYPERCORE_CHAIN_ID = 1337;
export const HYPERCORE_PERPS_USDC =
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831" as const;
export const HYPERCORE_SPOT_USDC =
  "0x6d1e7cde53ba9467b783cb7c530ce05400000000" as const;

const LIFI_DIAMOND_BY_CHAIN: Partial<Record<number, `0x${string}`>> = {
  130: "0x864b314D4C5a0399368609581d3E8933a63b9232",
  143: "0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37",
  232: "0xF3B20515d9B193531c48E47c18aF16d1e5d28f9a",
  324: "0x341e94069f53234fe6dabef707ad424830525715",
  999: "0x0a0758d937d1059c356D4714e57F5df0239bce1A",
  1868: "0x864b314D4C5a0399368609581d3E8933a63b9232",
  2020: "0x452Cf1B8597E6319Cd21abd847312bF17E26d8d1",
  2741: "0x4f8C9056bb8A3616693a76922FA35d53C056E5b3",
  4663: "0xB477751B76CF82d00a686A1232f5fCD772414Af3",
  33139: "0x2dea447e7dc6cd2f10b31bF10dCB30F87E838417",
  57073: "0x864b314D4C5a0399368609581d3E8933a63b9232",
  59144: "0xde1e598b81620773454588b85d6b5d4eec32573e",
  80094: "0xf909c4Ae16622898b885B89d7F839E0244851c66",
};

const LIFI_PERMIT2_PROXY_BY_CHAIN: Partial<Record<number, `0x${string}`>> = {
  130: "0x1BCd304fDAd1d1D66529159b1Bc8D13C9158D586",
  143: "0x3c6B2E0b7421254846C53c118e24c65d59eAe75e",
  232: "0xEC32b79Ce6c4F80160029BDb26CB4a13bB03999A",
  324: "0x2ec2c4C3dc212C990d1bc2b48b0392A3951D926E",
  999: "0x3e851976DCA1bc02A2F35Ce926dCAFD1dEB3359b",
  1868: "0x1BCd304fDAd1d1D66529159b1Bc8D13C9158D586",
  2020: "0xfeD71074954d4cb8f1D2A8ca317d72c75e3E0559",
  2741: "0xbb7c30Dc5AcE1A51940b202182c07D45e3e2Cba4",
  4663: "0x8eABB4E117fB70b346592e013855f6d825F50af1",
  57073: "0x1BCd304fDAd1d1D66529159b1Bc8D13C9158D586",
  59144: "0xE5A89411c7Ef1502123d84ec1F9Da9D8574F4293",
  80094: "0x66C8F3F645Bc61ed1740067D381830f7c7925d98",
};

export const lifiDiamondForChain = (chainId: number): `0x${string}` =>
  LIFI_DIAMOND_BY_CHAIN[chainId] ?? LIFI_DIAMOND;

export const lifiPermit2ProxyForChain = (chainId: number): `0x${string}` =>
  LIFI_PERMIT2_PROXY_BY_CHAIN[chainId] ?? LIFI_PERMIT2_PROXY;

export type Network = {
  aliases: readonly string[];
  id: number;
  kyberRouter?: `0x${string}`;
  kyberSettler?: `0x${string}`;
  lifiDiamond: `0x${string}`;
  name: string;
  nativeDecimals: number;
  nativeErc20?: `0x${string}`;
  nativeSymbol: string;
  permit2: `0x${string}`;
  permit2Proxy: `0x${string}`;
  rpcUrl?: string;
  slug: string;
  wrappedNativeToken: `0x${string}` | null;
};

type NetworkSpec = {
  aliases?: readonly string[];
  id: number;
  kyber?: boolean;
  name: string;
  nativeErc20?: `0x${string}`;
  nativeSymbol: string;
  permit2?: `0x${string}`;
  rpcUrl?: string;
  settler?: `0x${string}`;
  slug: string;
  wrappedNativeToken: `0x${string}` | null;
};

const spec = (value: NetworkSpec): Network => ({
  aliases: value.aliases ?? [],
  id: value.id,
  kyberRouter: value.kyber ? KYBER_ROUTER : undefined,
  kyberSettler: value.settler,
  lifiDiamond: lifiDiamondForChain(value.id),
  name: value.name,
  nativeDecimals: 18,
  nativeErc20: value.nativeErc20,
  nativeSymbol: value.nativeSymbol,
  permit2: value.permit2 ?? PERMIT2,
  permit2Proxy: lifiPermit2ProxyForChain(value.id),
  rpcUrl: value.rpcUrl,
  slug: value.slug,
  wrappedNativeToken: value.wrappedNativeToken,
});

const WETH = "0x4200000000000000000000000000000000000006" as const;

export const NETWORKS: readonly Network[] = [
  spec({
    aliases: ["eth", "mainnet", "ethereum mainnet", "l1"],
    id: 1,
    kyber: true,
    name: "Ethereum",
    nativeSymbol: "ETH",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    slug: "ethereum",
    wrappedNativeToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  }),
  spec({
    aliases: ["base chain", "base mainnet"],
    id: 8453,
    kyber: true,
    name: "Base",
    nativeSymbol: "ETH",
    rpcUrl: "https://mainnet.base.org",
    settler: BASE_KYBER_SETTLER,
    slug: "base",
    wrappedNativeToken: WETH,
  }),
  spec({
    aliases: ["robinhood", "rh", "hood"],
    id: 4663,
    kyber: true,
    name: "Robinhood Chain",
    nativeSymbol: "ETH",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    settler: ROBINHOOD_KYBER_SETTLER,
    slug: "robinhood-chain",
    wrappedNativeToken: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  }),
  spec({
    aliases: ["hyperliquid", "hyper", "hl", "hype", "hyperevm"],
    id: 999,
    kyber: true,
    name: "HyperEVM",
    nativeSymbol: "HYPE",
    rpcUrl: "https://rpc.hyperliquid.xyz/evm",
    slug: "hyperevm",
    wrappedNativeToken: "0x5555555555555555555555555555555555555555",
  }),
  spec({
    aliases: ["hypercore", "hl-core"],
    id: HYPERCORE_CHAIN_ID,
    name: "HyperCore",
    nativeSymbol: "USDC",
    slug: "hypercore",
    wrappedNativeToken: null,
  }),
  spec({
    aliases: [
      "bnb",
      "bsc",
      "binance",
      "binance smart chain",
      "bnb smart chain",
    ],
    id: 56,
    kyber: true,
    name: "BNB Chain",
    nativeSymbol: "BNB",
    rpcUrl: "https://bsc-dataseed.binance.org",
    slug: "bnb-chain",
    wrappedNativeToken: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  }),
  spec({
    aliases: ["arb", "arbitrum one", "arb1"],
    id: 42161,
    kyber: true,
    name: "Arbitrum",
    nativeSymbol: "ETH",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    slug: "arbitrum",
    wrappedNativeToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  }),
  spec({
    aliases: ["poly", "matic", "pol", "polygon pos"],
    id: 137,
    kyber: true,
    name: "Polygon",
    nativeSymbol: "POL",
    rpcUrl: "https://polygon-bor-rpc.publicnode.com",
    slug: "polygon",
    wrappedNativeToken: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  }),
  spec({
    aliases: ["op", "op mainnet", "optimism mainnet"],
    id: 10,
    kyber: true,
    name: "Optimism",
    nativeSymbol: "ETH",
    rpcUrl: "https://mainnet.optimism.io",
    slug: "optimism",
    wrappedNativeToken: WETH,
  }),
  spec({
    aliases: ["avax", "avalanche c-chain", "c-chain"],
    id: 43114,
    kyber: true,
    name: "Avalanche",
    nativeSymbol: "AVAX",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    slug: "avalanche",
    wrappedNativeToken: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  }),
  spec({
    aliases: ["uni"],
    id: 130,
    kyber: true,
    name: "Unichain",
    nativeSymbol: "ETH",
    rpcUrl: "https://mainnet.unichain.org",
    slug: "unichain",
    wrappedNativeToken: WETH,
  }),
  spec({
    aliases: ["mon"],
    id: 143,
    kyber: true,
    name: "Monad",
    nativeSymbol: "MON",
    rpcUrl: "https://rpc.monad.xyz",
    slug: "monad",
    wrappedNativeToken: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  }),
  spec({
    aliases: ["bera"],
    id: 80094,
    kyber: true,
    name: "Berachain",
    nativeSymbol: "BERA",
    rpcUrl: "https://rpc.berachain.com",
    slug: "berachain",
    wrappedNativeToken: "0x6969696969696969696969696969696969696969",
  }),
  spec({
    id: 59144,
    kyber: true,
    name: "Linea",
    nativeSymbol: "ETH",
    rpcUrl: "https://rpc.linea.build",
    slug: "linea",
    wrappedNativeToken: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
  }),
  spec({
    id: 534352,
    name: "Scroll",
    nativeSymbol: "ETH",
    rpcUrl: "https://rpc.scroll.io",
    slug: "scroll",
    wrappedNativeToken: "0x5300000000000000000000000000000000000004",
  }),
  spec({
    aliases: ["zksync era", "era", "zk"],
    id: 324,
    name: "zkSync",
    nativeSymbol: "ETH",
    permit2: ZKSYNC_PERMIT2,
    rpcUrl: "https://mainnet.era.zksync.io",
    slug: "zksync",
    wrappedNativeToken: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91",
  }),
  spec({
    aliases: ["xdai", "gno"],
    id: 100,
    name: "Gnosis",
    nativeSymbol: "XDAI",
    rpcUrl: "https://rpc.gnosischain.com",
    slug: "gnosis",
    wrappedNativeToken: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d",
  }),
  spec({
    aliases: ["world", "worldchain", "wld"],
    id: 480,
    name: "World Chain",
    nativeSymbol: "ETH",
    rpcUrl: "https://worldchain-mainnet.g.alchemy.com/public",
    slug: "world-chain",
    wrappedNativeToken: WETH,
  }),
  spec({
    aliases: ["ink chain"],
    id: 57073,
    name: "Ink",
    nativeSymbol: "ETH",
    rpcUrl: "https://rpc-gel.inkonchain.com",
    slug: "ink",
    wrappedNativeToken: WETH,
  }),
  spec({
    id: 42220,
    name: "Celo",
    nativeErc20: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    nativeSymbol: "CELO",
    rpcUrl: "https://forno.celo.org",
    slug: "celo",
    wrappedNativeToken: null,
  }),
  spec({
    aliases: ["abs"],
    id: 2741,
    name: "Abstract",
    nativeSymbol: "ETH",
    permit2: ZKSYNC_PERMIT2,
    rpcUrl: "https://api.mainnet.abs.xyz",
    slug: "abstract",
    wrappedNativeToken: "0x3439153EB7AF838Ad19d56E1571FBD09333C2809",
  }),
  spec({
    aliases: ["ron", "axie"],
    id: 2020,
    kyber: true,
    name: "Ronin",
    nativeSymbol: "RON",
    rpcUrl: "https://api.roninchain.com/rpc",
    slug: "ronin",
    wrappedNativeToken: "0xe514d9DEB7966c8BE0ca922de8a064264eA6bcd4",
  }),
  spec({
    aliases: ["sony"],
    id: 1868,
    name: "Soneium",
    nativeSymbol: "ETH",
    rpcUrl: "https://rpc.soneium.org",
    slug: "soneium",
    wrappedNativeToken: WETH,
  }),
  spec({
    aliases: ["ape"],
    id: 33139,
    name: "ApeChain",
    nativeSymbol: "APE",
    rpcUrl: "https://rpc.apechain.com",
    slug: "apechain",
    wrappedNativeToken: "0x48b62137EdfA95a428D35C09E44256a739F6B557",
  }),
  spec({
    aliases: ["rsk", "rbtc"],
    id: 30,
    name: "Rootstock",
    nativeSymbol: "RBTC",
    rpcUrl: "https://public-node.rsk.co",
    slug: "rootstock",
    wrappedNativeToken: "0x542fDA317318eBF1d3DEAf76E0b632741A7e677d",
  }),
];

const networksById = new Map(NETWORKS.map((network) => [network.id, network]));

const viemChains = [
  mainnet,
  base,
  robinhood,
  hyperEvm,
  bsc,
  arbitrum,
  polygon,
  optimism,
  avalanche,
  unichain,
  monad,
  berachain,
  linea,
  scroll,
  zkSync,
  gnosis,
  worldchain,
  ink,
  celo,
  abstract,
  ronin,
  soneium,
  apeChain,
  rootstock,
] as const;

const viemChainById = new Map<number, Chain>(
  viemChains.map((chain) => [chain.id, chain]),
);

export const BASE_CHAIN_ID = 8453;

export const findNetwork = (chainId: number) => networksById.get(chainId);

export const requireNetwork = (chainId: number): Network => {
  const network = findNetwork(chainId);
  if (!network) throw new Error(`Chain ${chainId} is not supported.`);
  return network;
};

export const defaultNetwork = () => requireNetwork(BASE_CHAIN_ID);

export const resolveNetwork = (input: string): Network => {
  const needle = input.trim().toLowerCase();
  if (needle.length === 0) throw new Error("Network name is empty.");
  if (/^\d+$/.test(needle)) {
    const byId = findNetwork(Number(needle));
    if (byId) return byId;
  }
  const found = NETWORKS.find(
    (network) =>
      network.slug === needle ||
      network.name.toLowerCase() === needle ||
      network.aliases.some((alias) => alias === needle),
  );
  if (!found) throw new Error(`Unknown network ${input}.`);
  return found;
};

export const chainFor = (network: Network, rpcUrl: string): Chain => {
  const viemChain = viemChainById.get(network.id);
  const nativeCurrency = {
    decimals: network.nativeDecimals,
    name: network.nativeSymbol,
    symbol: network.nativeSymbol,
  };
  return defineChain({
    ...(viemChain ?? {
      id: network.id,
      name: network.name,
      nativeCurrency,
    }),
    id: network.id,
    name: network.name,
    nativeCurrency,
    rpcUrls: { default: { http: [rpcUrl] } },
  });
};

export const networkOrder = (chainId: number) => {
  const index = NETWORKS.findIndex((network) => network.id === chainId);
  return index === -1 ? NETWORKS.length : index;
};
