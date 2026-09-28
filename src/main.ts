import { balanceCommand } from "./commands/balance";
import { orderCommand, ordersCommand } from "./commands/orders";
import { quoteCommand } from "./commands/quote";
import { swapCommand } from "./commands/swap";
import { walletCommand } from "./commands/wallet";
import { VERSION } from "./config";

const HELP = `baibai — trade on Base

  baibai quote <amount> <tokenIn> <tokenOut>
  baibai swap <amount> <tokenIn> <tokenOut>
  baibai wallet connect
  baibai wallet import
  baibai wallet use <key|walletconnect>
  baibai wallet status
  baibai wallet disconnect
  baibai orders
  baibai order <orderId>
  baibai balance [token]

Flags
  --slippage <percent>   default 1
  --exact-out            the amount is the desired output
  --recipient <address>
  --yes                  skip the swap confirmation
  --json
  --api <url>            default https://app.baibai.cx/v1/trpc
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
  if (command === "wallet") return walletCommand(rest);
  if (command === "orders") return ordersCommand(rest);
  if (command === "order") return orderCommand(rest);
  if (command === "balance") return balanceCommand(rest);
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
