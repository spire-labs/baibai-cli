import { createApi } from "../api";
import { HelpRequested, parseLimitArgs } from "../args";
import { defaultHome } from "../config";
import { formatRawAmount, writeOut } from "../format";
import { requireSigner } from "../signers/open";
import { resolveSymbol } from "../tokens";

export const balanceCommand = async (argv: string[]) => {
  let parsed: ReturnType<typeof parseLimitArgs>;
  try {
    parsed = parseLimitArgs(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write("Usage: baibai balance [token]\n");
      return;
    }
    throw error;
  }
  const [token, extra] = parsed.positionals;
  if (extra !== undefined) throw new Error("Usage: baibai balance [token]");
  const signer = await requireSigner(defaultHome());
  try {
    const api = createApi(parsed.apiUrl);
    const portfolio = await api.wallet.portfolio.query({
      owner: signer.address,
    });
    let balances = portfolio.balances;
    if (token) {
      const listed = await api.tokens.list.query();
      const resolved = resolveSymbol(token, [
        ...listed,
        ...balances.map((balance) => ({
          address: balance.token,
          decimals: balance.decimals,
          name: balance.name,
          symbol: balance.symbol,
        })),
      ]);
      balances = balances.filter(
        (balance) =>
          balance.token.toLowerCase() === resolved.address.toLowerCase(),
      );
    }
    const rows = balances.map((balance) => ({
      amount: formatRawAmount(balance.balance, balance.decimals),
      symbol: balance.symbol,
      usd: balance.balanceUsd,
    }));
    const text =
      rows.length === 0
        ? "No balances\n"
        : `${rows
            .map(
              (row) =>
                `${row.symbol.padEnd(8)} ${row.amount}${row.usd ? `  $${row.usd}` : ""}`,
            )
            .join("\n")}\ntotal $${portfolio.totalUsd}\n`;
    writeOut(
      parsed.json,
      { owner: portfolio.owner, rows, totalUsd: portfolio.totalUsd },
      text,
    );
  } finally {
    await signer.close?.();
  }
};
