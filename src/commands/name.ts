import { createApi } from "../api";
import { HelpRequested, parseLimitArgs } from "../args";
import { writeOut } from "../format";
import { isAddress } from "../tokens";

const USAGE = "Usage: baibai name <ens-or-address>";

export const nameCommand = async (argv: string[]) => {
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
  const [input, extra] = parsed.positionals;
  if (!input || extra !== undefined) throw new Error(USAGE);
  const api = createApi(parsed.apiUrl);
  if (isAddress(input)) {
    const result = await api.names.reverse.query({
      address: input.toLowerCase() as `0x${string}`,
    });
    writeOut(
      parsed.json,
      { address: input, name: result.name },
      result.name ? `${result.name}\n` : "No name\n",
    );
    return;
  }
  const result = await api.names.resolve.query({ name: input });
  writeOut(
    parsed.json,
    { address: result.address, name: input },
    result.address ? `${result.address}\n` : "No address\n",
  );
};
