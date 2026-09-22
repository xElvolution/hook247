"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="orb h-[420px] w-[420px] bg-[#ff2d78]/35 -top-32 -left-24" />
      <div className="orb h-[380px] w-[380px] bg-[#7c3aed]/25 bottom-0 -right-24" />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass relative z-10 w-full max-w-md rounded-3xl p-8"
      >
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-md" />
          Hooks<span className="text-gradient">247</span>
        </Link>
        <h1 className="font-display mt-6 text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </motion.div>
    </div>
  );
}
