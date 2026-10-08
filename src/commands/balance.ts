import { createApi } from "../api";
import { HelpRequested, parseLimitArgs } from "../args";
import { defaultHome } from "../config";
import { formatRawAmount, writeOut } from "../format";
import { findNetwork, networkOrder } from "../networks";
import { requireSigner } from "../signers/open";
import type { Portfolio } from "../types";

const USAGE = "Usage: baibai balance [token] [--chain <network>]";

export const balanceCommand = async (argv: string[]) => {
  let parsed: ReturnType<typeof parseLimitArgs>;
  try {
    parsed = parseLimitArgs(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write(`${USAGE}\n`);
      return;
    }
    throw error;
  }
  const [token, extra] = parsed.positionals;
  if (extra !== undefined) throw new Error(USAGE);
  const signer = await requireSigner(defaultHome());
  try {
    const api = createApi(parsed.apiUrl);
    const portfolios = parsed.chain
      ? [
          await api.wallet.portfolio.query({
            chainId: parsed.chain.id,
            owner: signer.address,
          }),
        ]
      : await api.wallet.portfolios.query({ owner: signer.address });
    const ordered = [...portfolios].sort(
      (left, right) => networkOrder(left.chainId) - networkOrder(right.chainId),
    );
    const sections = ordered.map((portfolio) =>
      presentPortfolio(portfolio, token),
    );
    const visible = sections.filter((section) => section.rows.length > 0);
    const text =
      visible.length === 0
        ? "No balances\n"
        : `${visible
            .map((section) =>
              [
                section.chain,
                ...section.rows.map(
                  (row) =>
                    `  ${row.symbol.padEnd(8)} ${row.amount}${row.usd ? `  $${row.usd}` : ""}`,
                ),
                `  total $${section.totalUsd}`,
              ].join("\n"),
            )
            .join("\n\n")}\n`;
    writeOut(parsed.json, { owner: signer.address, portfolios: visible }, text);
  } finally {
    await signer.close?.();
  }
};

const presentPortfolio = (portfolio: Portfolio, token: string | undefined) => {
  const needle = token?.toLowerCase();
  const balances = needle
    ? portfolio.balances.filter(
        (balance) =>
          balance.symbol.toLowerCase() === needle ||
          balance.token.toLowerCase() === needle,
      )
    : portfolio.balances;
  return {
    chain: findNetwork(portfolio.chainId)?.name ?? String(portfolio.chainId),
    chainId: portfolio.chainId,
    rows: balances.map((balance) => ({
      amount: formatRawAmount(balance.balance, balance.decimals),
      symbol: balance.symbol,
      usd: balance.balanceUsd,
    })),
    totalUsd: portfolio.totalUsd,
  };
};
