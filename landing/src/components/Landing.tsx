"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Flame,
  Newspaper,
  BadgeCheck,
  Zap,
  Eye,
  MessageCircle,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

// The app lives in its own project — all CTAs cross over to it.
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

const FLOATING_CARDS = [
  { name: "Amara, 24", city: "Lagos", seed: "amara", x: "8%", y: "18%", r: -8 },
  { name: "Tunde, 27", city: "Abuja", seed: "tunde", x: "78%", y: "12%", r: 6 },
  { name: "Zainab, 23", city: "Port Harcourt", seed: "zainab", x: "84%", y: "58%", r: -5 },
  { name: "Emeka, 29", city: "Enugu", seed: "emeka", x: "4%", y: "62%", r: 7 },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Flame,
    title: "Swipe that hits different",
    body: "A silky card deck with real physics. Like, pass, and get instant match fireworks when it's mutual.",
  },
  {
    icon: Newspaper,
    title: "The Feed",
    body: "Dating apps feel like interviews. Hook247 has a live social feed — post your vibe, react, comment, get noticed before you even match.",
  },
  {
    icon: BadgeCheck,
    title: "Verified humans only",
    body: "Blue-check verification keeps catfish out. See who's real at a glance.",
  },
  {
    icon: Zap,
    title: "Boost to the top",
    body: "One tap puts your profile first in the deck for everyone nearby. Prime-time energy, any time.",
  },
  {
    icon: Eye,
    title: "See who likes you",
    body: "Skip the guessing. Premium members see every like the moment it lands.",
  },
  {
    icon: MessageCircle,
    title: "Chat that flows",
    body: "Fast, private messaging the second you match. No games, no waiting.",
  },
];

const STATS = [
  { label: "always on", value: 247, suffix: "" },
  { label: "match rate", value: 89, suffix: "%" },
  { label: "cities live", value: 36, suffix: "+" },
];

