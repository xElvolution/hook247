"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRealtimeEvent } from "@/lib/realtimeClient";
import { AnimatePresence, motion } from "framer-motion";
import NavSearch from "@/components/NavSearch";
import {
  CircleHelp,
  Coins,
  Gift,
  Home,
  Mail,
  Menu,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  Radio,
  User,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

const PRIMARY_MENU: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Profiles", href: "/", icon: Home },
  { label: "Live", href: "/live", icon: Radio },
  { label: "Feed", href: "/feed", icon: Newspaper },
  { label: "Lounge", href: "/lounge", icon: MessagesSquare },
];

function bottomMenu(authed: boolean): { label: string; href: string; icon: LucideIcon }[] {
  return [
    ...PRIMARY_MENU.filter((item) => item.href !== "/lounge"),
    { label: authed ? "Profile" : "Get hooked", href: authed ? "/profile" : "/signup", icon: User },
    { label: "Boost", href: "/premium", icon: Zap },
  ];
}

const ACCOUNT_MENU: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "My profile", href: "/profile", icon: User },
  { label: "Messages", href: "/matches", icon: MessageCircle },
  { label: "Coins", href: "/coins", icon: Coins },
  { label: "Referrals", href: "/referrals", icon: Gift },
  { label: "Premium", href: "/premium", icon: Zap },
  { label: "FAQs", href: "/faqs", icon: CircleHelp },
  { label: "Contact", href: "/contact", icon: Mail },
];

const MEMBER_ONLY = new Set(["/profile", "/matches"]);

/** Unread direct messages, kept fresh by the realtime socket. */
function useUnreadMessages(authed: boolean) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    const refresh = () =>
      fetch("/api/messages/unread", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { total: 0 }))
        .then((d) => alive && setCount(d.total ?? 0))
        .catch(() => undefined);
    refresh();
    const t = window.setInterval(() => document.visibilityState === "visible" && refresh(), 60000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [authed, pathname]);
  useRealtimeEvent<{ matchId: string; message: { senderId: string } }>("dm:message", ({ matchId, message }) => {
    if (!authed) return;
    if (window.location.pathname === `/matches/${matchId}`) return;
    fetch("/api/messages/unread", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCount(d.total ?? 0))
      .catch(() => undefined);
    void message;
  });
  useRealtimeEvent("dm:seen", () => {
    fetch("/api/messages/unread", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCount(d.total ?? 0))
      .catch(() => undefined);
  });
  return authed ? count : 0;
}

function Brand() {
  return (
    <span className="flex min-w-0 items-center gap-1 sm:gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="h-6 w-6 shrink-0 rounded-md sm:h-8 sm:w-8" />
      <span className="brand-wordmark font-display text-[13px] font-extrabold tracking-tight text-white sm:text-base">
        Hooks<span className="text-[#e7658a]">247</span>
      </span>
    </span>
  );
}

export default function Shell({
  authed,
  children,
}: {
  authed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = useUnreadMessages(authed);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  function menu(items: typeof PRIMARY_MENU) {
    return (
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="side-nav-link"
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
              <span>{item.label}</span>
              {item.href === "/matches" && unread > 0 ? <b className="nav-unread">{unread > 99 ? "99+" : unread}</b> : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-[#121214]/95 backdrop-blur-xl">
        <div className="header-bar mx-auto flex max-w-[1440px] items-center gap-1.5 px-2.5 py-2 sm:gap-4 sm:px-4 sm:py-3 md:px-6">
          <button
            type="button"
            className="icon-button mobile-menu-trigger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" aria-label="Hooks247 home" className="min-w-0">
            <Brand />
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <NavSearch />
            {authed ? (
              <Link href="/matches" className="icon-button header-dm-button" aria-label={unread ? `Messages, ${unread} unread` : "Messages"}>
                <MessageCircle className="h-5 w-5" />
                {unread > 0 ? <b className="nav-unread is-dot">{unread > 9 ? "9+" : unread}</b> : null}
              </Link>
            ) : null}
            {authed ? (
              <Link href="/profile" className="header-auth-btn btn-ghost">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Profile</span>
              </Link>
            ) : (
              <>
                <Link href="/login" className="header-auth-btn btn-ghost">
                  Log in
                </Link>
                <Link href="/signup" className="header-auth-btn btn-primary">
                  <span className="sm:hidden">Sign up</span>
                  <span className="hidden sm:inline">Get hooked</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/75 md:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="h-full w-[min(260px,86vw)] overflow-y-auto border-r border-line bg-[#181619] p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-7 flex items-center justify-between">
                <Brand />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="side-nav-label">Browse</p>
              {menu(PRIMARY_MENU)}
              <p className="side-nav-label mt-7">Account</p>
              {menu(authed ? ACCOUNT_MENU : ACCOUNT_MENU.filter((item) => !MEMBER_ONLY.has(item.href)))}

              {!authed && (
                <div className="mt-7 grid gap-2">
                  <Link href="/login" onClick={() => setMenuOpen(false)} className="header-auth-btn btn-ghost w-full">
                    Log in
                  </Link>
                  <Link href="/signup" onClick={() => setMenuOpen(false)} className="header-auth-btn btn-primary w-full">
                    Sign up to get hooked
                  </Link>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex max-w-[1440px] gap-7 px-4 py-6 md:px-6">
        <aside className="sticky top-[76px] hidden h-[calc(100vh-96px)] w-48 shrink-0 flex-col md:flex">
          <p className="side-nav-label">Browse</p>
          {menu(PRIMARY_MENU)}

          <p className="side-nav-label mt-7">Account</p>
          {menu(authed ? ACCOUNT_MENU : ACCOUNT_MENU.filter((item) => !MEMBER_ONLY.has(item.href)))}

          <Link href="/premium" className="premium-note mt-auto">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#df3a6a]/15 text-[#e7658a]">
              <Zap className="h-4 w-4" />
            </span>
            <span>
              <strong>Stand out more</strong>
              <small>Boost your profile</small>
            </span>
          </Link>
        </aside>

        <main className="relative min-w-0 flex-1 pb-24 md:pb-6">{children}</main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        {bottomMenu(authed).map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-bottom-link"
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-5 w-5" strokeWidth={2.1} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
