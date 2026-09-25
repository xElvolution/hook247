export type FeedBoard = "trending" | "explore" | "erotica" | "poll";

const EROTIC =
  /\b(sex|sexy|sexual|nude|nudes|naked|pussy|dick|cock|fuck|fucking|blow ?job|bj\b|anal|boob|boobs|ass\b|tits|cum|horny|xxx|erotic|erotica|hook ?up|onlyfans|squirting|deepthroat)\b/i;

export function isEroticPost(body: string, videoUrl = "") {
  return Boolean(videoUrl.trim()) || EROTIC.test(body);
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
  const boards: FeedBoard[] = ["explore"];
  if (isPollPost(input.poll, input.storedCategory)) boards.push("poll");
  if (isEroticPost(input.body, input.videoUrl ?? "")) boards.push("erotica");
  if (isTrendingPost(input.likeCount, input.commentCount, input.views)) boards.push("trending");
  return boards;
}

export function primaryBoard(boards: FeedBoard[]): FeedBoard {
  if (boards.includes("poll")) return "poll";
  if (boards.includes("erotica")) return "erotica";
  if (boards.includes("trending")) return "trending";
  return "explore";
}
