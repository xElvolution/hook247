import { Prisma } from "@prisma/client";
import { db } from "./db";

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 12;

export type PollView = {
  id: string;
  question: string;
  allowMultiple: boolean;
  totalVoters: number;
  totalVotes: number;
  myVotes: string[];
  options: { id: string; label: string; votes: number }[];
};

/** Prisma include for a post's poll with per-option counts and the viewer's picks. */
export function pollInclude(userId: string | null) {
  return {
    options: {
      orderBy: { position: "asc" as const },
      include: { _count: { select: { votes: true } } },
    },
    votes: { where: { userId: userId ?? "__nobody__" }, select: { optionId: true } },
  } satisfies Prisma.PollInclude;
}

type PollRow = Prisma.PollGetPayload<{ include: ReturnType<typeof pollInclude> }>;

/**
 * Distinct voters per poll. Percentages are measured against voters rather
 * than votes, which is how multi-answer polls stay honest: each option shows
 * the share of people who picked it.
 */
export async function voterCounts(pollIds: string[]) {
  const counts = new Map<string, number>();
  if (!pollIds.length) return counts;
  const rows = await db.$queryRaw<{ pollId: string; voters: bigint }[]>`
    SELECT "pollId", COUNT(DISTINCT "userId") AS voters
    FROM "PollVote"
    WHERE "pollId" IN (${Prisma.join(pollIds)})
    GROUP BY "pollId"`;
  for (const row of rows) counts.set(row.pollId, Number(row.voters));
  return counts;
}

export function serializePoll(poll: PollRow, voters: number): PollView {
  const options = poll.options.map((o) => ({ id: o.id, label: o.label, votes: o._count.votes }));
  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    totalVoters: voters,
    totalVotes: options.reduce((sum, o) => sum + o.votes, 0),
    myVotes: poll.votes.map((v) => v.optionId),
    options,
  };
}

export async function loadPollView(postId: string, userId: string | null) {
  const poll = await db.poll.findUnique({ where: { postId }, include: pollInclude(userId) });
  if (!poll) return null;
  const counts = await voterCounts([poll.id]);
  return serializePoll(poll, counts.get(poll.id) ?? 0);
}
