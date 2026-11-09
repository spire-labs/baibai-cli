import { accumulateCommand } from "./commands/accumulate";
import { balanceCommand } from "./commands/balance";
import { gainsCommand } from "./commands/gains";
import { nameCommand } from "./commands/name";
import { orderCommand, ordersCommand } from "./commands/orders";
import { pointsCommand } from "./commands/points";
import { quoteCommand } from "./commands/quote";
import { swapCommand } from "./commands/swap";
import { tokenCommand, tokensCommand } from "./commands/tokens";
import { walletCommand } from "./commands/wallet";
import { VERSION } from "./config";

const HELP = `baibai — trade on the networks the app supports

  baibai quote <amount> <tokenIn> <tokenOut>
  baibai swap <amount> <tokenIn> <tokenOut>
  baibai accumulate [--amount <cap>]
  baibai wallet import
  baibai wallet status
  baibai wallet disconnect
  baibai orders
  baibai order <orderId>
  baibai balance [token]
  baibai gains
  baibai tokens
  baibai tokens search <query>
  baibai tokens stocks
  baibai token <network> <token>
  baibai name <ens-or-address>
  baibai points
  baibai points leaderboard
  baibai points scan
  baibai points commit <usd>
  baibai points referral
  baibai points referral bind <username>
  baibai points referral rename <username>

Flags
  --amount <cap>         max tokens sold on each accumulate swap
  --from <network>       network of tokenIn, default base
  --to <network>         network of tokenOut, default the source network
  --slippage <percent>   default 1
  --exact-out            the amount is the desired output
  --recipient <address>  0x address or ENS name
  --yes                  accept the swap without prompting
  --fast                 skip the balance and allowance eth_calls
  --chain <network>      balance on one network
  --limit <n>            orders or leaderboard page size
  --cursor <cursor>      orders page
  --period <1d|1w|1m|1y>
  --json
  --api <url>            default https://app.baibai.cx/v1/trpc
  --rpc <url>            RPC for the network the command writes to

A token may name its network: arb:usdc, eth:0x…, hypercore:usdc. Omitting --to keeps the trade on one network. Base is the default. A relayer quote is submitted for you. A user quote is approved and broadcast by this key, then recorded. A message quote withdraws from HyperCore: each message is signed and submitted. On HyperCore, usdc is the perps balance and spot is the spot balance. baibai accumulate swaps USDC and USDT when a gasless quote guarantees a larger minimum output, and repeats until interrupted.
`;

const main = async () => {
  const argv = process.argv.slice(2);
  const [command, ...rest] = argv;
  if (
    command === undefined ||
    command === "--help" ||
    command === "-h" ||
    command === "help"
  ) {
    process.stdout.write(HELP);
    return;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (command === "quote") return quoteCommand(rest);
  if (command === "swap") return swapCommand(rest);
  if (command === "accumulate") return accumulateCommand(rest);
  if (command === "wallet") return walletCommand(rest);
  if (command === "orders") return ordersCommand(rest);
  if (command === "order") return orderCommand(rest);
  if (command === "balance") return balanceCommand(rest);
  if (command === "gains") return gainsCommand(rest);
  if (command === "tokens") return tokensCommand(rest);
  if (command === "token") return tokenCommand(rest);
  if (command === "name") return nameCommand(rest);
  if (command === "points") return pointsCommand(rest);
  throw new Error(`${command}: unknown command\n\n${HELP}`);
};

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  process.exit(process.exitCode ?? 0);
}
