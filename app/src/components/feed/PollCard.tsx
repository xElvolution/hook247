"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export type PollData = {
  id: string;
  question: string;
  allowMultiple: boolean;
  totalVoters: number;
  totalVotes: number;
  myVotes: string[];
  options: { id: string; label: string; votes: number }[];
};

type Voters = { id: string; label: string; voters: { userId: string; displayName: string; avatarUrl: string }[] }[];

const REFRESH_MS = 15_000;

export default function PollCard({
  postId,
  initial,
  guest,
  mine,
  onRequireAccount,
}: {
  postId: string;
  initial: PollData;
  guest: boolean;
  mine: boolean;
  onRequireAccount: () => void;
}) {
  const [poll, setPoll] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [voters, setVoters] = useState<Voters | null>(null);
  const [votersOpen, setVotersOpen] = useState(false);
  const [votersLoading, setVotersLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const pollRef = useRef(initial);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const confirmedRef = useRef(initial);

  // Keep tallies fresh while the poll is on screen, so votes from other people
  // move the bars without a page reload.
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    let timer: number | undefined;
    const refresh = async () => {
      if (savingRef.current || document.hidden) return;
      const response = await fetch(`/api/feed/${postId}/vote`, { cache: "no-store" }).catch(() => null);
      if (!response?.ok || savingRef.current) return;
      const data = await response.json().catch(() => null);
      if (data?.poll && !savingRef.current) {
        confirmedRef.current = data.poll;
        pollRef.current = data.poll;
        setPoll(data.poll);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      window.clearInterval(timer);
      if (entry.isIntersecting) timer = window.setInterval(refresh, REFRESH_MS);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [postId]);

  const voted = poll.myVotes.length > 0;
  const showResults = voted || mine;


  function apply(next: PollData) {
    pollRef.current = next;
    setPoll(next);
  }

  function choose(optionId: string) {
    if (guest) return onRequireAccount();
    const current = pollRef.current;
    const selected = new Set(current.myVotes);
    if (current.allowMultiple) {
      if (selected.has(optionId)) selected.delete(optionId);
      else selected.add(optionId);
    } else if (selected.has(optionId)) {
      selected.clear();
    } else {
      selected.clear();
      selected.add(optionId);
    }
    const next = [...selected];

    // Optimistic tally so the bar moves on tap, then settle on the server's numbers.
    const hadVoted = current.myVotes.length > 0;
    const willVote = next.length > 0;
    apply({
      ...current,
      myVotes: next,
      totalVoters: current.totalVoters + (willVote && !hadVoted ? 1 : 0) - (!willVote && hadVoted ? 1 : 0),
      options: current.options.map((o) => ({
        ...o,
        votes: o.votes + (next.includes(o.id) ? 1 : 0) - (current.myVotes.includes(o.id) ? 1 : 0),
      })),
    });
    setError("");
    setSaving(true);
    savingRef.current = true;
    pendingRef.current += 1;

    // Taps are sent one after another so the last tap always wins on the server.
    queueRef.current = queueRef.current.then(async () => {
      try {
        const response = await fetch(`/api/feed/${postId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionIds: next }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error ?? "Your vote did not go through. Try again.");
          if (response.status === 401) onRequireAccount();
          if (pendingRef.current === 1) apply(confirmedRef.current);
        } else if (data.poll) {
          confirmedRef.current = data.poll;
          if (pendingRef.current === 1) apply(data.poll);
        }
      } catch {
        setError("You seem to be offline. Try again.");
        if (pendingRef.current === 1) apply(confirmedRef.current);
      } finally {
        pendingRef.current -= 1;
        if (pendingRef.current === 0) {
          setSaving(false);
          savingRef.current = false;
          if (votersOpen) void loadVoters();
        }
      }
    });
  }

  async function loadVoters() {
    setVotersLoading(true);
    const response = await fetch(`/api/feed/${postId}/voters`, { cache: "no-store" }).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    setVoters(data?.options ?? []);
    setVotersLoading(false);
  }

  function toggleVoters() {
    const open = !votersOpen;
    setVotersOpen(open);
    if (open) void loadVoters();
  }

  const denominator = Math.max(poll.totalVoters, 1);
  const peopleLabel = `${poll.totalVoters} ${poll.totalVoters === 1 ? "person" : "people"} voted`;

  return (
    <div className="poll-card" ref={cardRef}>
      <h3>{poll.question}</h3>
      <p className="poll-card-hint">
        {poll.allowMultiple ? "Select one or more" : "Select one"}
        {voted ? " · tap again to change" : ""}
      </p>

      <div role={poll.allowMultiple ? "group" : "radiogroup"} aria-label={poll.question}>
        {poll.options.map((option) => {
          const selected = poll.myVotes.includes(option.id);
          const pct = Math.round((option.votes / denominator) * 100);
          return (
            <button
              key={option.id}
              type="button"
              className="poll-option"
              data-selected={selected}
              role={poll.allowMultiple ? "checkbox" : "radio"}
              aria-checked={selected}
              onClick={() => choose(option.id)}
            >
              <span className="poll-option-line">
                <span className="poll-check" data-multi={poll.allowMultiple}>
                  {selected ? <Check className="h-3 w-3" strokeWidth={3.5} /> : null}
                </span>
                <span className="poll-option-label">{option.label}</span>
                {showResults ? (
                  <span className="poll-option-count">
                    {option.votes} · {pct}%
                  </span>
                ) : null}
              </span>
              {showResults ? (
                <span className="poll-bar" aria-hidden="true">
                  <i style={{ width: `${pct}%` }} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? <p className="poll-error" role="alert">{error}</p> : null}

      <div className="poll-card-footer">
        <span className="inline-flex items-center gap-1.5">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {peopleLabel}
        </span>
        {mine ? (
          <button type="button" onClick={toggleVoters} aria-expanded={votersOpen}>
            {votersOpen ? "Hide votes" : "View votes"}
          </button>
        ) : null}
      </div>

      {mine && votersOpen ? (
        <div className="poll-voters">
          {votersLoading && !voters ? (
            <p>Loading votes...</p>
          ) : voters && voters.some((o) => o.voters.length) ? (
            voters.map((option) => (
              <div key={option.id}>
                <h4>
                  {option.label}
                  <small>{option.voters.length}</small>
                </h4>
                {option.voters.length ? (
                  <ul>
                    {option.voters.map((voter) => (
                      <li key={voter.userId}>
                        <Link href={`/profiles/${encodeURIComponent(voter.userId)}`}>
                          {voter.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={voter.avatarUrl} alt="" />
                          ) : (
                            <span className="poll-voter-blank" />
                          )}
                          {voter.displayName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No votes yet</p>
                )}
              </div>
            ))
          ) : (
            <p>No one has voted yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
