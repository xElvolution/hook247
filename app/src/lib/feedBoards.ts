export type FeedBoard = "trending" | "explore" | "erotica" | "poll";

const EROTIC =
  /\b(sex|sexy|sexual|nude|nudes|naked|pussy|dick|cock|fuck|fucking|blow ?job|bj\b|anal|boob|boobs|ass\b|tits|cum|horny|xxx|erotic|erotica|hook ?up|onlyfans|squirting|deepthroat)\b/i;

const QUESTION =
  /^(who|what|when|where|why|how|should|do you|are you|is it|which|would you|can you)\b/i;

export function isEroticPost(body: string, videoUrl = "") {
  return Boolean(videoUrl.trim()) || EROTIC.test(body);
}

export function isPollPost(body: string, poll: unknown) {
  if (poll) return true;
  const text = body.trim();
  return text.includes("?") || QUESTION.test(text);
}

export function isTrendingPost(likeCount: number, commentCount: number, views = 0) {
  return likeCount + commentCount * 2 >= 3 || views >= 80;
}

export function feedBoards(input: {
  body: string;
  videoUrl?: string;
  poll?: unknown;
  likeCount: number;
  commentCount: number;
  views?: number;
}): FeedBoard[] {
  const boards: FeedBoard[] = ["explore"];
  if (isPollPost(input.body, input.poll)) boards.push("poll");
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
