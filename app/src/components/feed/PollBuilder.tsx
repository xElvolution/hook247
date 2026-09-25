"use client";

import { Plus, X } from "lucide-react";

export const POLL_MIN = 2;
export const POLL_MAX = 12;

export type PollDraft = { question: string; options: string[]; allowMultiple: boolean };

export function emptyPollDraft(): PollDraft {
  return { question: "", options: ["", ""], allowMultiple: false };
}

/** Returns a message describing what still needs fixing, or "" when ready. */
export function pollDraftProblem(draft: PollDraft) {
  if (!draft.question.trim()) return "Ask a question";
  const filled = draft.options.map((o) => o.trim()).filter(Boolean);
  if (filled.length < POLL_MIN) return `Add at least ${POLL_MIN} options`;
  if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) return "Each option must be different";
  return "";
}

export default function PollBuilder({
  value,
  onChange,
}: {
  value: PollDraft;
  onChange: (next: PollDraft) => void;
}) {
  function setOption(index: number, text: string) {
    const options = value.options.slice();
    options[index] = text;
    onChange({ ...value, options });
  }

  function removeOption(index: number) {
    if (value.options.length <= POLL_MIN) return;
    onChange({ ...value, options: value.options.filter((_, i) => i !== index) });
  }

  function addOption() {
    if (value.options.length >= POLL_MAX) return;
    onChange({ ...value, options: [...value.options, ""] });
  }

  return (
    <div className="poll-builder">
      <input
        type="text"
        className="poll-builder-question"
        value={value.question}
        maxLength={200}
        placeholder="Ask a question"
        aria-label="Poll question"
        onChange={(event) => onChange({ ...value, question: event.target.value })}
      />
      {value.options.map((option, index) => (
        <div className="poll-builder-row" key={index}>
          <span>{index + 1}</span>
          <input
            type="text"
            value={option}
            maxLength={100}
            placeholder={`Option ${index + 1}`}
            aria-label={`Option ${index + 1}`}
            onChange={(event) => setOption(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (index === value.options.length - 1) addOption();
              }
            }}
          />
          {value.options.length > POLL_MIN ? (
            <button type="button" onClick={() => removeOption(index)} aria-label={`Remove option ${index + 1}`}>
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
      <div className="poll-builder-footer">
        <button type="button" className="poll-builder-add" onClick={addOption} disabled={value.options.length >= POLL_MAX}>
          <Plus className="h-3.5 w-3.5" />
          {value.options.length >= POLL_MAX ? `${POLL_MAX} options max` : "Add option"}
        </button>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={value.allowMultiple}
            onChange={(event) => onChange({ ...value, allowMultiple: event.target.checked })}
          />
          <i aria-hidden="true" />
          Allow multiple answers
        </label>
      </div>
    </div>
  );
}
