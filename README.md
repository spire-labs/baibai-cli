# baibai

Trade on Base from the command line. Quotes and swaps use the baibai API. The swap is broadcast by baibai. You pay gas only for an ERC-20 approval, wrapping ETH, or unwrapping WETH.

## Install

GitHub release binary:

```bash
curl -fsSL https://raw.githubusercontent.com/spire-labs/baibai-cli/main/install.sh | sh
```

## Quote

```bash
baibai quote 10 usdc weth
```

A quote does not need a wallet. Without one, the price is indicative and cannot be signed. Tokens are a symbol (`usdc`, `weth`, `eth`) or a `0x` address. The default is an exact-in sell. `--exact-out` makes the amount the desired output. `--slippage` is a percent and defaults to 1.

## Wallet

Import a key. The prompt does not echo. The key is stored in plaintext in `~/.baibai/key`. The file is mode `0600` and the directory is mode `0700`. That only stops other users on this machine from reading it. The key is still readable by this account, by root, and by backups, sync, and disk copies of your home directory. Anyone who can read the file can sign and spend. Use a separate key that holds only what you are willing to trade. `baibai wallet disconnect` deletes the file.

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
