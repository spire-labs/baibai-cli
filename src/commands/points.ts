import { createApi } from "../api";
import { HelpRequested, parseLimitArgs } from "../args";
import { defaultHome } from "../config";
import { writeOut } from "../format";
import {
  bindReferralTypedData,
  createReferralUsernameTypedData,
  pointsSignatureDeadlineMs,
  updateReferralUsernameTypedData,
} from "../points-signing";
import { requireSigner } from "../signers/open";
import type { PointsSummary } from "../types";

const USAGE = `Usage:
  baibai points
  baibai points leaderboard
  baibai points referral
  baibai points referral bind <username>
  baibai points referral rename <username>
`;

const USERNAME = /^[A-Za-z0-9_]{3,32}$/;

export const pointsCommand = async (argv: string[]) => {
  const [action, ...rest] = argv;
  if (action === "--help" || action === "-h") {
    process.stdout.write(USAGE);
    return;
  }
  if (action === undefined || action === "summary" || action.startsWith("-")) {
    return summaryCommand(action?.startsWith("-") ? [action, ...rest] : rest);
  }
  if (action === "leaderboard") return leaderboardCommand(rest);
  if (action === "referral") return referralCommand(rest);
  throw new Error(`Unknown points command ${action}\n${USAGE}`);
};

const summaryCommand = async (argv: string[]) => {
  const parsed = parsePointsArgs(argv, "Usage: baibai points");
  if (!parsed) return;
  const signer = await requireSigner(defaultHome());
  try {
    const summary = await createApi(parsed.apiUrl).points.summary.query({
      owner: signer.address,
    });
    writeOut(parsed.json, summary, formatSummary(summary));
  } finally {
    await signer.close?.();
  }
};

const leaderboardCommand = async (argv: string[]) => {
  const parsed = parsePointsArgs(argv, "Usage: baibai points leaderboard");
  if (!parsed) return;
  if (parsed.positionals.length > 0) {
    throw new Error("Usage: baibai points leaderboard");
  }
  const board = await createApi(parsed.apiUrl).points.leaderboard.query({
    limit: parsed.limit,
    page: parsed.page,
  });
  const text =
    board.entries.length === 0
      ? "No entries\n"
      : `${board.entries
          .map(
            (entry) =>
              `${String(entry.rank).padEnd(4)} ${entry.owner}  ${entry.totalPoints}  $${entry.volumeUsd}`,
          )
          .join("\n")}\n`;
  writeOut(parsed.json, board, text);
};

const referralCommand = async (argv: string[]) => {
  const [action, ...rest] = argv;
  if (action === undefined || action.startsWith("-")) {
    return mutateReferral(action ? [action, ...rest] : rest, "create");
  }
  if (action === "bind") return mutateReferral(rest, "bind");
  if (action === "rename") return mutateReferral(rest, "rename");
  throw new Error(USAGE);
};

const mutateReferral = async (
  argv: string[],
  action: "bind" | "create" | "rename",
) => {
  const parsed = parsePointsArgs(argv, USAGE);
  if (!parsed) return;
  const username = parsed.positionals[0];
  const extra = parsed.positionals[1];
  if (action === "create" && username !== undefined) throw new Error(USAGE);
  if (action !== "create" && (!username || extra !== undefined)) {
    throw new Error(USAGE);
  }
  if (username !== undefined && !USERNAME.test(username)) {
    throw new Error("Usernames are 3-32 letters, digits, or underscores.");
  }
  const signer = await requireSigner(defaultHome());
  try {
    const api = createApi(parsed.apiUrl);
    const deadlineMs = pointsSignatureDeadlineMs();
    const owner = signer.address;
    if (action === "create") {
      const signature = await signer.signTypedData(
        createReferralUsernameTypedData({ deadlineMs, owner }),
      );
      await api.points.createReferralUsername.mutate({
        deadlineMs,
        owner,
        signature,
      });
    } else if (action === "bind") {
      const signature = await signer.signTypedData(
        bindReferralTypedData({
          deadlineMs,
          owner,
          referrerUsername: username ?? "",
        }),
      );
      await api.points.bindReferral.mutate({
        deadlineMs,
        owner,
        referrerUsername: username ?? "",
        signature,
      });
    } else {
      const signature = await signer.signTypedData(
        updateReferralUsernameTypedData({
          deadlineMs,
          owner,
          username: username ?? "",
        }),
      );
      await api.points.updateReferralUsername.mutate({
        deadlineMs,
        owner,
        signature,
        username: username ?? "",
      });
    }
    const summary = await api.points.summary.query({ owner });
    writeOut(parsed.json, summary, formatSummary(summary));
  } finally {
    await signer.close?.();
  }
};

const parsePointsArgs = (argv: string[], usage: string) => {
  try {
    const parsed = parseLimitArgs(argv);
    if (parsed.positionals.length > 1) throw new Error(usage);
    return parsed;
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write(`${usage}\n`);
      return undefined;
    }
    throw error;
  }
};

const formatSummary = (summary: PointsSummary) => {
  const username = summary.referral.username?.username;
  return [
    `points    ${summary.totalPoints ?? "0"}`,
    summary.rank ? `rank      ${summary.rank}` : undefined,
    `volume    $${summary.volumeUsd}`,
    `streak    ${summary.streak.days} days`,
    `referrals ${summary.referral.referredCount}`,
    username ? `username  ${username}` : "username  none",
    summary.referral.referrerUsername
      ? `referrer  ${summary.referral.referrerUsername}`
      : undefined,
    "",
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
};
