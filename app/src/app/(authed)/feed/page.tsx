"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  BarChart3,
  Compass,
  Eye,
  Flame,
  Heart,
  ImagePlus,
  LockKeyhole,
  MessageCircle,
  Radio,
  Send,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Video,
  X,
} from "lucide-react";
import PollCard, { type PollData } from "@/components/feed/PollCard";
import PollBuilder, { emptyPollDraft, pollDraftProblem, type PollDraft } from "@/components/feed/PollBuilder";

type FeedCategory = "trending" | "explore" | "erotica" | "poll";
type FeedPost = {
  id: string;
  body: string;
  imageUrl: string;
  videoUrl: string;
  posterUrl: string;
  category: FeedCategory;
  boards?: FeedCategory[];
  views: number;
  poll: PollData | null;
  createdAt: string;
  mine: boolean;
  author: {
    userId: string;
    displayName: string;
    age: number | null;
    avatarUrl: string;
    verified: boolean;
  };
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  comments: { id: string; body: string; author: string; avatarUrl: string }[];
};

type RecommendedProfile = {
  userId: string;
  displayName: string;
  age: number;
  city: string;
  avatarUrl: string;
  verified: boolean;
  live: boolean;
};

const TABS: { id: FeedCategory; label: string; icon: typeof Flame }[] = [
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "erotica", label: "Erotica", icon: LockKeyhole },
  { id: "poll", label: "Polls", icon: BarChart3 },
];

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function PostCard({ post, guest }: { post: FeedPost; guest: boolean }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [comments, setComments] = useState(post.comments);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function requireAccount() {
    router.push(`/signup?next=${encodeURIComponent("/feed")}`);
  }

  async function toggleLike() {
    if (guest) return requireAccount();
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((current) => current + (nextLiked ? 1 : -1));
    if (!post.id.startsWith("demo-")) {
      await fetch(`/api/feed/${post.id}/like`, { method: "POST" });
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guest) return requireAccount();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    if (post.id.startsWith("demo-")) {
      setComments((current) => [
        ...current,
        { id: `local-${Date.now()}`, body, author: "You", avatarUrl: "" },
      ]);
      return;
    }
    const response = await fetch(`/api/feed/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (response.ok) {
      const data = await response.json();
      setComments((current) => [...current, data.comment]);
    }
  }

  async function share() {
    const url = `${window.location.origin}/feed#${post.id}`;
    if (navigator.share) await navigator.share({ title: "Hook247 Pulse", url }).catch(() => undefined);
    else await navigator.clipboard.writeText(url).catch(() => undefined);
  }

  const boards = post.boards?.length ? post.boards : [post.category || "explore"];
  const badgeId = boards.find((id) => id !== "explore") ?? "explore";
  const category = TABS.find((tab) => tab.id === badgeId) ?? TABS[1];

  return (
    <motion.article
      id={post.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="pulse-post"
    >
      <header className="pulse-post-header">
        <Link href={`/profiles/${encodeURIComponent(post.author.userId)}`} className="pulse-author-avatar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.author.avatarUrl} alt={post.author.displayName} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profiles/${encodeURIComponent(post.author.userId)}`} className="flex min-w-0 items-center gap-1.5">
            <strong className="truncate">{post.author.displayName}{post.author.age ? `, ${post.author.age}` : ""}</strong>
            {post.author.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[#df3a6a] text-white" />}
          </Link>
          <p>{timeAgo(post.createdAt)} ago</p>
        </div>
        {badgeId !== "explore" ? (
          <span className="pulse-category" data-category={badgeId}>
            <category.icon className="h-3.5 w-3.5" /> {category.label}
          </span>
        ) : null}
      </header>

      {post.body ? <p className="pulse-post-copy">{post.body}</p> : null}

      {post.videoUrl && (
        <div className="pulse-media pulse-video">
          <video controls playsInline preload="metadata" poster={post.posterUrl}>
            <source src={post.videoUrl} type="video/mp4" />
          </video>
          <span className="pulse-media-label"><Radio className="h-3 w-3" /> Video</span>
        </div>
      )}

      {!post.videoUrl && post.imageUrl && (
        <div className="pulse-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" loading="lazy" />
        </div>
      )}

      {post.poll && (
        <PollCard postId={post.id} initial={post.poll} guest={guest} mine={post.mine} onRequireAccount={requireAccount} />
      )}

      <div className="pulse-actions">
        <button type="button" data-active={liked} onClick={toggleLike}>
          <Heart className={`h-[18px] w-[18px] ${liked ? "fill-current" : ""}`} /> {likeCount}
        </button>
        <button type="button" onClick={() => setCommentsOpen((current) => !current)}>
          <MessageCircle className="h-[18px] w-[18px]" /> {Math.max(post.commentCount, comments.length)}
        </button>
        <button type="button" onClick={share}>
          <Share2 className="h-[18px] w-[18px]" /> Share
        </button>
        <span><Eye className="h-4 w-4" /> {new Intl.NumberFormat("en", { notation: "compact" }).format(post.views)}</span>
      </div>

      <AnimatePresence>
        {commentsOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="pulse-comments">
              {comments.map((comment) => (
                <div key={comment.id}>
                  {comment.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={comment.avatarUrl} alt="" />
                  ) : <span className="pulse-comment-placeholder" />}
                  <p><strong>{comment.author}</strong>{comment.body}</p>
                </div>
              ))}
              <form onSubmit={submitComment}>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder={guest ? "Sign in to comment" : "Add a comment"} />
                <button type="submit" aria-label="Post comment"><Send className="h-4 w-4" /></button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [recommended, setRecommended] = useState<RecommendedProfile[]>([]);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedCategory>("explore");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [pollMode, setPollMode] = useState(false);
  const [pollDraft, setPollDraft] = useState<PollDraft>(emptyPollDraft);

  async function load() {
    const response = await fetch("/api/feed");
    if (response.ok) {
      const data = await response.json();
      setPosts(data.posts ?? []);
      setRecommended(data.recommended ?? []);
      setGuest(!!data.guest);
    }
    setLoading(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/feed", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setPosts(data.posts ?? []);
        setRecommended(data.recommended ?? []);
        setGuest(!!data.guest);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setPosts([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as FeedCategory | null;
    if (tab && TABS.some((item) => item.id === tab)) {
      setActiveTab(tab);
    }
    if (params.get("compose") === "1") {
      document.getElementById("feed-composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.querySelector<HTMLTextAreaElement>("#feed-composer textarea")?.focus();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const visiblePosts = useMemo(() => {
    if (activeTab === "explore") return posts;
    return posts.filter((post) => (post.boards ?? [post.category]).includes(activeTab));
  }, [activeTab, posts]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guest) {
      router.push(`/signup?next=${encodeURIComponent("/feed")}`);
      return;
    }
    const body = draft.trim();
    if (posting) return;
    if (pollMode) {
      const problem = pollDraftProblem(pollDraft);
      if (problem) {
        setUploadError(problem);
        return;
      }
    } else if (!body && !mediaFile) return;
    setPosting(true);
    setUploadError("");
    let imageUrl = "";
    let videoUrl = "";
    if (mediaFile && !pollMode) {
      const upload = new FormData();
      upload.set("file", mediaFile);
      const uploadResponse = await fetch("/api/uploads", { method: "POST", body: upload });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        setUploadError(uploadData.error ?? "The media could not be uploaded.");
        setPosting(false);
        return;
      }
      if (uploadData.kind === "video") videoUrl = uploadData.url;
      else imageUrl = uploadData.url;
    }
    const response = await fetch("/api/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        imageUrl,
        videoUrl,
        ...(pollMode
          ? {
              poll: {
                question: pollDraft.question.trim(),
                options: pollDraft.options.map((o) => o.trim()).filter(Boolean),
                allowMultiple: pollDraft.allowMultiple,
              },
            }
          : {}),
      }),
    });
    if (response.ok) {
      setDraft("");
      setMediaFile(null);
      setMediaKind(null);
      setPreviewUrl("");
      if (pollMode) {
        setPollMode(false);
        setPollDraft(emptyPollDraft());
        setActiveTab("poll");
      }
      await load();
    } else {
      const data = await response.json().catch(() => ({}));
      setUploadError(data.error ?? "Your post could not be published. Try again.");
    }
    setPosting(false);
  }

  function chooseMedia(file: File | undefined) {
    if (!file) return;
    if (guest) {
      router.push(`/signup?next=${encodeURIComponent("/feed")}`);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setMediaFile(file);
    setMediaKind(file.type.startsWith("video/") ? "video" : "image");
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError("");
  }

  function togglePoll() {
    if (guest) {
      router.push(`/signup?next=${encodeURIComponent("/feed")}`);
      return;
    }
    const next = !pollMode;
    setPollMode(next);
    setUploadError("");
    if (next) removeMedia();
  }

  function removeMedia() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setMediaFile(null);
    setMediaKind(null);
    setPreviewUrl("");
  }

  const liveProfiles = recommended.filter((profile) => profile.live).slice(0, 4);

  return (
    <div className="pulse-layout">
      <main className="min-w-0">
        <div className="section-heading-row items-end">
          <div>
            <p className="section-kicker"><Sparkles className="h-3.5 w-3.5" /> Community</p>
            <h1 className="font-display mt-2 text-xl font-extrabold sm:text-2xl">Hooks247 Pulse</h1>
          </div>
          <span className="text-xs text-muted">Fresh from the community</span>
        </div>

        <div className="pulse-tabs mt-4" role="tablist" aria-label="Feed categories">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              data-active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>
        <p className="pulse-tab-hint">
          {activeTab === "explore" && "Explore is every post."}
          {activeTab === "trending" && "Trending is posts people are checking and liking."}
          {activeTab === "erotica" && "Erotica is videos or posts with spicy wording."}
          {activeTab === "poll" && "Polls let the community vote on a question."}
        </p>

        <form id="feed-composer" onSubmit={publish} className="pulse-composer mt-4">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder={guest ? "Join Hooks247 to share an update" : pollMode ? "Add a caption (optional)" : "Share what is happening"} />
          {pollMode && <PollBuilder value={pollDraft} onChange={setPollDraft} />}
          {previewUrl && (
            <div className="pulse-upload-preview">
              {mediaKind === "video" ? <video src={previewUrl} controls playsInline /> : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Upload preview" />
              )}
              <button type="button" onClick={removeMedia} aria-label="Remove upload"><X className="h-4 w-4" /></button>
            </div>
          )}
          {uploadError && <p className="pulse-upload-error">{uploadError}</p>}
          <div className="pulse-composer-footer">
            <div className="pulse-upload-actions">
              {!pollMode && <label>
                <ImagePlus className="h-4 w-4" /> Photo
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => chooseMedia(event.target.files?.[0])} />
              </label>}
              {!pollMode && <label>
                <Video className="h-4 w-4" /> Video
                <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => chooseMedia(event.target.files?.[0])} />
              </label>}
              <button type="button" onClick={togglePoll} data-active={pollMode} aria-pressed={pollMode}>
                <BarChart3 className="h-4 w-4" /> Poll
              </button>
            </div>
            <span>{draft.length}/1000</span>
            <button type="submit" className="btn-primary !px-5 !py-2 text-xs" disabled={(pollMode ? !!pollDraftProblem(pollDraft) : !draft.trim() && !mediaFile) || posting}>{posting ? "Publishing..." : pollMode ? "Post poll" : "Post update"}</button>
          </div>
        </form>

        {loading ? (
          <div className="mt-5 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-lg bg-white/[0.05]" />)}
          </div>
        ) : visiblePosts.length ? (
          <div className="mt-5 space-y-4">
            {visiblePosts.map((post) => <PostCard key={post.id} post={post} guest={guest} />)}
          </div>
        ) : (
          <div className="empty-panel mt-5 flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <Users className="h-8 w-8 text-[#df3a6a]" />
            <h2 className="font-display mt-3 font-bold">Nothing in {TABS.find((tab) => tab.id === activeTab)?.label} yet</h2>
            <p className="mt-2 text-sm text-muted">
              {activeTab === "trending" && "A post lands here after people like and comment on it."}
              {activeTab === "erotica" && "Add a video or spicy text and it shows here automatically."}
              {activeTab === "poll" && "Tap Poll in the composer to ask the community something."}
              {activeTab === "explore" && "Be the first to post."}
            </p>
            <button type="button" className="section-link mt-3" onClick={() => setActiveTab("explore")}>Open Explore</button>
          </div>
        )}
      </main>

      <aside className="pulse-sidebar">
        <section>
          <div className="pulse-sidebar-heading"><span><Radio className="h-4 w-4 text-emerald-400" /> Live on Hooks247</span><Link href="/live">See all</Link></div>
          <div className="pulse-live-list">
            {liveProfiles.map((profile) => (
              <Link key={profile.userId} href={`/live/${encodeURIComponent(profile.userId)}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.avatarUrl} alt={profile.displayName} />
                <span><strong>{profile.displayName}</strong><small>{profile.city}</small></span>
                <i>LIVE</i>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="pulse-sidebar-heading"><span><Users className="h-4 w-4" /> Recommended</span></div>
          <div className="pulse-recommended-list">
            {recommended.slice(0, 6).map((profile) => (
              <div key={profile.userId}>
                <Link href={`/profiles/${encodeURIComponent(profile.userId)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.avatarUrl} alt={profile.displayName} />
                  <span><strong>{profile.displayName}, {profile.age}</strong><small>{profile.city}</small></span>
                </Link>
                <Link href={profile.live ? `/live/${encodeURIComponent(profile.userId)}` : `/profiles/${encodeURIComponent(profile.userId)}`} className="pulse-follow-link">
                  {profile.live ? "Watch" : "View"}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
