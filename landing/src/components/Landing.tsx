"use client";

import { useEffect, useRef, useState } from "react";
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
const FALLBACK_APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.hooks247.com";

function resolveAppOrigin() {
  if (typeof window === "undefined") return FALLBACK_APP;
  const { protocol, hostname } = window.location;
  if (
    hostname === "hooks247.com" ||
    hostname === "www.hooks247.com" ||
    hostname === "app.hooks247.com"
  ) {
    return "https://app.hooks247.com";
  }
  if (hostname.startsWith("app.")) return `${protocol}//${hostname}`;
  return `${protocol}//app.${hostname}`;
}

const FLOATING_CARDS = [
  { name: "ChiChi, 26", city: "Lekki", photo: "/listings/listing-chichi.jpg", x: "8%", y: "18%", r: -8 },
  { name: "Kemi, 25", city: "Victoria Island", photo: "/listings/listing-kemi.jpg", x: "78%", y: "12%", r: 6 },
  { name: "Bisi, 28", city: "Ikeja", photo: "/listings/listing-bisi.jpg", x: "84%", y: "58%", r: -5 },
  { name: "Titi, 24", city: "Yaba", photo: "/listings/listing-titi.jpg", x: "4%", y: "62%", r: 7 },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Flame,
    title: "Search by area",
    body: "Lekki, Ikeja, VI, Abuja. Filter and see who is actually in that part of town.",
  },
  {
    icon: Newspaper,
    title: "Photos, clips and rates",
    body: "Each profile shows pictures, short clips, and Short time / Overnight / Weekend prices.",
  },
  {
    icon: BadgeCheck,
    title: "Verified profiles",
    body: "Blue-check verification keeps catfish out. See who is real at a glance.",
  },
  {
    icon: Zap,
    title: "Red Hot and Fresh",
    body: "Boost to sit at the front of search in your area. Featured profiles get seen first.",
  },
  {
    icon: Eye,
    title: "No signup to browse",
    body: "Open the site, search, and look. You only create an account if you want to list yourself.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp direct",
    body: "Tap WhatsApp on a profile. Ask availability yourself. Private and discreet.",
  },
];

const STATS = [
  { label: "always on", value: 247, suffix: "" },
  { label: "areas listed", value: 36, suffix: "+" },
  { label: "cities live", value: 12, suffix: "+" },
];

const MARQUEE = [
  "24/7", "LEKKI", "RATES", "WHATSAPP", "VERIFIED", "BOOST", "LISTINGS", "REAL ONES",
];

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [APP, setAPP] = useState(FALLBACK_APP);

  useEffect(() => {
    setAPP(resolveAppOrigin());
  }, []);

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

  const headline = "Listings that never sleep.";

  return (
    <div ref={root} className="relative min-h-screen overflow-hidden">
      <div className="orb orb-a h-[480px] w-[480px] bg-[#ff2d78]/40 -top-40 -left-32" />
      <div className="orb orb-b h-[420px] w-[420px] bg-[#7c3aed]/30 top-[30%] -right-40" />
      <div className="orb h-[380px] w-[380px] bg-[#ff6b2c]/25 bottom-0 left-[35%]" />

      {/* nav */}
      <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 md:px-6 md:py-5">
        <div className="flex items-center gap-2 font-display text-base font-extrabold tracking-tight md:text-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg md:h-9 md:w-9" />
          Hooks<span className="text-gradient">247</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <a href={`${APP}/login`} className="btn-ghost !rounded-lg !px-3.5 !py-2 text-sm md:!px-5">
            Log in
          </a>
          <a href={`${APP}/signup`} className="btn-primary !rounded-lg !px-3.5 !py-2 text-sm md:!px-5">
            List my profile
          </a>
        </div>
      </nav>

      {/* hero */}
      <section className="relative z-10 mx-auto flex min-h-[78vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
        {FLOATING_CARDS.map((c) => (
          <div
            key={c.photo}
            className="float-card glass absolute hidden w-40 rounded-2xl p-3 md:block"
            style={{ left: c.x, top: c.y, transform: `rotate(${c.r}deg)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.photo}
              alt={c.name}
              className="h-36 w-full rounded-xl object-cover object-top"
            />
            <div className="mt-2 text-left">
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-muted">{c.city}</p>
            </div>
          </div>
        ))}

        <p className="hero-fade mb-5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-[0.2em] text-muted uppercase">
          18+ · Independent models · WhatsApp direct
        </p>

        <h1 className="font-display max-w-4xl text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
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

        <p className="hero-fade mt-5 max-w-xl text-base text-muted">
          Beauty may catch your eye. Personality keeps you here. Search by
          area, view photos and rates, then WhatsApp. List for free. Browse
          without signing up.
        </p>

        <div className="hero-fade mt-7 flex flex-wrap items-center justify-center gap-2 md:mt-9 md:gap-4">
          <a href={APP} className="btn-primary !px-4 !py-2 text-sm md:!px-6 md:!py-3 md:text-base">
            Browse listings
          </a>
          <a href="#features" className="btn-ghost !px-4 !py-2 text-sm md:!px-6 md:!py-3 md:text-base">
            How it works <ArrowDown className="h-4 w-4" />
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
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-24">
        <h2 className="font-display text-center text-2xl font-bold md:text-4xl">
          Search. Open. <span className="text-gradient">WhatsApp.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-center text-muted">
          Come discover what makes them different.
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
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-28">
        <div className="cta-block glass relative overflow-hidden rounded-[1.75rem] px-5 py-12 text-center md:rounded-[2.5rem] md:px-8 md:py-20">
          <div className="orb h-[300px] w-[300px] bg-[#ff2d78]/30 -top-20 -right-10" />
          <h2 className="font-display text-2xl font-extrabold md:text-5xl">
            Find someone in <span className="text-gradient">your area.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted md:mt-5 md:text-base">
            Browse free. List your profile in two minutes.
          </p>
          <a href={APP} className="btn-primary mt-6 !px-4 !py-2 text-sm md:mt-9 md:!px-6 md:!py-3 md:text-base">
            Browse listings
          </a>
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted md:flex-row">
          <div className="font-display font-bold text-ink">
            Hooks<span className="text-gradient">247</span>
          </div>
          <p>Strictly 18+. Be kind, be real, be safe.</p>
          <p>© {new Date().getFullYear()} Hooks247</p>
        </div>
      </footer>
    </div>
  );
}
