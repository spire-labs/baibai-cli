import type { PermitTypedData } from "./types";

const POINTS_SIGNING_DOMAIN = {
  name: "BaiBai Points",
  version: "1",
} as const;

const SIGNATURE_TTL_MS = 10 * 60_000;

export const pointsSignatureDeadlineMs = (nowMs = Date.now()) =>
  nowMs + SIGNATURE_TTL_MS;

const typedData = (
  primaryType: string,
  types: PermitTypedData["types"],
  message: Record<string, unknown>,
): PermitTypedData => ({
  domain: POINTS_SIGNING_DOMAIN,
  message,
  primaryType,
  types,
});

export const bindReferralTypedData = (message: {
  deadlineMs: number;
  owner: string;
  referrerUsername: string;
}) =>
  typedData(
    "BindReferral",
    {
      BindReferral: [
        { name: "owner", type: "address" },
        { name: "referrerUsername", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
    },
    {
      deadline: BigInt(message.deadlineMs),
      owner: message.owner,
      referrerUsername: message.referrerUsername,
    },
  );

export const createReferralUsernameTypedData = (message: {
  deadlineMs: number;
  owner: string;
}) =>
  typedData(
    "CreateReferralUsername",
    {
      CreateReferralUsername: [
        { name: "owner", type: "address" },
        { name: "deadline", type: "uint256" },
      ],
    },
    {
      deadline: BigInt(message.deadlineMs),
      owner: message.owner,
    },
  );

export const commitGoalTypedData = (message: {
  deadlineMs: number;
  goalUsd: number;
  owner: string;
}) =>
  typedData(
    "CommitGoal",
    {
      CommitGoal: [
        { name: "owner", type: "address" },
        { name: "goalUsd", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    {
      deadline: BigInt(message.deadlineMs),
      goalUsd: BigInt(message.goalUsd),
      owner: message.owner,
    },
  );

export const updateReferralUsernameTypedData = (message: {
  deadlineMs: number;
  owner: string;
  username: string;
}) =>
  typedData(
    "UpdateReferralUsername",
    {
      UpdateReferralUsername: [
        { name: "owner", type: "address" },
        { name: "username", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
    },
    {
      deadline: BigInt(message.deadlineMs),
      owner: message.owner,
      username: message.username,
    },
  );
