export type FeedBoard = "trending" | "explore" | "erotica" | "poll";

/**
 * Erotica is an explicit choice the author makes at post time (with an 18+
 * attestation), never a guess from the wording, because it decides who is
 * allowed to see the post at all.
 */
export function isEroticPost(storedCategory = "") {
  return storedCategory === "erotica";
}

/**
 * A post belongs on the Polls board when it carries a real poll. Posts saved
 * as "poll" before structured polls existed keep their place on the board.
 */
export function isPollPost(poll: unknown, storedCategory = "") {
  return Boolean(poll) || storedCategory === "poll";
}

export function isTrendingPost(likeCount: number, commentCount: number, views = 0) {
  return likeCount + commentCount * 2 >= 3 || views >= 80;
}

export function feedBoards(input: {
  body: string;
  videoUrl?: string;
  poll?: unknown;
  storedCategory?: string;
  likeCount: number;
  commentCount: number;
  views?: number;
}): FeedBoard[] {
  // Erotica never leaks onto the public boards: it lives behind the 18+ gate only.
  if (isEroticPost(input.storedCategory)) return ["erotica"];
  const boards: FeedBoard[] = ["explore"];
  if (isPollPost(input.poll, input.storedCategory)) boards.push("poll");
  if (isTrendingPost(input.likeCount, input.commentCount, input.views)) boards.push("trending");
  return boards;
}

export function primaryBoard(boards: FeedBoard[]): FeedBoard {
  if (boards.includes("poll")) return "poll";
  if (boards.includes("erotica")) return "erotica";
  if (boards.includes("trending")) return "trending";
  return "explore";
}
