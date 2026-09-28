# baibai

Trade on Base from the command line. Quotes and swaps use the baibai API. The swap is broadcast by baibai. You pay gas only for an ERC-20 approval, wrapping ETH, or unwrapping WETH.

## Install

GitHub release binary:

```bash
curl -fsSL https://raw.githubusercontent.com/spire-labs/baibai-cli/main/install.sh | sh
```

npm:

```bash
npm install -g @baibai/cli
```

## Quote

```bash
baibai quote 10 usdc weth
```

A quote does not need a wallet. Without one, the price is indicative and cannot be signed. Tokens are a symbol (`usdc`, `weth`, `eth`) or a `0x` address. The default is an exact-in sell. `--exact-out` makes the amount the desired output. `--slippage` is a percent and defaults to 1.

## Wallet

Connect an existing wallet:

```bash
baibai wallet connect
```

That prints a WalletConnect QR. The session is stored in `~/.baibai/`. No private key is written.

Or import a key. The prompt does not echo, and the key is stored in `~/.baibai/key` with mode `0600`.

```bash
baibai wallet import
```

`BAIBAI_PRIVATE_KEY` signs for that process only and is not written to disk. It wins over a saved wallet.

```bash
baibai wallet status
baibai wallet use key
baibai wallet use walletconnect
baibai wallet disconnect
```

`wallet connect` needs `WALLETCONNECT_PROJECT_ID` in `src/config.ts`, a WalletConnect Cloud project id. SignClient runs in both the npm bundle and the compiled binary. The binary has no `indexedDB`, so the session is stored in a file.

## Swap

```bash
baibai swap 10 usdc weth
```

The command prints the quote and asks you to confirm. Enter accepts. `--yes` skips the prompt. It approves Permit2 if needed, signs the Permit2 witness, submits the order, and waits until the order is filled, failed, or expired. `eth` is wrapped or unwrapped around the swap, the same way the app does it.

```bash
baibai orders
baibai order <orderId>
baibai balance
```

`--json` prints one JSON object. `--api` overrides the API URL. The default is `https://app.baibai.cx/v1/trpc`. `BAIBAI_API_URL` is the same override.

## Develop

The CLI is a client of the public tRPC API. It does not depend on the private `@baibai/api` package.

```bash
bun install
bun test
bun run build
```
