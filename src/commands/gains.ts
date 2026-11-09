import { createApi } from "../api";
import { HelpRequested, parseLimitArgs } from "../args";
import { defaultHome } from "../config";
import { writeOut } from "../format";
import { requireSigner } from "../signers/open";

const USAGE = "Usage: baibai gains";

export const gainsCommand = async (argv: string[]) => {
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
  if (parsed.positionals.length > 0) throw new Error(USAGE);
  const signer = await requireSigner(defaultHome());
  try {
    const api = createApi(parsed.apiUrl);
    const [gains, stocks] = await Promise.all([
      api.order.gainsByOwner.query({ owner: signer.address }),
      api.order.stockPurchasesByOwner.query({ owner: signer.address }),
    ]);
    writeOut(
      parsed.json,
      { ...gains, stockPurchasesUsd: stocks.totalUsd },
      [
        `gain     $${gains.totalGainUsd}`,
        `trades   ${gains.totalGainCount}`,
        `filled   ${gains.filledTrades}`,
        `stocks   $${stocks.totalUsd}`,
        "",
      ].join("\n"),
    );
  } finally {
    await signer.close?.();
  }
};
