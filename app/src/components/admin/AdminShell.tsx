"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { leaveAction } from "@/app/502test/enter/actions";

type Item = { href: string; label: string; badgeKey?: "reports" | "withdrawals" };

const GROUPS: { id: string; label: string; items: Item[] }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [{ href: "/502test", label: "Overview" }],
  },
  {
    id: "people",
    label: "People",
    items: [
      { href: "/502test/profiles", label: "Profiles" },
      { href: "/502test/users", label: "Users" },
      { href: "/502test/verification", label: "Verification" },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { href: "/502test/commerce", label: "Plans" },
      { href: "/502test/payments", label: "Payments" },
      { href: "/502test/withdrawals", label: "Withdrawals", badgeKey: "withdrawals" },
      { href: "/502test/finance", label: "Finance" },
    ],
  },
  {
    id: "moderation",
    label: "Moderation",
    items: [
      { href: "/502test/reports", label: "Reports", badgeKey: "reports" },
      { href: "/502test/content", label: "Content" },
      { href: "/502test/audit", label: "Audit" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/502test") return pathname === "/502test";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({
  badges,
  children,
}: {
  badges: { reports: number; withdrawals: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const group of GROUPS) {
      next[group.id] = group.items.some((item) => isActive(pathname, item.href));
    }
    return next;
  });

  const currentLabel = useMemo(() => {
    for (const group of GROUPS) {
      const match = group.items.find((item) => isActive(pathname, item.href));
      if (match) return match.label;
    }
    return "Admin";
  }, [pathname]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const group of GROUPS) {
      next[group.id] = group.items.some((item) => isActive(pathname, item.href));
    }
    setOpenGroups(next);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function toggleGroup(id: string) {
    setOpenGroups((current) => ({ ...current, [id]: !current[id] }));
  }

  function badgeFor(item: Item) {
    const count = item.badgeKey === "reports" ? badges.reports : item.badgeKey === "withdrawals" ? badges.withdrawals : 0;
    if (!count) return null;
    return <span className="admin-nav-badge">{count}</span>;
  }

  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-menu-btn"
          aria-label={menuOpen ? "Close admin menu" : "Open admin menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="min-w-0">
          <p className="font-display text-sm font-bold leading-none sm:text-base">
            Hooks<span className="text-brand">247</span>
            <span className="admin-chip">Admin</span>
          </p>
          <p className="mt-1 truncate text-xs text-muted">{currentLabel}</p>
        </div>

        <form action={leaveAction} className="ml-auto">
          <button type="submit" className="admin-signout">
            Sign out
          </button>
        </form>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="admin-nav-backdrop"
          aria-label="Close admin menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside className="admin-drawer" data-open={menuOpen} aria-hidden={!menuOpen}>
        <p className="admin-drawer-kicker">Menu</p>
        <nav className="admin-accordion" aria-label="Admin sections">
          {GROUPS.map((group) => {
            const expanded = Boolean(openGroups[group.id]);
            return (
              <section key={group.id} className="admin-acc-group">
                <button
                  type="button"
                  className="admin-acc-trigger"
                  aria-expanded={expanded}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span>{group.label}</span>
                  <ChevronDown className="h-4 w-4" data-open={expanded} />
                </button>
                {expanded ? (
                  <div className="admin-acc-body">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="admin-acc-link"
                        data-active={isActive(pathname, item.href)}
                        onClick={() => setMenuOpen(false)}
                      >
                        <span>{item.label}</span>
                        {badgeFor(item)}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
