"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import "./age-gate.css";

const STORAGE_KEY = "hooks247_age_ok";
const COOKIE_NAME = "hooks247_age_ok";
const MAX_AGE_DAYS = 30;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const LEAVE_URL = "https://www.google.com";

// The admin console is already hidden behind its own gate.
const SKIP_PREFIXES = ["/502test"];

// useLayoutEffect warns during SSR; fall back to useEffect there.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function hasConsent(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const at = Number(stored);
      if (Number.isFinite(at) && Date.now() - at < MAX_AGE_MS) return true;
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be blocked (private mode, strict settings). The cookie still counts.
  }
  return document.cookie.split("; ").some((part) => part === `${COOKIE_NAME}=1`);
}

function saveConsent() {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore: the cookie below is enough to remember the choice.
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=1; Max-Age=${MAX_AGE_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax${secure}`;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Site-wide first-visit 18+ confirmation. Renders nothing until consent has been checked in the browser. */
export default function AgeGate() {
  const pathname = usePathname();
  const skipped = SKIP_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);

  // Decide before the first paint after hydration so the gate shows at once, with no server mismatch.
  useIsoLayoutEffect(() => {
    if (skipped) return;
    if (!hasConsent()) setOpen(true);
  }, [skipped]);

  // Lock scrolling, hide the page from assistive tech and keyboard, and keep focus inside.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
    };
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    const host = dialogRef.current?.closest("[data-age-gate-root]");
    const madeInert: Element[] = [];
    for (const child of Array.from(body.children)) {
      if (child === host || child.tagName === "SCRIPT" || child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      madeInert.push(child);
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    enterRef.current?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    function onFocusIn(event: FocusEvent) {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) {
        enterRef.current?.focus({ preventScroll: true });
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      for (const element of madeInert) element.removeAttribute("inert");
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.bodyPaddingRight;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  const enter = useCallback(() => {
    saveConsent();
    setOpen(false);
  }, []);

  const leave = useCallback(() => {
    window.location.replace(LEAVE_URL);
  }, []);

  if (!open || skipped) return null;

  return createPortal(
    <div data-age-gate-root="" className="age-gate-root">
      <div className="age-gate-backdrop" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-describedby="age-gate-desc"
        className="age-gate-dialog"
      >
        <div className="age-gate-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={36} height={36} />
          <span className="font-display">
            Hooks<span className="text-gradient">247</span>
          </span>
        </div>
        <span className="age-gate-badge" aria-hidden="true">18+</span>
        <h2 id="age-gate-title" className="font-display">You must be 18 or older to enter</h2>
        <p id="age-gate-desc">
          Hooks247 contains adult content, including escort listings and explicit material. By entering you
          confirm that you are at least 18 years old and that viewing adult content is legal where you are.
        </p>
        <div className="age-gate-actions">
          <button ref={enterRef} type="button" className="btn-primary" onClick={enter}>
            I&apos;m 18 or older, enter
          </button>
          <button type="button" className="btn-ghost" onClick={leave}>
            Leave site
          </button>
        </div>
        <p className="age-gate-note">We will remember your choice on this device for 30 days.</p>
      </div>
    </div>,
    document.body
  );
}
