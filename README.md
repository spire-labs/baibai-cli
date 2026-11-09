# baibai

Trade from the command line on the same networks as the app. Quotes and swaps use the baibai API. On Base and Robinhood Chain, baibai can submit the swap: you pay gas only for an ERC-20 approval, wrapping the native token, or unwrapping it. On other routes the API returns a transaction, and this key approves the router and broadcasts it. A withdrawal from HyperCore is signed messages, and this key pays no gas for it.

## Install

GitHub release binary:

```bash
curl -fsSL https://raw.githubusercontent.com/spire-labs/baibai-cli/main/install.sh | sh
```

## Quote

```bash
baibai quote 10 usdc weth
baibai quote 10 usdc eth --from arbitrum
baibai quote 25 usdc eth --from base --to optimism
baibai quote 10 arb:usdc eth:weth
baibai quote 10 usdc usdc --from base --to hypercore
baibai quote 10 spot usdc --from hypercore --to arbitrum
```

A quote does not need a wallet. Without one, the price is indicative and cannot be signed. Tokens are a symbol (`usdc`, `weth`, `eth`) or a `0x` address. `eth` is the native token. On other networks the native symbol works too (`bnb`, `pol`). A token can name its network with `network:token`. `--from` sets the sell network and, unless `--to` is set, the buy network as well. The default is Base. `--exact-out` makes the amount the desired output. `--slippage` is a percent and defaults to 1. `--recipient` is an `0x` address or an ENS name. On HyperCore, `usdc` is the perps balance and `spot` is the spot balance. HyperCore has no RPC: withdrawals are signed, and deposits are swaps on the chain you sell from.

Wrapping and unwrapping the native token is 1:1 and is not quoted.

## Wallet

Import a key. The prompt does not echo. The key is stored in plaintext in `~/.baibai/key`. The key is plain text and readable by anyone with access to your home directory. Anyone who can read the file can sign and spend. Use a separate key that holds only what you are willing to trade. `baibai wallet disconnect` deletes the file.

```bash
baibai wallet import
```

`PRIVATE_KEY` signs for that process only and is not written to disk. It wins over the saved key. A key in the environment can still leak through process listings, crash reports, and shell history.

```bash
baibai wallet status
baibai wallet disconnect
```

## Swap

```bash
baibai swap 10 usdc weth
baibai swap 10 usdc eth --from arbitrum --yes
```

The command prints the quote and asks you to confirm. Enter accepts. `--yes` skips the prompt. A `relayer` quote approves Permit2 if needed, signs the Permit2 witness, submits the order, and waits while the order is pending or bridging. A `user` quote approves the venue router, sends the swap transaction from this key, and records it. A `message` quote signs each withdrawal message and submits those signatures. `eth` is wrapped or unwrapped around a same-chain swap. A native token bought on another network is delivered by the bridge and is not unwrapped here. `--fast` skips the balance and allowance `eth_call`s and submits immediately. The token must already be approved, and an insufficient balance fails when the order is filled or the transaction reverts.

```bash
baibai orders
baibai orders --cursor <cursor>
baibai order <orderId>
baibai balance
baibai balance --chain base
baibai gains
```

## Accumulate

`baibai accumulate` swaps USDC and USDT, on Base by default, whenever a gasless quote guarantees more of the other stable than you sell. One USDT swaps only when the minimum received is more than one USDC. The loop repeats until you stop it. `--amount` caps each swap. `--from` chooses the network.

```bash
baibai accumulate
baibai accumulate --amount 1000 --from base
```

A Permit2 approval is the only transaction this key pays for. Quotes use 0.01% slippage, the smallest the API accepts, so the minimum output stays close to the quoted price.

## Tokens, names, and points

```bash
baibai tokens
baibai tokens search usd
baibai tokens stocks
baibai token base usdc
baibai token base usdc --period 1w
baibai name vitalik.eth
baibai points
baibai points leaderboard
baibai points scan
baibai points commit 1000
baibai points referral
baibai points referral bind <username>
baibai points referral rename <username>
```

Referral changes and a points commit are signed by the key. A username is 3–32 letters, digits, or underscores, and it can be renamed once. `baibai gains` also prints the USD of tokenized stocks bought since the stock cashback campaign began.

`--json` prints one JSON object. `--api` overrides the API URL. The default is `https://app.baibai.cx/v1/trpc`. `BAIBAI_API_URL` is the same override. `--rpc` overrides the RPC for the network the command sends transactions on. Each network has a public RPC. `RPC_URL` overrides Base only.

## Develop

The CLI is a client of the public tRPC API. It does not depend on the private `@baibai/api` package.

```bash
bun install
bun test
bun run build
```
