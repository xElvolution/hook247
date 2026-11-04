"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Notice = { show: false } | { show: true; title: string; body: string; href: string };

export default function WelcomeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let alive = true;
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

  return (
    <Link href={notice.href} className="welcome-banner">
      <strong>{notice.title}</strong>
      <span>{notice.body}</span>
    </Link>
  );
}
