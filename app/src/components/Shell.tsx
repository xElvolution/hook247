"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import NavSearch from "@/components/NavSearch";
import {
  CircleHelp,
  Flame,
  Heart,
  Home,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Newspaper,
  Radio,
  User,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

const PRIMARY_MENU: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Discover", href: "/discover", icon: Flame },
  { label: "Live", href: "/live", icon: Radio },
  { label: "Community", href: "/feed", icon: Newspaper },
  { label: "Likes", href: "/likes", icon: Heart },
  { label: "Matches", href: "/matches", icon: MessageCircle },
];

const ACCOUNT_MENU: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "My profile", href: "/profile", icon: User },
  { label: "Premium", href: "/premium", icon: Zap },
  { label: "FAQs", href: "/faqs", icon: CircleHelp },
  { label: "Contact", href: "/contact", icon: Mail },
];

const MOBILE_MENU = PRIMARY_MENU.slice(0, 5);

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#df3a6a] font-display text-sm font-extrabold text-white">
        H
      </span>
      <span className="font-display text-lg font-extrabold text-white">
        Hook<span className="text-[#e7658a]">247</span>
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
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

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
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-[#121214]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 md:px-6">
          <button
            type="button"
            className="icon-button mobile-menu-trigger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" aria-label="Hook247 home">
            <Brand />
          </Link>

          <NavSearch />

          <div className="ml-auto flex items-center gap-2.5">
            <Link
              href={authed ? "/matches" : "/login"}
              className="icon-button header-desktop-action"
              aria-label="Messages"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
            </Link>
            {authed ? (
              <>
                <Link href="/profile" className="btn-ghost header-desktop-action !px-4 !py-2 text-xs">
                  <User className="h-4 w-4" /> Profile
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="icon-button"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost !px-4 !py-2 text-xs">
                  Log in
                </Link>
                <Link href="/signup" className="btn-primary header-desktop-action !px-4 !py-2 text-xs">
                  Join free
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
            className="fixed inset-0 z-50 bg-black/75 md:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="h-full w-[280px] overflow-y-auto border-r border-line bg-[#181619] p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-7 flex items-center justify-between">
                <Brand />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="icon-button"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="side-nav-label">Discover</p>
              {menu(PRIMARY_MENU)}
              <p className="side-nav-label mt-7">Account</p>
              {menu(authed ? ACCOUNT_MENU : ACCOUNT_MENU.filter((item) => item.href !== "/profile"))}

              {!authed ? (
                <Link href="/signup" className="btn-primary mt-7 w-full text-sm">
                  Join Hook247
                </Link>
              ) : (
                <button type="button" onClick={logout} className="btn-ghost mt-7 w-full text-sm">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex max-w-[1440px] gap-7 px-4 py-6 md:px-6">
        <aside className="sticky top-[76px] hidden h-[calc(100vh-96px)] w-48 shrink-0 flex-col md:flex">
          <p className="side-nav-label">Discover</p>
          {menu(PRIMARY_MENU)}

          <p className="side-nav-label mt-7">Account</p>
          {menu(authed ? ACCOUNT_MENU : ACCOUNT_MENU.filter((item) => item.href !== "/profile"))}

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
        {MOBILE_MENU.map((item) => {
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
              <span>{item.label === "Community" ? "Feed" : item.label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