const MARQUEE = [
  "24/7", "MATCH", "VIBE", "CHAT", "VERIFIED", "BOOST", "FEED", "REAL ONES",
];

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".hero-char",
        { yPercent: 120, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          stagger: 0.03,
          duration: 0.9,
          ease: "expo.out",
          delay: 0.15,
        }
      );
      gsap.fromTo(
        ".hero-fade",
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.12, duration: 0.8, ease: "power3.out", delay: 0.7 }
      );

      gsap.utils.toArray<HTMLElement>(".float-card").forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1, duration: 1, delay: 0.9 + i * 0.15, ease: "back.out(1.7)" }
        );
        gsap.to(el, {
          y: `random(-18, 18)`,
          x: `random(-12, 12)`,
          rotation: `random(-4, 4)`,
          duration: () => 3 + Math.random() * 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: i * 0.4,
        });
      });

      gsap.to(".orb-a", { x: 80, y: 60, duration: 14, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".orb-b", { x: -70, y: -40, duration: 11, repeat: -1, yoyo: true, ease: "sine.inOut" });

      gsap.utils.toArray<HTMLElement>(".feature-card").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            delay: (i % 3) * 0.1,
            scrollTrigger: { trigger: el, start: "top 88%" },
          }
        );
      });

      gsap.utils.toArray<HTMLElement>(".stat-num").forEach((el) => {
        const target = Number(el.dataset.value ?? 0);
        const obj = { n: 0 };
        gsap.to(obj, {
          n: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%" },
          onUpdate: () => {
            el.textContent = String(Math.round(obj.n));
          },
        });
      });

      gsap.fromTo(
        ".cta-block",
        { scale: 0.92, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: ".cta-block", start: "top 85%" },
        }
      );
    }, root);

    return () => ctx.revert();
  }, []);

  const headline = "Dating that never sleeps.";

  return (
    <div ref={root} className="relative min-h-screen overflow-hidden">
      <div className="orb orb-a h-[480px] w-[480px] bg-[#ff2d78]/40 -top-40 -left-32" />
      <div className="orb orb-b h-[420px] w-[420px] bg-[#7c3aed]/30 top-[30%] -right-40" />
      <div className="orb h-[380px] w-[380px] bg-[#ff6b2c]/25 bottom-0 left-[35%]" />

      {/* nav */}
      <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="font-display text-2xl font-extrabold tracking-tight">
          Hook<span className="text-gradient">247</span>
        </div>
        <div className="flex items-center gap-3">
          <a href={`${APP}/login`} className="btn-ghost !py-2.5 !px-5 text-sm">
            Log in
          </a>
          <a href={`${APP}/signup`} className="btn-primary !py-2.5 !px-5 text-sm">
            Join free
          </a>
        </div>
      </nav>

      {/* hero */}
      <section className="relative z-10 mx-auto flex min-h-[78vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
        {FLOATING_CARDS.map((c) => (
          <div
            key={c.seed}
            className="float-card glass absolute hidden w-40 rounded-2xl p-3 md:block"
            style={{ left: c.x, top: c.y, transform: `rotate(${c.r}deg)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${c.seed}&backgroundColor=1f1229`}
              alt=""
              className="h-32 w-full rounded-xl object-cover"
            />
            <div className="mt-2 text-left">
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-muted">{c.city}</p>
            </div>
          </div>
        ))}

        <p className="hero-fade mb-5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-[0.2em] text-muted uppercase">
          18+ · Verified profiles · Always on
        </p>

        <h1 className="font-display max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
          {headline.split(" ").map((word, wi) => (
            <span key={wi} className="inline-block overflow-hidden pb-1 align-bottom">
              <span className="inline-block whitespace-pre">
                {word.split("").map((ch, ci) => (
                  <span
                    key={ci}
                    className={`hero-char inline-block ${
                      word === "never" ? "text-gradient" : ""
                    }`}
                  >
                    {ch}
                  </span>
                ))}
                {wi < headline.split(" ").length - 1 ? " " : ""}
              </span>
            </span>
          ))}
        </h1>

        <p className="hero-fade mt-6 max-w-xl text-lg text-muted">
          Swipe, match and vibe with real people near you — morning, midnight,
          whenever the mood hits. Hook247 is the dating platform that runs on
          your clock.
        </p>

        <div className="hero-fade mt-9 flex flex-wrap items-center justify-center gap-4">
          <a href={APP} className="btn-primary text-base">
            Enter Hook247 — it&apos;s free
          </a>
          <a href="#features" className="btn-ghost text-base">
            See the vibe <ArrowDown className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* marquee strip */}
      <div className="relative z-10 border-y border-line bg-white/[0.02] py-4 overflow-hidden">
        <div className="marquee-track gap-10">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((w, i) => (
            <span
              key={i}
              className={`font-display text-xl font-bold tracking-widest ${
                i % 2 ? "text-gradient" : "text-white/20"
              }`}
            >
              {w} <span className="mx-4 text-white/10">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-28">
        <h2 className="font-display text-center text-3xl font-bold md:text-5xl">
          Not just another <span className="text-gradient">dating app</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-center text-muted">
          Everything you need to go from stranger to spark — built in.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="feature-card glass group rounded-3xl p-7 transition-colors hover:border-white/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff2d78]/25 to-[#ff6b2c]/25 transition-transform group-hover:scale-110">
                <f.icon className="h-6 w-6 text-[#ff5d52]" strokeWidth={2.2} />
              </div>
              <h3 className="font-display mt-5 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* stats */}
      <section className="relative z-10 border-y border-line bg-white/[0.02]">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-6 px-6 py-16 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-display text-4xl font-extrabold md:text-6xl">
                <span className="stat-num text-gradient" data-value={s.value}>
                  0
                </span>
                <span className="text-gradient">{s.suffix}</span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted md:text-sm">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-28">
        <div className="cta-block glass relative overflow-hidden rounded-[2.5rem] px-8 py-20 text-center">
          <div className="orb h-[300px] w-[300px] bg-[#ff2d78]/30 -top-20 -right-10" />
          <h2 className="font-display text-4xl font-extrabold md:text-6xl">
            Your person is <span className="text-gradient">awake too.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-muted">
            Join Hook247 free. Set up your profile in two minutes and start
            matching tonight.
          </p>
          <a href={APP} className="btn-primary mt-9 text-base">
            Take me inside
          </a>
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted md:flex-row">
          <div className="font-display font-bold text-ink">
            Hook<span className="text-gradient">247</span>
          </div>
          <p>Strictly 18+. Be kind, be real, be safe.</p>
          <p>© {new Date().getFullYear()} Hook247</p>
        </div>
      </footer>
    </div>
  );
}
