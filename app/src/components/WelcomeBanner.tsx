"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, X } from "lucide-react";

type Notice = { show: false } | { show: true; title: string; body: string; href: string };

const KEY = "flirta-reward-pill";

/** Small dismissible reward chip, shown on the home page only. */
export default function WelcomeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let alive = true;
    if (localStorage.getItem(KEY) === "dismissed") return;
    fetch("/api/me/welcome/notice", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { show: false }))
      .then((data: Notice) => {
        if (alive) setNotice(data?.show ? data : { show: false });
      })
      .catch(() => {
        if (alive) setNotice({ show: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!notice?.show) return null;

  function dismiss() {
    localStorage.setItem(KEY, "dismissed");
    setNotice({ show: false });
    fetch("/api/me/welcome/dismiss", { method: "POST" }).catch(() => undefined);
  }

  return (
    <div className="reward-pill">
      <Link href={notice.href} className="reward-pill-link">
        <Gift className="h-3.5 w-3.5" aria-hidden /> {notice.title}
      </Link>
      <button type="button" className="reward-pill-x" aria-label="Dismiss reward" onClick={dismiss}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
